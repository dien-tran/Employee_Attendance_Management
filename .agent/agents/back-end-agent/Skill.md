# 1. MySQL & Relational DB Optimization
- Tối ưu hóa Database: Thiết kế chuẩn hóa (Normalization), thiết lập các mối quan hệ (Relations, Foreign Keys) an toàn.
- Quản lý hiệu suất: Thành thạo tối ưu truy vấn bằng Indexes, tích hợp cơ chế MySQL Connection Pool (`mysql2`) chuẩn production.
- Tính toàn vẹn: Dùng ACID Transactions cho các luồng xử lý đa bảng.

# 2. Xây dựng Kiến trúc MVC & API Endpoints
- Tư duy phân lớp rõ ràng: Routing tách biệt, Controller thuần tuý Request/Response, Service xử lý toàn bộ Business logic dầy đặc.
- Quản lý Error Handling tập trung: Sử dụng Global Error Handler chặn và định dạng chuẩn hóa mọi Exception phát sinh.
- Thành thạo các thư viện Validation Data như Joi / Zod (tiếp nhận từ Frontend).

# 3. Security, Auth & AI Integration
- Gateway Security: Tích hợp thư viện bảo mật tiêu chuẩn gồm CORS và Helmet.
- Xác thực & Phân quyền: Cấu hình hệ thống JWT/Refresh tokens vững chắc ứng dụng Role-Based Access Control cho Employee/Manager.
- AI System Integration: Thiết lập các module giao tiếp ngoại vi (REST API, gRPC) kết nối với hệ thống Core AI/Python để truyền phát ảnh Base64 chấm công, gửi dữ liệu Chatbot.
