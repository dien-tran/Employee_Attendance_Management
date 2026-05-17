# Step 05 — MySQL Service

## Mục tiêu

Tạo service truy cập MySQL cho nghiệp vụ attendance.

Service này chỉ làm data access:

- Đọc `staffs`.
- Kiểm tra attendance đã tồn tại.
- Kiểm tra đã check-in trong ngày.
- Insert attendance.

Không chứa logic AI và không tính `late/early`.

## File dự kiến

- `app/services/mysql_db.py` mới.

## API dự kiến

- `async connect() -> None`.
- `async close() -> None`.
- `async get_staff_by_employee_id(employee_id: str) -> StaffRecord | None`.
- `async find_attendance(employee_id: str, attendance_type: str, check_date: date) -> AttendanceRecord | None`.
- `async has_checkin(employee_id: str, check_date: date) -> bool`.
- `async insert_attendance(...) -> AttendanceRecord`.

## Data models dự kiến

- `StaffRecord`.
- `AttendanceRecord`.
- `DuplicateAttendanceError` hoặc error tương đương để map unique key.

## Comment/docstring bắt buộc

Mỗi method public phải ghi:

- `employee_id`: ví dụ `"NV001"`.
- `attendance_type`: `"checkin"` hoặc `"checkout"`.
- `check_date`: ngày đã tính theo timezone app. Example: `date(2026, 5, 15)`.
- `check_time`: datetime theo timezone app.
- `similarity_score`: cosine score từ Qdrant. Example: `0.9234`.

Block insert phải có comment:

- Unique key có thể bắt duplicate khi nhiều frame/request ghi gần nhau.
- Duplicate sẽ được map thành `ALREADY_RECORDED`.

## Tiêu chí nghiệm thu

- Không khởi tạo pool theo từng frame.
- Query dùng parameter binding, không format string SQL trực tiếp.
- Có xử lý close pool.
- Có thể test bằng fake hoặc DB thật sau khi Docker sẵn sàng.

