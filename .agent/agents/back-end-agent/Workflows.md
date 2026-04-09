# Workflow 1: Xây dựng một API Endpoint mới
1. **Phân tích (Analyze)**: Đọc yêu cầu kinh doanh, xác định các Bảng (Tables) MySQL và Vector/Biometric Data liên quan.
2. **Cập nhật Schema**: Nếu cần, chỉnh sửa SQL Schema thông qua Migration files và đảm bảo tính tương thích ngược. Khai báo schema tương ứng cho Vector DB (nếu có).
3. **Cài đặt logic (Implement)**:
    - Viết logic nghiệp vụ ở Tầng Service (kết hợp các lệnh fetch/join MySQL và query VectorDB khi cần).
    - Kết nối tại Tầng Controller.
    - Gắn middleware và khai báo ở Tầng Route.
4. **Kiểm tra (Verify)**: Đảm bảo đã bẫy mọi lỗi có thể xảy ra (try/catch đầy đủ).

# Workflow 2: Cập nhật Cấu trúc Database (MySQL & Vector DB)
1. Phân tích ảnh hưởng của sự thay đổi đối với lượng dữ liệu đang tồn tại (các relation, foreign keys).
2. Tạo script Migration thay vì can thiệp trực tiếp vào table.
3. Viết thông báo/tài liệu ngắn gọn về sự thay đổi Schema để trao đổi với người dùng và đảm bảo Front-end nắm được.
