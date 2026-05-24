from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Mapping

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.core.exceptions import CheckinError, checkin_invalid_message


FaceBBox = tuple[float, float, float, float]
AttendanceAction = Literal["attendance_frame"]
AttendanceType = Literal["checkin", "checkout"]
AttendanceStatus = Literal["on_time", "late", "early", "unknown"]
FrameStatus = Literal["PROCESSING", "REJECTED", "UNKNOWN_FACE"]
SessionStatus = Literal[
    "ATTENDANCE_SUCCESS",
    "ALREADY_RECORDED",
    "CHECKOUT_WITHOUT_CHECKIN",
    "EMPLOYEE_INACTIVE",
    "EMPLOYEE_NOT_FOUND",
    "ERROR",
]


class CheckinSchemaModel(BaseModel):
    # extra="forbid" giữ contract WebSocket chặt chẽ như enrollment schema:
    # frontend gửi dư field sẽ bị reject thay vì backend im lặng bỏ qua.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    def to_websocket_payload(self) -> dict[str, Any]:
        """Return a JSON-safe dict for `websocket.send_json(...)`.

        Args:
            None.

        Returns:
            Dict without `None` values; `date`/`datetime` fields are serialized
            to JSON-friendly strings.

        Example:
            `await websocket.send_json(response.to_websocket_payload())`
        """

        return self.model_dump(mode="json", exclude_none=True)


class AttendanceFrameMessage(CheckinSchemaModel):
    """Client request for one check-in/check-out camera frame.

    Example payload:
        `{"action": "attendance_frame", "type": "checkin", "image": "data:image/jpeg;base64,/9j/..."}`
    """

    # action cố định giúp WebSocket endpoint phân biệt frame attendance với các
    # message điều khiển khác nếu sau này frontend bổ sung start/stop session.
    action: AttendanceAction

    # type xác định người dùng đang check-in hay checkout trong cùng một schema.
    type: AttendanceType

    # image là JPEG data URL hoặc raw base64 string. Schema không decode ảnh;
    # decode thật sẽ làm ở pipeline để lỗi ảnh dùng chung với quality/detection.
    image: str = Field(min_length=1)

    @field_validator("image")
    @classmethod
    def _must_be_jpeg_data_url_or_base64(cls, value: str) -> str:
        # Field(min_length=1) chưa đủ nếu input toàn khoảng trắng; sau khi
        # str_strip_whitespace chạy, value rỗng sẽ bị reject tại đây.
        if not value:
            raise ValueError("image must not be blank")

        if value.startswith("data:"):
            header, separator, payload = value.partition(",")
            normalized_header = header.lower()
            is_jpeg_data_url = normalized_header in {
                "data:image/jpeg;base64",
                "data:image/jpg;base64",
            }
            if not separator or not payload or not is_jpeg_data_url:
                raise ValueError("image must be a JPEG data URL or raw base64 string")
        return value


class CheckinEmployeeOverlay(CheckinSchemaModel):
    """Safe employee fields that the frontend may display on camera overlay."""

    employee_id: str
    full_name: str
    department: str | None = None
    position: str | None = None


class ProcessingFrameResponse(CheckinSchemaModel):
    # Response trong lúc backend đã nhận frame và đang/đã xử lý một phần.
    # Frontend dùng face_bbox, employee, message, attendance_status để vẽ overlay
    # trên camera preview mà không cần hiểu chi tiết pipeline backend.
    status: Literal["PROCESSING"] = "PROCESSING"
    message: str
    face_bbox: FaceBBox | None = None
    employee: CheckinEmployeeOverlay | None = None
    attendance_status: AttendanceStatus = "unknown"
    similarity_score: float | None = None
    details: dict[str, Any] | None = None


class RejectedFrameResponse(CheckinSchemaModel):
    # Response khi frame hiện tại bị reject nhưng WebSocket session vẫn có thể
    # tiếp tục nhận frame mới, ví dụ blur/no face/bad pose.
    status: Literal["REJECTED"] = "REJECTED"
    reason: str
    message: str
    face_bbox: FaceBBox | None = None
    employee: CheckinEmployeeOverlay | None = None
    attendance_status: AttendanceStatus = "unknown"
    details: dict[str, Any] | None = None


class UnknownFaceResponse(CheckinSchemaModel):
    # Response khi face embedding hợp lệ nhưng không match nhân viên đã enrollment.
    status: Literal["UNKNOWN_FACE"] = "UNKNOWN_FACE"
    message: str
    face_bbox: FaceBBox | None = None
    employee: None = None
    attendance_status: AttendanceStatus = "unknown"
    similarity_score: float | None = None
    details: dict[str, Any] | None = None


class AttendanceSessionResponse(CheckinSchemaModel):
    # Response cấp session sau khi đã đủ điều kiện quyết định chấm công.
    # Frontend vẫn dùng cùng các field overlay: face_bbox, employee, message,
    # attendance_status, nhưng status lúc này là kết quả cuối.
    status: SessionStatus
    success: bool
    message: str
    attendance_type: AttendanceType | None = None
    employee: CheckinEmployeeOverlay | None = None
    face_bbox: FaceBBox | None = None
    check_time: datetime | None = None
    check_date: date | None = None
    on_time: bool | None = None
    attendance_status: AttendanceStatus = "unknown"
    similarity_score: float | None = None
    details: dict[str, Any] | None = None


class CheckinErrorResponse(CheckinSchemaModel):
    # Response lỗi có cấu trúc cho invalid message hoặc lỗi session chưa map
    # sang AttendanceSessionResponse. Step 09 sẽ bổ sung CheckinError core.
    status: Literal["ERROR"] = "ERROR"
    reason: str
    message: str
    face_bbox: FaceBBox | None = None
    employee: CheckinEmployeeOverlay | None = None
    attendance_status: AttendanceStatus = "unknown"
    details: dict[str, Any] | None = None


# Backward-compatible alias for callers written against step 08. Step 09 moves
# structured check-in errors into app.core.exceptions.CheckinError.
CheckinMessageValidationError = CheckinError


def parse_attendance_frame_message(payload: Mapping[str, Any]) -> AttendanceFrameMessage:
    """Parse one raw WebSocket JSON object into `AttendanceFrameMessage`.

    Args:
        payload: Raw dict from `websocket.receive_json()`. Example:
            `{"action": "attendance_frame", "type": "checkout", "image": "data:image/jpeg;base64,/9j/..."}`

    Returns:
        Validated `AttendanceFrameMessage`.

    Raises:
        CheckinError: When required fields are missing, extra fields are
            present, or `image` is not a non-empty JPEG data URL/raw base64
            string.

    Example:
        `message = parse_attendance_frame_message(await websocket.receive_json())`
    """

    try:
        return AttendanceFrameMessage.model_validate(payload)
    except ValidationError as exc:
        # include_context=False bỏ object Exception trong ctx để payload luôn
        # JSON-safe khi gửi qua websocket.send_json(...).
        raise checkin_invalid_message(
            "Dữ liệu check-in/check-out gửi lên không hợp lệ",
            details={"errors": exc.errors(include_url=False, include_context=False)},
        ) from exc
