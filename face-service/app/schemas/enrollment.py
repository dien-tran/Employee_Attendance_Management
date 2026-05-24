from __future__ import annotations

from datetime import date
from typing import Any, Literal, Mapping

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.core.exceptions import EnrollmentError, invalid_message


FaceBBox = tuple[float, float, float, float]


# Client hiện chỉ có một action trong enrollment WebSocket: gửi frame camera.
# Dùng Literal giúp Pydantic reject sớm nếu frontend gửi sai như "start"/"stop".
EnrollmentAction = Literal["capture"]


class EnrollmentCaptureMessage(BaseModel):
    # extra="forbid" giúp phát hiện payload sai contract thay vì im lặng bỏ qua.
    # str_strip_whitespace tự trim chuỗi, ví dụ " NV001 " -> "NV001".
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    # action cho biết message này là một frame capture từ frontend.
    # Ví dụ JSON:
    # {"action": "capture", "employee_id": "NV001", ...}
    action: EnrollmentAction

    # employee_id là mã nhân viên do hệ thống/HR cung cấp, dùng làm metadata Qdrant.
    employee_id: str = Field(min_length=1)

    # full_name là tên hiển thị của nhân viên, cũng lưu trong Qdrant payload.
    full_name: str = Field(min_length=1)

    # date_of_birth giữ dạng string ISO YYYY-MM-DD để metadata khi lưu Qdrant
    # rõ ràng và dễ serialize. Không dùng dob hoặc DD/MM/YYYY.
    date_of_birth: str = Field(min_length=10, max_length=10)

    # image là ảnh JPEG base64 frontend gửi lên. Thường là data URL:
    # "data:image/jpeg;base64,/9j/..."
    # decode thật sẽ làm ở app/utils/image.py trong pipeline, không làm trong schema.
    image: str = Field(min_length=1)

    @field_validator("employee_id", "full_name", "image")
    @classmethod
    def _must_not_be_blank(cls, value: str) -> str:
        # Field(min_length=1) chưa đủ nếu input toàn khoảng trắng; validator này
        # đảm bảo sau khi strip vẫn còn nội dung thật.
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("date_of_birth")
    @classmethod
    def _must_be_iso_date(cls, value: str) -> str:
        # date.fromisoformat chỉ nhận ISO date hợp lệ dạng YYYY-MM-DD.
        # Ví dụ hợp lệ: "1998-04-21"; không hợp lệ: "21/04/1998".
        try:
            parsed_date = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("date_of_birth must use ISO format YYYY-MM-DD") from exc

        # Trả lại parsed_date.isoformat() để format luôn ổn định khi đưa vào metadata.
        return parsed_date.isoformat()

    def to_employee_metadata(self) -> dict[str, str]:
        # Metadata cơ bản của nhân viên. Pipeline sẽ bổ sung enrolled_at,
        # num_frames_used, score averages và model_version trước khi lưu Qdrant.
        # Ví dụ:
        # metadata = message.to_employee_metadata()
        return {
            "employee_id": self.employee_id,
            "full_name": self.full_name,
            "date_of_birth": self.date_of_birth,
        }


class GoodFrameResponse(BaseModel):
    # Response khi frame pass đủ Detection -> Anti-Spoofing -> Quality -> Embedding.
    status: Literal["GOOD_FRAME"] = "GOOD_FRAME"
    accepted_count: int
    required_count: int

    # anti_spoof_score là live_score của frame vừa pass anti-spoofing.
    # Giá trị 0..1, frontend hiển thị thành phần trăm "accuracy/liveness".
    anti_spoof_score: float

    # face_bbox là bbox khuôn mặt theo ảnh gốc backend nhận: [x1, y1, x2, y2].
    # Frontend dùng field này để vẽ bounding box overlay trên video preview.
    face_bbox: FaceBBox

    # predicted_label và model_scores là debug anti-spoofing. model_scores có dạng:
    # {"2.7_80x80_MiniFASNetV2.pth": [p_fake_0, p_real_1, p_fake_2], ...}
    # Frontend dùng để xem model nào đang kéo liveness score xuống.
    anti_spoof_predicted_label: int
    anti_spoof_model_scores: dict[str, list[float]]
    anti_spoof_crop_boxes: dict[str, list[int]] | None = None
    anti_spoof_debug_crop_paths: dict[str, str] | None = None
    anti_spoof_source_frame_path: str | None = None
    anti_spoof_image_shape: list[int] | None = None
    anti_spoof_crop_stats: dict[str, dict[str, Any]] | None = None

    message: str


class RejectedFrameResponse(BaseModel):
    # Response khi frame bị reject nhưng session vẫn có thể tiếp tục.
    # reason sẽ là NO_FACE, BLUR, SPOOF_DETECTED...
    status: Literal["REJECTED"] = "REJECTED"
    reason: str
    accepted_count: int | None = None
    required_count: int | None = None
    message: str
    details: dict[str, Any] | None = None


class EnrollmentCompleteData(BaseModel):
    # Data trả về khi đã đủ good frames, average + normalize embedding, và lưu Qdrant OK.
    embedding_id: str
    employee_id: str
    full_name: str
    date_of_birth: str
    num_frames_used: int
    anti_spoof_score_avg: float
    quality_score_avg: float


class EnrollmentCompleteResponse(BaseModel):
    status: Literal["ENROLLMENT_COMPLETE"] = "ENROLLMENT_COMPLETE"
    success: Literal[True] = True
    message: str
    data: EnrollmentCompleteData


class EnrollmentErrorResponse(BaseModel):
    # Response lỗi cấp session, ví dụ INVALID_MESSAGE, TIMEOUT, VECTOR_DB_ERROR.
    status: Literal["ERROR"] = "ERROR"
    reason: str
    message: str
    details: dict[str, Any] | None = None


def parse_enrollment_capture_message(payload: Mapping[str, Any]) -> EnrollmentCaptureMessage:
    # Hàm helper cho WebSocket endpoint/pipeline:
    # raw = await websocket.receive_json()
    # message = parse_enrollment_capture_message(raw)
    #
    # Nếu payload sai schema, hàm này đổi Pydantic ValidationError thành
    # EnrollmentError(INVALID_MESSAGE) để API layer trả cùng format lỗi chuẩn.
    try:
        return EnrollmentCaptureMessage.model_validate(payload)
    except ValidationError as exc:
        # include_context=False bỏ object Exception trong ctx; nếu giữ lại,
        # websocket.send_json(...) có thể fail vì ValueError không JSON-serializable.
        raise invalid_message(
            "Dữ liệu enrollment gửi lên không hợp lệ",
            details={"errors": exc.errors(include_url=False, include_context=False)},
        ) from exc


def error_to_response(error: EnrollmentError) -> RejectedFrameResponse | EnrollmentErrorResponse:
    # Convert EnrollmentError thành Pydantic response model khi API layer muốn
    # validate payload trước khi send_json.
    #
    # Ví dụ:
    # response = error_to_response(exc)
    # await websocket.send_json(response.model_dump(exclude_none=True))
    payload = error.to_websocket_payload()
    if payload["status"] == "REJECTED":
        return RejectedFrameResponse.model_validate(payload)
    return EnrollmentErrorResponse.model_validate(payload)
