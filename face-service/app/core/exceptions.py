from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Mapping


# EnrollmentErrorCode gom các mã lỗi mà pipeline/WebSocket sẽ dùng trong luồng
# đăng ký khuôn mặt. Các giá trị này khớp với plan để frontend có thể hiển thị
# feedback realtime như NO_FACE, BLUR, BAD_POSE... mà không phải đoán từ message.
EnrollmentErrorCode = Literal[
    "INVALID_MESSAGE",
    "INVALID_IMAGE",
    "NO_FACE",
    "MULTIPLE_FACES",
    "LOW_CONFIDENCE",
    "FACE_OUT_OF_FRAME",
    "SPOOF_DETECTED",
    "BLUR",
    "TOO_DARK",
    "TOO_BRIGHT",
    "FACE_TOO_SMALL",
    "BAD_POSE",
    "TIMEOUT",
    "VECTOR_DB_ERROR",
    "INTERNAL_ERROR",
]


@dataclass(frozen=True)
class EnrollmentError(Exception):
    # code là mã máy đọc được, ví dụ "BLUR" hoặc "SPOOF_DETECTED".
    # Pipeline sẽ map code này vào field reason/status khi trả qua WebSocket.
    code: EnrollmentErrorCode

    # message là câu người dùng đọc được. Ví dụ:
    # raise EnrollmentError("INVALID_IMAGE", "Ảnh gửi lên không hợp lệ")
    message: str

    # details chứa dữ liệu debug có cấu trúc như score, threshold, frame index.
    # Không bắt buộc trả toàn bộ details cho frontend nếu có dữ liệu nhạy cảm.
    details: Mapping[str, Any] = field(default_factory=dict)

    # per_frame=True nghĩa là chỉ reject frame hiện tại, session vẫn tiếp tục.
    # per_frame=False nghĩa là lỗi cấp session, ví dụ TIMEOUT hoặc Qdrant lỗi.
    per_frame: bool = True

    def __post_init__(self) -> None:
        # Exception base class cần args để khi log/print(e) vẫn thấy message rõ.
        Exception.__init__(self, self.message)

    def to_websocket_payload(
        self,
        accepted_count: int | None = None,
        required_count: int | None = None,
    ) -> dict[str, Any]:
        # Hàm này chuẩn hóa payload trả về frontend sau này.
        # Ví dụ:
        # try:
        #     ...
        # except EnrollmentError as exc:
        #     await websocket.send_json(exc.to_websocket_payload(3, 10))
        payload: dict[str, Any] = {
            "status": "REJECTED" if self.per_frame else "ERROR",
            "reason": self.code,
            "message": self.message,
        }

        # accepted_count/required_count chỉ có ý nghĩa trong enrollment session
        # multi-frame, nên caller truyền vào khi đang xử lý WebSocket.
        if accepted_count is not None:
            payload["accepted_count"] = accepted_count
        if required_count is not None:
            payload["required_count"] = required_count

        if self.details:
            payload["details"] = dict(self.details)

        return payload


def invalid_message(message: str, details: Mapping[str, Any] | None = None) -> EnrollmentError:
    # Dùng khi JSON từ frontend thiếu action/employee_id/full_name/date_of_birth/image
    # hoặc date_of_birth sai format YYYY-MM-DD.
    return EnrollmentError(
        code="INVALID_MESSAGE",
        message=message,
        details=details or {},
        per_frame=False,
    )


def invalid_image(message: str, details: Mapping[str, Any] | None = None) -> EnrollmentError:
    # Dùng khi decode_base64_image(...) fail hoặc ảnh không phải BGR HxWx3.
    return EnrollmentError(
        code="INVALID_IMAGE",
        message=message,
        details=details or {},
        per_frame=True,
    )


def timeout_error(message: str, details: Mapping[str, Any] | None = None) -> EnrollmentError:
    # Dùng khi session đã nhận quá max_total_frames nhưng chưa đủ good frames.
    return EnrollmentError(
        code="TIMEOUT",
        message=message,
        details=details or {},
        per_frame=False,
    )


def vector_db_error(message: str, details: Mapping[str, Any] | None = None) -> EnrollmentError:
    # Dùng khi Qdrant không kết nối được, create collection fail, hoặc upsert fail.
    return EnrollmentError(
        code="VECTOR_DB_ERROR",
        message=message,
        details=details or {},
        per_frame=False,
    )


def internal_error(message: str, details: Mapping[str, Any] | None = None) -> EnrollmentError:
    # Lỗi bất ngờ trong backend. Pipeline nên log chi tiết, còn frontend chỉ cần
    # message an toàn để không lộ stack trace.
    return EnrollmentError(
        code="INTERNAL_ERROR",
        message=message,
        details=details or {},
        per_frame=False,
    )


# CheckinErrorCode gom các mã lỗi dùng riêng cho luồng check-in/check-out.
# Tách khỏi EnrollmentErrorCode để frontend có thể phân biệt rõ lỗi đăng ký
# khuôn mặt với lỗi chấm công mà không phải suy đoán từ message.
CheckinErrorCode = Literal[
    "INVALID_MESSAGE",
    "INVALID_IMAGE",
    "NO_FACE",
    "MULTIPLE_FACES",
    "LOW_CONFIDENCE",
    "FACE_OUT_OF_FRAME",
    "BLUR",
    "TOO_DARK",
    "TOO_BRIGHT",
    "BAD_POSE",
    "FACE_TOO_SMALL",
    "UNKNOWN_FACE",
    "ALREADY_RECORDED",
    "CHECKOUT_WITHOUT_CHECKIN",
    "EMPLOYEE_INACTIVE",
    "EMPLOYEE_NOT_FOUND",
    "DB_ERROR",
    "SESSION_TIMEOUT",
    "INTERNAL_ERROR",
]


