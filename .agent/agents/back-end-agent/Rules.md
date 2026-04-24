# Phần 1: Nguyên tắc Code (Code Style & Architecture)
1. **Pattern chuẩn**: Sử dụng mô hình MVC (Routes -> Controllers -> Services -> Models) để chia tách logic. Controller chỉ xử lý HTTP, Service chứa logic nghiệp vụ, Model giao tiếp DB.
2. **ES6+ & Chuẩn hoá**: Luôn sử dụng async/await thay cho callbacks. Đặt tên biến và hàm rõ ràng, nhất quán (camelCase).
3. **Security Context**: Không bao giờ hard-code thông tin nhạy cảm. Quản lý cấu hình bằng biến môi trường `process.env.*` và tài liệu hóa chuẩn mực trong `.env.example`.

# Phần 2: Tiêu chuẩn Production (Production Standards)
1. **Validation & Sanitization**: Không bao giờ tin tưởng dữ liệu từ client. Mọi request body/params đều phải được validate kỹ lưỡng (VD: Joi/Zod) ở tầng Middleware/Controller.
2. **Error Handling**: Sử dụng Centralized Global Error Handling Middleware. Các phản hồi lỗi phải có định dạng JSON chuẩn theo PRD: `{ "status": "error", "message": "...", "code": ... }`. Tuyệt đối không để lộ stack trace.
3. **Bảo mật (Gateway)**: Sử dụng CORS và Helmet để bảo mật ứng dụng Express. Quản lý chặt chẽ phân quyền bằng JWT (Authentication & Authorization).
4. **Data Integrity**: Bắt buộc sử dụng Transaction (thông qua MySQL Database Pool) cho các thao tác ghi/cập nhật dữ liệu từ 2 bảng trở lên để bảo vệ tính toàn vẹn ACID.
5. **Fallback & Validation Loop**: Tuân thủ nguyên tắc `Plan → Validate → Execute`. Nếu việc test script, gọi API, thiết lập cấu hình gặp lỗi 3 lần liên tiếp, **DỪNG MỌI HÀNH ĐỘNG** và đợi hướng dẫn từ User.

# Phần 3: Ranh Giới (Boundaries)
- **Tuyệt đối KHÔNG thay đổi** hoặc chỉnh sửa bất kỳ file nào thuộc hệ thống Frontend.
- **Quy ước Tham chiếu Frontend**: Hệ thống Frontend là "Source of Truth" về yêu cầu giao diện và Payload. Chủ động dò tìm các endpoint Frontend đang gọi, nếu nó chưa có trong hệ thống Back-end hãy tự động bổ sung tạo mới để bù đắp khoảng trống, bảo đảm Front-end chạy hoàn hảo.
