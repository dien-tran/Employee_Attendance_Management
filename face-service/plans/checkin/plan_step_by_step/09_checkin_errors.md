# Step 09 — CheckinError and Error Helpers

## Mục tiêu

Tạo lỗi có cấu trúc cho check-in/check-out, tương tự `EnrollmentError`.

## File dự kiến

- `app/core/exceptions.py`.

## Nội dung chính

Thêm:

- `CheckinError`.
- Helper lỗi cho invalid message/image.
- Helper lỗi DB.
- Helper timeout.
- Helper employee inactive/not found nếu cần.

## Error mapping dự kiến

Per-frame:

- `INVALID_IMAGE`.
- `NO_FACE`.
- `MULTIPLE_FACES`.
- `LOW_CONFIDENCE`.
- `FACE_OUT_OF_FRAME`.
- `BLUR`.
- `TOO_DARK`.
- `TOO_BRIGHT`.
- `BAD_POSE`.
- `FACE_TOO_SMALL`.
- `UNKNOWN_FACE`.

Session-level:

- `INVALID_MESSAGE`.
- `ALREADY_RECORDED`.
- `CHECKOUT_WITHOUT_CHECKIN`.
- `EMPLOYEE_INACTIVE`.
- `EMPLOYEE_NOT_FOUND`.
- `DB_ERROR`.
- `SESSION_TIMEOUT`.

## Comment/docstring bắt buộc

- `to_websocket_payload(...)` phải ghi output shape.
- Comment rõ per-frame error không nhất thiết đóng WebSocket.
- Comment rõ session error sẽ đóng WebSocket.

## Tiêu chí nghiệm thu

- Không phá `EnrollmentError`.
- Enrollment schema/API vẫn import được.
- Payload lỗi JSON-safe.

