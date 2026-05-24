# Step 08 — Check-in WebSocket Schemas

## Mục tiêu

Chuẩn hóa request/response WebSocket cho check-in/check-out.

## File dự kiến

- `app/schemas/checkin.py` mới.

## Request schema

Client gửi mỗi frame:

```json
{
  "action": "attendance_frame",
  "type": "checkin",
  "image": "data:image/jpeg;base64,/9j/..."
}
```

Field:

- `action`: literal `"attendance_frame"`.
- `type`: literal `"checkin"` hoặc `"checkout"`.
- `image`: base64/data URL JPEG.

## Response schema dự kiến

Frame-level:

- `PROCESSING`.
- `REJECTED`.
- `UNKNOWN_FACE`.

Session-level:

- `ATTENDANCE_SUCCESS`.
- `ALREADY_RECORDED`.
- `CHECKOUT_WITHOUT_CHECKIN`.
- `EMPLOYEE_INACTIVE`.
- `EMPLOYEE_NOT_FOUND`.
- `ERROR`.

## Comment/docstring bắt buộc

- Parser helper phải ghi input là raw dict từ `websocket.receive_json()`.
- Request model phải ghi ví dụ payload.
- Response model phải ghi field nào frontend dùng để overlay: `face_bbox`, `employee`, `message`, `attendance_status`.

## Tiêu chí nghiệm thu

- Extra field bị forbid nếu theo pattern enrollment.
- Validation error được convert thành lỗi có cấu trúc.
- Không decode image trong schema; decode làm ở pipeline.

