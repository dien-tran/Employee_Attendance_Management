# Step 05 Result - MySQL Data Access Service

## Trang thai

DONE

## File da tao

- `app/services/mysql_db.py`
- `plans/checkin/result/step_05_mysql_service_result.md`

## Noi dung da thuc hien

- Tao `MySQLDatabaseService` de gom cac thao tac truy cap MySQL cho `staffs` va `attendances`.
- Tao typed records:
  - `StaffRecord`
  - `AttendanceRecord`
  - `DuplicateAttendanceError`
- Ho tro cac method async:
  - `connect()`
  - `close()`
  - `get_staff_by_employee_id(employee_id)`
  - `find_attendance(employee_id, attendance_type, check_date)`
  - `has_checkin(employee_id, check_date)`
  - `insert_attendance(employee_id, attendance_type, check_time, check_date, on_time)`
- Them docstring/comment cho cac public method, gom mo ta tham so, dau ra va vi du su dung.

## Quyet dinh ky thuat

- Service nay chi lam data access, khong tinh `on_time`, khong xu ly face recognition, khong xu ly anti-spoofing.
- Dung `aiomysql.create_pool()` de tai su dung connection pool, tranh tao connection moi theo tung frame camera.
- Dung lazy import `aiomysql` trong `connect()` de file van import/compile duoc khi dependency chua duoc install vao local environment.
- Dung parameterized query voi `%s` cho tat ca query.
- Duplicate attendance dua vao primary key `(employee_id, type, check_date)` trong schema va duoc map thanh `DuplicateAttendanceError`.
- Khong them `similarity_score` vao `insert_attendance()` vi step 01 da chot schema `attendances` khong co truong nay.

## Kiem tra da chay

- `python -m compileall -q app/services/mysql_db.py`
- `python -c "from app.services.mysql_db import MySQLDatabaseService, StaffRecord, AttendanceRecord, DuplicateAttendanceError; print('mysql_db import ok')"`

## Ghi chu

- Chua test ket noi MySQL that vi step nay chi tao service va verify compile/import. DB integration test se phu hop hon o cac step verification/e2e sau.
- `StaffRecord` co field `password_hash` theo schema day du cua bang `staffs`; cac layer API/WebSocket sau nay khong nen tra field nay ve client.
