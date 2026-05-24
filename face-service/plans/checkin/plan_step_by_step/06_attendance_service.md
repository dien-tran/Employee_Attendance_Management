# Step 06 — Attendance Business Service

## Mục tiêu

Tách luật chấm công khỏi MySQL CRUD.

Service này chịu trách nhiệm:

- Tính ngày/giờ theo timezone app.
- Tính status `on_time`, `late`, `early`.
- Áp dụng rule check-out cần check-in trước.
- Trả decision có cấu trúc cho pipeline/API.

## File dự kiến

- `app/services/attendance.py` mới.

## API dự kiến

- `resolve_local_now(timezone_name: str) -> datetime`.
- `get_check_date(now: datetime) -> date`.
- `parse_hhmm(value: str) -> time`.
- `class AttendanceService`.
- `async record_attendance(employee, attendance_type, similarity_score, now=None) -> AttendanceDecision`.

## Decision dự kiến

- `ATTENDANCE_SUCCESS`.
- `ALREADY_RECORDED`.
- `CHECKOUT_WITHOUT_CHECKIN`.
- `EMPLOYEE_INACTIVE`.
- `EMPLOYEE_NOT_FOUND`.
- `DB_ERROR`.

## Comment/docstring bắt buộc

- Docstring giải thích `timezone_name`, ví dụ `"Asia/Ho_Chi_Minh"`.
- Docstring giải thích `now=None` dùng thời gian hiện tại, còn test có thể truyền datetime cố định.
- Comment trước block tính status:
  - Check-in sau `checkin_deadline` là `late`.
  - Check-out trước `checkout_start` là `early`.

## Tiêu chí nghiệm thu

- Unit-test được bằng fake MySQL service.
- Không gọi model AI.
- Không gọi Qdrant.
- Không tự đọc config global nếu đã được inject config.

