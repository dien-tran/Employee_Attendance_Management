# Kế hoạch Xây dựng Hệ thống Backend (Master Plan)
*Tài liệu này đóng vai trò là kim chỉ nam cho `back-end-agent` trong quá trình khởi tạo và phát triển hệ thống Employee Attendance Management System (EAMS).*

## Giai đoạn 1: Khởi tạo Nền tảng (Project Bootstrapping)
**Mục tiêu**: Đặt nền móng vững chắc với cấu trúc MVC, kết nối CSDL và các công cụ cơ bản.
- [x] 1. Khởi tạo dự án Node.js (`npm init -y`) trong thư mục `back-end`.
- [x] 2. Cài đặt các dependencies cốt lõi (`express`, `mysql2`, `dotenv`, `cors`, `helmet`, `joi`/`zod`, `jsonwebtoken`).
- [x] 3. Thiết lập cấu trúc thư mục MVC:
  - `routes/`
  - `controllers/`
  - `services/`
  - `models/`
  - `middlewares/`
  - `config/`
- [x] 4. Tạo file cấu hình môi trường chuẩn (`.env.example` và `.env`). **Tuyệt đối không hardcode**.
- [x] 5. Thiết lập Express Server cơ bản (`app.js` hoặc `server.js`).
- [x] 6. Khởi tạo Database Connection Pool (`mysql2`) trong thư mục `config/` và viết log test kết nối.

## Giai đoạn 2: Lớp Bảo mật & Quản lý Lỗi (Gateway & Global Error Handling)
**Mục tiêu**: Áp dụng chuẩn Production trước khi gắn API.
- [ ] 1. Tích hợp middleware **CORS** và **Helmet**.
- [ ] 2. Xây dựng **Global Error Handling Middleware** theo chuẩn PRD: `{ "status": "error", "message": "...", "code": ... }`.
- [ ] 3. Đảm bảo mọi lỗi từ ứng dụng đều được bẫy vào Error Handler thay vì crash server hoặc trả về stack trace.

## Giai đoạn 3: Phân hệ Nhân viên (Employee Module)
**Mục tiêu**: Xây dựng APIs phục vụ người dùng cuối (Nhân viên). *Chú ý tham chiếu Frontend source code để thiết kế Payload/Response phù hợp.*
- [ ] 1. **EMP-01 Đăng nhập**: Xây dựng `POST /api/v1/auth/login`. Phát hành JWT cho việc xác thực.
- [ ] 2. Thiết lập Middleware `verifyToken` để bảo vệ các private routes tiếp theo.
- [ ] 3. **EMP-04 Dashboard cá nhân**: Xây dựng API tổng quan số liệu `GET /api/v1/employee/dashboard`.
- [ ] 4. **EMP-03 Lịch sử đi làm**: Xây dựng API xem lịch sử chấm công `GET /api/v1/attendance/history` (có phân trang và lọc).
- [ ] 5. **EMP-02 Chấm công khuôn mặt**: 
  - Xây dựng API nhận ảnh base64/form-data.
  - Giao tiếp với AI Service (Python) thông qua HTTP REST.
  - Lưu log chấm công vào MySQL nếu validation thành công.
- [ ] 6. **EMP-05 AI Chatbot**: Xây dựng API bridge `POST /api/v1/chatbot/message` để chuyển tiếp câu hỏi từ frontend sang Core AI.

## Giai đoạn 4: Phân hệ Quản lý (Manager Module)
**Mục tiêu**: Cung cấp quyền quản trị trên MySQL DB với các APIs chỉ dành cho Admin. *Cần bổ sung Middleware `verifyAdmin`*.
- [ ] 1. **MGR-01 Quản lý Nhân sự**: API CRUD (`GET`, `POST`, `PUT`, `DELETE` /api/v1/admin/employees). (Lưu ý Soft Delete).
- [ ] 2. **MGR-02 Quản lý Dữ liệu Khuôn mặt**: Xây dựng API upload ảnh Face Data `POST /api/v1/admin/faces/upload` và đẩy sang AI.
- [ ] 3. **MGR-03 Cập nhật/Xóa Face Data**: API `PUT/DELETE /api/v1/admin/faces/:employeeId`.
- [ ] 4. **MGR-04 Dashboard Toàn công ty**: API thống kê `GET /api/v1/admin/dashboard`.

## Giai đoạn 5: Đối chiếu Frontend & Bù đắp API (API Gap Filling)
**Mục tiêu**: Thực hiện rà soát toàn diện sau khi hoàn thành phần lớn ứng dụng ở Giai đoạn 4, bảo đảm Frontend hoạt động hoàn hảo trên thực tế mà không gặp lỗi 404 (Missing Endpoints).
- [ ] 1. **Rà soát Frontend**: Đi sâu vào các thư mục chứa logic gọi API của Frontend (vd: các file service, file cấu hình axios, custom hooks). Chỉ được phép **Đọc** (Read-only for Context).
- [ ] 2. **Phát hiện khoảng trống**: Lập danh sách toàn bộ các method, endpoints, payload và format dữ liệu mà Frontend đang chờ. So sánh với các API đã xây dựng từ Giai đoạn 3 & 4.
- [ ] 3. **Lấp đầy API**: Nếu có bất kỳ API nào hụt so với Frontend gọi (chưa được nêu trong PRD), Agent chủ động viết thêm controller/route/service phía Backend để đáp ứng.
- [ ] 4. **Giữ nguyên hiện trạng UI**: Tuyệt đối **KHÔNG CHỈNH SỬA, THÊM HAY XÓA** bất kỳ dòng code nào ở phía thư mục Frontend để ép nó chạy theo Backend. Frontend là "Source of Truth".

## 🚦 Nguyên tắc Kiểm soát tiến độ (Fallback & Validation Loop)
- Ở mỗi đầu việc (Checkbox), Agent phải tự **kiểm tra chéo (Validate)** - ví dụ chạy test local luồng API đó.
- Nếu gặp lỗi 3 lần liên tiếp, Agent **NGỪNG HOẠT ĐỘNG**, ghi log lỗi ra màn hình và chờ phản hồi từ người dùng.
- Bắt buộc phải **đọc/tham khảo cấu trúc file Frontend** (vd: API calls, Types/Interfaces) của tính năng đó trước khi bắt tay viết Code Backend (bù đắp API Gap).

---
> **Lưu ý dành cho Back-end Agent**: Khi nhận kế hoạch này, vui lòng chia nhỏ các tác vụ, tick (x) vào các mục đã hoàn thành sau mỗi phiên làm việc để quản lý có thể theo dõi tiến độ dễ dàng.
