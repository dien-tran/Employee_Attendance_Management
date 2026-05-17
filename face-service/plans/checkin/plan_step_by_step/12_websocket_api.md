# Step 12 — Check-in WebSocket API

## Mục tiêu

Expose endpoint WebSocket cho check-in/check-out.

## File dự kiến

- `app/api/v1/checkin.py` mới.
- `app/api/v1/router.py` cập nhật include router.

## Endpoint

- `/api/v1/checkin/ws`.

## Nội dung chính

- Accept WebSocket.
- Tạo một `CheckinPipeline` cho mỗi connection.
- Receive JSON object.
- Gọi pipeline xử lý payload.
- Send JSON response.
- Đóng socket khi response là terminal.

## Terminal statuses

- `ATTENDANCE_SUCCESS`.
- `ALREADY_RECORDED`.
- `CHECKOUT_WITHOUT_CHECKIN`.
- `EMPLOYEE_INACTIVE`.
- `EMPLOYEE_NOT_FOUND`.
- `ERROR`.
- `SESSION_TIMEOUT`.

## Comment/docstring bắt buộc

- Comment endpoint contract.
- Comment vì sao mỗi connection có pipeline riêng.
- Comment `_safe_send_json` và `_safe_close` nếu tạo helper giống enrollment.

## Tiêu chí nghiệm thu

- JSON sai không crash server.
- Client disconnect không log stack trace thừa.
- Router include không phá enrollment route.

