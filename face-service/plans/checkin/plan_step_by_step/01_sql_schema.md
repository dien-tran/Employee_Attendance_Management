# Step 01 — SQL Schema for Staffs and Attendances

## Mục tiêu

Tạo schema MySQL cho database dùng chung của hệ thống:

- Bảng `staffs` đầy đủ thuộc tính nghiệp vụ nhân viên.
- Bảng `attendances` để ghi nhận check-in/check-out.
- Face_Services dùng các bảng này để tra cứu nhân viên và ghi nhận chấm công; những nghiệp vụ quản lý hồ sơ chi tiết vẫn cần được kiểm soát ở service/UI phù hợp của hệ thống.

## File dự kiến

- `sql/01_create_attendance_tables.sql` mới.

## Nội dung chính

Tạo bảng `staffs`:

- `employee_id VARCHAR(20) PRIMARY KEY`: mã nhân viên do hệ thống tạo.
- `full_name VARCHAR(100) NOT NULL`: tên nhân viên.
- `department VARCHAR(100)`: phòng ban.
- `position VARCHAR(100)`: vị trí.
- `onboard_date DATE`: ngày onboard.
- `status ENUM('active', 'inactive') NOT NULL DEFAULT 'active'`: trạng thái làm việc.
- `phone VARCHAR(20)`: số điện thoại.
- `personal_email VARCHAR(100)`: email cá nhân.
- `national_id VARCHAR(20)`: CCCD.
- `bank_account VARCHAR(30)`: số tài khoản ngân hàng.
- `bank_name VARCHAR(100)`: tên ngân hàng.
- `date_of_birth DATE`: ngày sinh.
- `password_hash VARCHAR(255)`: password mặc định từ ngày sinh, nhưng lưu dạng hash, không lưu plain text.
- `created_at`, `updated_at`.

Tạo bảng `attendances`:

- `employee_id VARCHAR(20) NOT NULL`.
- `type ENUM('checkin', 'checkout') NOT NULL`.
- `check_time DATETIME NOT NULL`: thời gian chấm công check-in/check-out.
- `check_date DATE NOT NULL`.
- `on_time BOOLEAN NOT NULL`: đúng giờ hay không.
- `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`.

Constraint/index:

- Foreign key `employee_id -> staffs(employee_id)`.
- Unique key `(employee_id, type, check_date)` để chống ghi trùng.
- Index `check_date`.
- Index `(employee_id, check_date)`.

## Comment bắt buộc khi code SQL

- Comment giải thích `staffs.employee_id` là mã do hệ thống tạo, không dùng auto-increment vì format có thể là `NV001`.
- Comment giải thích `password_hash` lưu hash của password mặc định từ ngày sinh, không lưu password plain text.
- Comment giải thích unique key dùng để chống race condition khi nhiều frame/request cùng ghi.
- Comment giải thích `check_date` dùng để query theo ngày theo timezone app.

## Quyết định khi code step 01

1. `password_hash`: chỉ tạo cột lưu hash, không lưu password plain text.
   - Policy được ghi chú trong SQL: ngày sinh `YYYY-MM-DD` có thể tạo default password `DDMMYYYY`. Ví dụ `1998-04-21` -> `21041998`, sau đó hash bằng bcrypt ở account-management flow.
2. `on_time` với check-out:
   - SQL chỉ tạo cột `on_time BOOLEAN`; logic tính true/false sẽ nằm ở step service.
3. Bảng `attendances` không thêm `id BIGINT AUTO_INCREMENT`.
   - Dùng `PRIMARY KEY (employee_id, type, check_date)` vì nghiệp vụ hiện chỉ cho một check-in và một check-out mỗi ngày.
4. Không thêm `similarity_score` trong step 01.
   - Bảng chấm công giữ đúng các field bạn liệt kê: mã nhân viên, loại, thời gian, ngày, `on_time`.

## Tiêu chí nghiệm thu

- SQL hợp lệ với MySQL 8.0.
- Bảng `staffs` có đầy đủ thuộc tính bạn liệt kê.
- Bảng `attendances` có đủ mã nhân viên, loại, thời gian, ngày, `on_time`.
- Có thể chạy lại tương đối an toàn bằng `CREATE TABLE IF NOT EXISTS`.
