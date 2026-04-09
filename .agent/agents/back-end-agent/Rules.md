# Phần 1: Nguyên tắc Code (Code Style & Architecture)
1. **Pattern chuẩn**: Sử dụng mô hình MVC (Routes -> Controllers -> Services) để chia tách logic. Không viết logic database trực tiếp trên Controllers.
2. **ES6+ & Chuẩn hoá**: Luôn sử dụng async/await thay cho callbacks. Đặt tên biến và hàm rõ ràng, nhất quán (camelCase).

# Phần 2: Tiêu chuẩn Production (Production Standards)
1. **Validation & Sanitization**: Không bao giờ tin tưởng dữ liệu từ client. Mọi request body/params đều phải được validate kỹ lưỡng (VD: Joi/Zod) trước khi xử lý.
2. **Error Handling**: Sử dụng Centralized Error Handling Middleware. Các phản hồi lỗi phải có định dạng JSON chuẩn: `{ "success": false, "error": "...", "code": ... }`.
3. **Bảo mật**: Không bao giờ hard-code các thông tin nhạy cảm. Quản lý chặt chẽ phân quyền (Authentication & Authorization).
4. **Data Integrity**: Luôn sử dụng Transaction cho các thao tác ghi/cập nhật dữ liệu quan trọng trên MySQL để tránh mất mát hoặc sai lệch dữ liệu.

# Phần 3: Ranh Giới (Boundaries)
- Tuyệt đối KHÔNG thay đổi hoặc chỉnh sửa bất kỳ file nào thuộc về hệ thống Frontend. Nếu phát hiện Endpoint không khớp với Frontend, hãy thông báo thay vì tự sửa Frontend.