@dataclass(frozen=True)
class CheckinError(Exception):
    """Structured error for check-in/check-out WebSocket flow."""

    # code là mã máy đọc được, ví dụ "UNKNOWN_FACE" hoặc "ALREADY_RECORDED".
    code: CheckinErrorCode

    # message là câu an toàn cho frontend hiển thị trực tiếp.
    message: str

    # details chứa debug data JSON-safe như threshold, score, hoặc validation errors.
    details: Mapping[str, Any] = field(default_factory=dict)

    # per_frame=True nghĩa là chỉ frame hiện tại bị reject; WebSocket không nhất
    # thiết đóng và frontend có thể tiếp tục gửi frame camera mới.
    per_frame: bool = True

    def __post_init__(self) -> None:
        # Exception base class cần args để log/print(error) vẫn thấy message.
        Exception.__init__(self, self.message)

    def to_websocket_payload(self) -> dict[str, Any]:
        """Return a JSON-safe WebSocket error payload.

        Args:
            None.

        Returns:
            Dict shaped as:
            `{"status": "REJECTED"|"UNKNOWN_FACE"|"ERROR", "reason": code, "message": message, "details": {...}}`.
            `details` is omitted when empty.

        Example:
            `await websocket.send_json(error.to_websocket_payload())`
        """

        # UNKNOWN_FACE có status riêng trong check-in để frontend phân biệt người
        # không match với frame bị reject vì chất lượng ảnh.
        if self.code == "UNKNOWN_FACE":
            status = "UNKNOWN_FACE"
        else:
            status = "REJECTED" if self.per_frame else "ERROR"

        payload: dict[str, Any] = {
            "status": status,
            "reason": self.code,
            "message": self.message,
        }
        if self.details:
            payload["details"] = dict(self.details)
        return payload


def checkin_invalid_message(
    message: str,
    details: Mapping[str, Any] | None = None,
) -> CheckinError:
    # Session-level error: message contract sai thì backend nên đóng WebSocket
    # sau khi trả ERROR để client sửa payload.
    return CheckinError(
        code="INVALID_MESSAGE",
        message=message,
        details=details or {},
        per_frame=False,
    )


def checkin_invalid_image(
    message: str,
    details: Mapping[str, Any] | None = None,
) -> CheckinError:
    # Per-frame error: ảnh hỏng hoặc decode fail không nhất thiết đóng WebSocket.
    return CheckinError(
        code="INVALID_IMAGE",
        message=message,
        details=details or {},
        per_frame=True,
    )


def checkin_frame_error(
    code: CheckinErrorCode,
    message: str,
    details: Mapping[str, Any] | None = None,
) -> CheckinError:
    # Helper chung cho lỗi frame như NO_FACE, BLUR, BAD_POSE, UNKNOWN_FACE.
    if code in {
        "INVALID_MESSAGE",
        "ALREADY_RECORDED",
        "CHECKOUT_WITHOUT_CHECKIN",
        "EMPLOYEE_INACTIVE",
        "EMPLOYEE_NOT_FOUND",
        "DB_ERROR",
        "SESSION_TIMEOUT",
        "INTERNAL_ERROR",
    }:
        raise ValueError(f"{code} is a session-level check-in error")
    return CheckinError(
        code=code,
        message=message,
        details=details or {},
        per_frame=True,
    )


def checkin_attendance_error(
    code: CheckinErrorCode,
    message: str,
    details: Mapping[str, Any] | None = None,
) -> CheckinError:
    # Session-level error: attendance đã có kết luận cuối như duplicate, inactive,
    # employee not found, hoặc checkout thiếu check-in thì API có thể đóng session.
    if code not in {
        "ALREADY_RECORDED",
        "CHECKOUT_WITHOUT_CHECKIN",
        "EMPLOYEE_INACTIVE",
        "EMPLOYEE_NOT_FOUND",
    }:
        raise ValueError(f"{code} is not an attendance decision error")
    return CheckinError(
        code=code,
        message=message,
        details=details or {},
        per_frame=False,
    )


def checkin_db_error(
    message: str,
    details: Mapping[str, Any] | None = None,
) -> CheckinError:
    # Session-level error: DB lỗi thì không nên tiếp tục nhận frame trong session đó.
    return CheckinError(
        code="DB_ERROR",
        message=message,
        details=details or {},
        per_frame=False,
    )


def checkin_timeout_error(
    message: str,
    details: Mapping[str, Any] | None = None,
) -> CheckinError:
    # Session-level error: quá thời gian mà chưa xác nhận được nhân viên/chấm công.
    return CheckinError(
        code="SESSION_TIMEOUT",
        message=message,
        details=details or {},
        per_frame=False,
    )


def checkin_internal_error(
    message: str,
    details: Mapping[str, Any] | None = None,
) -> CheckinError:
    # Lỗi bất ngờ trong check-in pipeline; frontend nhận message an toàn.
    return CheckinError(
        code="INTERNAL_ERROR",
        message=message,
        details=details or {},
        per_frame=False,
    )
