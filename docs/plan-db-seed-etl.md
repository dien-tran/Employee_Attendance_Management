# Kế Hoạch: Đồng bộ DB schema mới + seed lần đầu + ETL định kỳ 5 phút

## 1. Summary
- Thêm cột `has_face` vào `auth_db.staffs` với mặc định `FALSE`, đồng thời map vào `auth-service` entity.
- Sửa `seed_mock_data.py` để chạy đúng với kiến trúc dual-db Docker hiện tại (`auth_db` + `core_db`).
- Tự động seed mock data lần đầu khi khởi tạo theo rule: chỉ seed khi `core_db.attendances` đang rỗng.
- Sửa toàn bộ ETL `hr_etl` để đọc đúng schema Docker mới và vẫn xuất `staff_summary.md`/`attendance_summary.md`.
- Thêm câu hỏi mới `"Phân bố của nhân viên theo phòng ban?"` vào `staff_summary` dưới dạng row mới.
- Thêm scheduler chạy ETL mỗi 5 phút trong `chat-service` startup.

## 2. Implementation Changes
- `auth-service`:
  - Thêm startup schema initializer idempotent để chạy:
    - `ALTER TABLE staffs ADD COLUMN IF NOT EXISTS has_face BOOLEAN NOT NULL DEFAULT FALSE`
    - `UPDATE staffs SET has_face = FALSE WHERE has_face IS NULL`
  - Thêm field `hasFace` vào entity `Staff` (không expose API theo scope đã chốt).
  - Khi tạo admin seed, set `hasFace=false` rõ ràng.

- `chat-service/scripts/seed_mock_data.py`:
  - Chuyển từ single DB sang 2 kết nối:
    - Ghi `staffs` vào `auth_db`.
    - Ghi `attendances` vào `core_db`.
  - Đổi mapping cột theo schema thực tế:
    - `staffs`: `staff_id, name, department, position, onboard_date, status, phone, email, identity_card, bank_account, bank_name, dob, password, role, has_face`.
    - `attendances`: `staff_id, type, timestamp, date, on_time`.
  - Dùng giá trị domain đúng runtime:
    - `status`: `ACTIVE/INACTIVE`
    - `type`: `CHECK_IN/CHECK_OUT`
    - `role`: `USER/ADMIN`
  - Giữ report output, cập nhật query tổng hợp theo tên cột mới.

- Bootstrap lần đầu + scheduler trong `chat-service`:
  - Thêm startup flow:
    - Check `COUNT(*)` ở `core_db.attendances`.
    - Nếu `0` thì chạy seed mock data.
    - Chạy ETL 1 lần ngay sau đó để refresh markdown.
  - Tạo background loop chạy ETL mỗi `300s`.
  - Thêm shutdown cleanup để cancel task scheduler gọn.

- `chat-service/scripts/hr_etl`:
  - `extract.py`: đổi query/alias theo schema mới (`staff_id`, `name`, `dob`, `password`, `type`, `timestamp`, `date`, `on_time`, `has_face`).
  - `metrics.py` + `transform.py`: đổi toàn bộ logic key từ `id`/schema cũ sang `staff_id` và cột mới.
  - Điều chỉnh logic các metric phụ thuộc `attendance_type/attendance_time/...` sang `type/timestamp/date`.
  - Với metric “default password hash SHA256” (không còn phù hợp schema mới), đổi thành thông điệp/đếm an toàn theo khả năng xác định thực tế từ dữ liệu hiện tại, không để ETL fail.
  - Thêm row staff mới cho câu hỏi:
    - `Phân bố của nhân viên theo phòng ban?`
    - Dùng cùng dataset phân bố theo phòng ban hiện có, không thay thế câu cũ.

## 3. Public Interfaces / Config Changes
- DB:
  - `auth_db.staffs` thêm cột `has_face BOOLEAN NOT NULL DEFAULT FALSE`.
- Runtime behavior:
  - `chat-service` có thêm startup bootstrap (seed-first-run + ETL initial run).
  - `chat-service` chạy ETL scheduler 5 phút/lần trong process.
- Config mặc định:
  - Interval ETL mặc định `300s`.

## 4. Test Plan
- `auth-service`:
  - Test startup initializer chạy idempotent (chạy lặp không lỗi, không đổi dữ liệu hợp lệ).
  - Test entity persistence với `has_face` mặc định `false`.

- `chat-service seed`:
  - Test logic tạo staff/attendance đúng cột, đúng enum string (`CHECK_IN/CHECK_OUT`, `ACTIVE/INACTIVE`).
  - Test seed chạy được khi DB Docker schema mới.
  - Test “first init rule”: có data trong `attendances` thì không seed lại.

- `hr_etl`:
  - Cập nhật test ETL hiện có để dùng frame schema mới và xác nhận không crash.
  - Assert `staff_summary` có chứa câu `"Phân bố của nhân viên theo phòng ban?"`.
  - Assert pipeline `run_split(mode="both")` vẫn xuất đủ `staff_summary.md` và `attendance_summary.md`.

- Scheduler:
  - Unit test loop scheduling gọi ETL định kỳ và dừng sạch khi shutdown signal.

## 5. Assumptions
- Chỉ chạy 1 replica `chat-service` (để tránh nhiều scheduler cùng chạy ETL song song).
- “Lần đầu khởi tạo” được định nghĩa là `core_db.attendances` rỗng.
- `has_face` chỉ cần ở DB + entity mapping, chưa cần expose qua API/DTO ở vòng này.
