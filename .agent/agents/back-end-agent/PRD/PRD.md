# Product Requirements Document (PRD)

## Tên dự án: Hệ thống Quản lý Chuyên cần Nhân viên (Employee Attendance Management System - EAMS)

## 1. Tổng quan dự án (Project Overview)
Hệ thống EAMS là một nền tảng quản lý nhân sự tập trung vào việc tự động hóa quá trình chấm công thông qua công nghệ nhận diện khuôn mặt và cung cấp các tiện ích hỗ trợ qua AI Chatbot. Hệ thống phục vụ hai nhóm người dùng chính: Nhân viên (Employees) và Quản lý (Managers/Admins), với các quyền hạn và giao diện chuyên biệt.

## 2. Mục tiêu (Objectives)
- **Tự động hóa:** Loại bỏ quy trình chấm công thủ công (thẻ từ, vân tay truyền thống).
- **Chính xác & Bảo mật:** Ngăn chặn tình trạng gian lận chấm công nhờ AI nhận diện khuôn mặt.
- **Tiện lợi:** Tích hợp Chatbot để nhân viên tra cứu thông tin nhanh chóng.
- **Quản trị tập trung:** Cung cấp dashboard tổng quan cho quản lý theo dõi tình hình nhân sự realtime.

## 3. Tech Stack & Architecture (Kiến trúc & Công nghệ)
*(Agent cần tuân thủ tuyệt đối cấu trúc này khi thực thi skill `developing-backend`)*
- **Core Backend:** Node.js, Express.js (RESTful APIs).
- **Architecture Pattern:** MVC (Model-View-Controller) phân lớp rõ ràng.
- **Database:** MySQL (Bắt buộc dùng Connection Pool).
- **AI/ML Service:** Python (Xử lý model nhận diện khuôn mặt & Logic NLP cho Chatbot) - *Giao tiếp với Core Backend qua REST API hoặc gRPC*.
- **Security:** CORS, Helmet, JWT (JSON Web Tokens) cho Authentication/Authorization.
- **Environment:** Quản lý cấu hình qua `.env`, tuyệt đối không hardcode credentials.

## 4. Phân quyền người dùng (User Roles)
1.  **Employee (Nhân viên):** Chỉ có thể xem dữ liệu cá nhân, thực hiện chấm công, và tương tác với Chatbot.
2.  **Manager/Admin (Quản lý):** Toàn quyền quản lý dữ liệu nhân viên, dữ liệu khuôn mặt, và xem báo cáo toàn hệ thống.

## 5. Danh sách Tính năng chi tiết (Feature Specifications)

### 5.1. Phân hệ Nhân viên (Employee Module)
| Feature ID | Tên tính năng | Mô tả chi tiết | APIs cần thiết (Dự kiến) |
| :--- | :--- | :--- | :--- |
| `EMP-01` | Đăng nhập | Đăng nhập vào hệ thống bằng Email/Password, trả về JWT Token. | `POST /api/v1/auth/login` |
| `EMP-02` | Chấm công bằng khuôn mặt | Nhân viên chụp ảnh/stream qua FE. Backend nhận file/base64, chuyển sang AI Service để verify. Nếu khớp, ghi nhận log chấm công (Check-in/Check-out). | `POST /api/v1/attendance/verify` |
| `EMP-03` | Lịch sử đi làm | Lấy danh sách lịch sử chấm công của bản thân (phân trang, lọc theo tháng). | `GET /api/v1/attendance/history` |
| `EMP-04` | Dashboard cá nhân | Lấy dữ liệu tổng quan: số ngày công, số ngày đi muộn/về sớm. | `GET /api/v1/employee/dashboard` |
| `EMP-05` | AI Chatbot (Tương tác) | Nhắn tin với chatbot để hỏi về số ngày phép, chính sách công ty. Gửi request sang AI Service. | `POST /api/v1/chatbot/message` |

