# Frontend Structure & Expected API Endpoints

Tài liệu này tóm tắt các tính năng Frontend hiện có đối với ứng dụng Quản lý điểm danh (App Attendance Management) và hướng đề xuất để xây dựng Backend APIs phục vụ trực tiếp cho các luồng giao diện này.

---

## 1. Các luồng tính năng (Frontend Feature Flow)

### 1.1 Khối người dùng (User & Employees)
- **Home/Dashboard**:
  - Xem thông tin cá nhân (vị trí, phòng ban) và trạng thái check-in.
  - Xem đồng hồ thời gian (thời gian thực), thống kê điểm danh hiện tại theo tỉ lệ số ngày, ngày đi muộn.
  - Cập nhật danh sách điểm danh 5 lần gần nhất.
- **Check-in Station (`/user/check`)**:
  - Giao diện quét/mô phỏng quét Face-ID thông qua Camera.
  - Sau khi quét thành công, hiển thị các toast notification, cập nhật giờ check-in/check-out và đổi trạng thái "Checked In".
- **Attendance History (`/user/attendance`)**:
  - Hiển thị danh sách lịch sử điểm danh đầy đủ với các trạng thái "Present", "Absent", "Late", "Half-day". 
- **Profile (`/user/profile`)**:
  - Xem và tùy chỉnh thông tin cá nhân hiện hành, tuỳ chỉnh giao diện (Theme switch Light/Dark).
- **AI Chatbot Support (Floating Widget)**:
  - Tương tác với Chatbot để tra cứu thông tin điểm danh, tình trạng nhân sự.

### 1.2 Khối quản trị (Admin)
- **Admin Dashboard (`/admin/dashboard`)**:
  - Tổng hợp các chỉ số công ty (Số lượng employee, tỉ lệ vắng/muộn...).
  - Biểu đồ hệ thống và thống kê real-time.
- **Manage Employees (`/admin/employees`)**:
  - Xem danh sách nhân viên công ty, vị trí, vai trò. Thao tác thêm/sửa/xoá (CRUD).
- **Attendance Records (`/admin/attendance`)**:
  - Xem xét lịch sử điểm danh toàn bộ nhân sự với các trạng thái chi tiết theo ngày. Có thể lọc, sửa chữa trạng thái thủ công.
- **Face Data Management (`/admin/face-data`)**:
  - Theo dõi danh sách nhân sự đã / chưa đăng ký dữ liệu khuôn mặt (`hasFaceData: boolean`).
  - Phê duyệt cập nhật lại dữ liệu AI (Train/Upload/Delete).

---

## 2. Danh sách dự kiến các API Endpoints (Cập nhật chuẩn hóa)

Hệ thống cần các Models cốt lõi: **User**, **AttendanceRecord**, **FaceData** và **SystemSettings**.
Dưới đây là cấu trúc thiết kế các API Endpoints hoàn chỉnh (dành cho đội Backend).

### Group 1: Authentication (`/api/auth`)
- `POST /api/auth/login`
  - **Mục đích**: Xác thực người dùng (bằng Email/Password), trả về JWT Token và thông tin cơ bản.
  - **Response Payload**: `{ token, user: { id, role, name, email, avatar } }`
- `POST /api/auth/logout`
  - **Mục đích**: Xóa token/session đăng nhập.
- `POST /api/auth/refresh`
  - **Mục đích**: Refresh JWT (nếu sử dụng mô hình short-lived access token).

### Group 2: User & Profile Management (`/api/users`)
- `GET /api/users/me`
  - **Mục đích**: Lấy thông tin user đang đăng nhập hiện tại từ Token.
- `PUT /api/users/me`
  - **Mục đích**: User cập nhật thông tin cá nhân (ảnh đại diện, preferences như dark mode).
- `GET /api/users`
  - **Mục đích**: Lấy danh sách nhân viên (dành cho Admin). Cần hỗ trợ phân trang và tìm kiếm (Filters: department, status).
- `POST /api/users`
  - **Mục đích**: Admin tạo tài khoản nhân viên mới.
- `PUT /api/users/:id` & `DELETE /api/users/:id`
  - **Mục đích**: Admin sửa đổi hoặc xóa nhân viên khỏi hệ thống.

### Group 3: Attendance & Check-in (`/api/attendance`)
- `POST /api/attendance/check`
  - **Mục đích**: Web gửi ảnh khuôn mặt (hoặc Base64) để Face Recognition AI quét. Hệ thống quyết định đây là lần Check-in hay Check-out.
  - **Request Payload**: `multipart/form-data` hoặc JSON: `{ imageBase64: "...", timestamp: "..." }`
  - **Response Payload**: `{ status: "success", recordId: "...", action: "check-in", time: "08:15", user: "..." }`
- `GET /api/attendance/my-records`
  - **Mục đích**: User xem lịch sử điểm danh của chính mình.
- `GET /api/attendance`
  - **Mục đích**: Admin xem toàn bộ lịch sử điểm danh nhân sự (Phân trang, lọc theo `date`, `department`, `status`).
- `PUT /api/attendance/:id`
  - **Mục đích**: Admin manual override trạng thái làm việc (Ví dụ: Đổi từ Absent sang Late/Present).

### Group 4: Face Biometrics Admin (`/api/face-data`)
- `GET /api/face-data/status`
  - **Mục đích**: Admin lấy danh sách User kèm nhãn `hasFaceData: true/false`.
- `POST /api/face-data/register`
  - **Mục đích**: Admin/User lưu data quét Face ban đầu vào cơ sở dữ liệu để làm mốc cho mô hình AI.
- `DELETE /api/face-data/:employeeId`
  - **Mục đích**: Admin reset/xóa Face Data của nhân viên cụ thể.

### Group 5: Dashboard Analytics (`/api/analytics`)
- `GET /api/analytics/summary`
  - **Mục đích**: Thống kê số lượng theo ngày (Tổng nhân viên, Số làm muộn, Vắng mặt, On-time percentage) cho các Cards.
- `GET /api/analytics/chart`
  - **Mục đích**: Trả về timeline theo tuần/tháng để render biểu đồ Line / Bar chart trên Dashboard Admin.

### Group 6: AI Chatbot Assistant (`/api/chatbot`)
- `POST /api/chatbot/message`
  - **Mục đích**: Xử lý tin nhắn hỏi đáp của người dùng liên quan đến nội quy nhân sự, giờ giấc và điểm danh cá nhân.
  - **Request Payload**: `{ message: "hôm nay tôi có đi muộn không?", context: ["..."] }`
  - **Response Payload**: `{ reply: "Bạn đã check-in lúc 09:15, muộn 15 phút so với quy định." }`