### 5.2. Phân hệ Quản lý (Manager Module)
| Feature ID | Tên tính năng | Mô tả chi tiết | APIs cần thiết (Dự kiến) |
| :--- | :--- | :--- | :--- |
| `MGR-01` | Quản lý Nhân sự (CRUD) | Thêm, xem, sửa, xóa (soft delete) thông tin nhân viên (Tên, Email, Phòng ban, Vị trí...). | `GET/POST/PUT/DELETE /api/v1/admin/employees` |
| `MGR-02` | Quản lý Dữ liệu Khuôn mặt | Admin upload hình ảnh chuẩn của nhân viên. Backend gọi AI Service để trích xuất và lưu trữ *embeddings* (vector khuôn mặt) làm data gốc. | `POST /api/v1/admin/faces/upload` |
| `MGR-03` | Cập nhật/Xóa Face Data | Xóa hoặc cập nhật lại data khuôn mặt nếu nhân viên thay đổi ngoại hình đáng kể. | `PUT/DELETE /api/v1/admin/faces/:employeeId` |
| `MGR-04` | Dashboard Toàn công ty | Thống kê số lượng nhân viên có mặt/vắng mặt trong ngày, biểu đồ tỷ lệ đi muộn... | `GET /api/v1/admin/dashboard` |

## 6. Luồng dữ liệu (Data Flow) cốt lõi

### Luồng Chấm công (EMP-02)
1.  **Frontend:** Gửi ảnh khuôn mặt của nhân viên kèm Token lên Core Backend (Node.js).
2.  **Core Backend (Controller -> Service):**
    - Nhận request, xác thực JWT (Middleware).
    - Forward ảnh/dữ liệu sang AI Service (Python) kèm ID nhân viên (nếu cần đối chiếu nhanh).
3.  **AI Service (Python):** Phân tích ảnh, so sánh với vector khuôn mặt trong database. Trả về kết quả: `{ "match": true, "confidence": 0.95, "employeeId": "..." }`.
4.  **Core Backend (Service -> Model):** Nếu `match` là true, thực hiện lưu log thời gian vào bảng `Attendance` trong MySQL.
5.  **Core Backend (Controller):** Trả về Response thành công cho Frontend.

## 7. Yêu cầu Phi chức năng (Non-Functional Requirements)
- **Error Handling:** Sử dụng Global Error Handler middleware. Mọi lỗi API trả về format đồng nhất: `{ "status": "error", "message": "...", "code": ... }`. Không leak stack trace.
- **Validation:** Validate mọi payload đầu vào (VD: dùng `Joi` hoặc `Zod` tại tầng Middleware).
- **Transaction:** Các thao tác ảnh hưởng nhiều bảng (ví dụ: Tạo nhân viên mới + Khởi tạo record chuyên cần) phải sử dụng DB Transactions để đảm bảo tính toàn vẹn dữ liệu (ACID).

## 8. Quy ước Tham chiếu Giao diện (Frontend Reference Policy)

- **Đồng bộ với Giao diện hiện có:** Hệ thống Frontend của dự án đã được thiết kế hoàn thiện. Các chức năng Backend bắt buộc phải được xây dựng dựa trên giao diện người dùng (UI) đã có sẵn. 
- **Quyền đọc (Read-only for Context):** Backend Agent cần chủ động đọc và tham khảo source code Frontend (đặc biệt là các file gọi API, Type/Interface, JSON mock data) để đảm bảo Backend thiết kế trả về đúng format dữ liệu mà Frontend đang trực chờ.
- **CHỐNG CHỈ ĐỊNH / STRICTLY FORBIDDEN:** Backend Agent **TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP CHỈNH SỬA, THÊM HAY XÓA** bất kỳ file mã nguồn nào thuộc phạm vi của Frontend. Nhiệm vụ duy nhất của bạn là "đọc Frontend để hiểu, và chỉ viết code cho Backend" để ghép nối thông suốt.
- **Bù đắp khoảng trống API (API Gap Filling):** Trong trường hợp Backend Agent phát hiện Frontend đang thực hiện gọi những API endpoints chưa được liệt kê trong tài liệu PRD này, Agent phải ưu tiên lấy Frontend làm "nguồn sự thật nguyên thủy" (Source of Truth), chủ động xây dựng bổ sung các API còn thiếu để đảm bảo giao diện hoạt động hoàn hảo mà không bị lỗi 404 Not Found.