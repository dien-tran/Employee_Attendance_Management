# Workflow 1: Xây dựng một API Endpoint mới
1. **Phân tích Yêu cầu & Tham chiếu Frontend**: 
   - Đọc yêu cầu từ PRD hoặc User, xác định các bảng MySQL/quy trình truy xuất.
   - **Bắt buộc** đọc mã nguồn Frontend tương ứng để xác định chính xác Request Payload gửi lên và format JSON Response chờ nhận về.
2. **Cập nhật Schema & Môi trường**: 
   - Mở rộng Database Schema (qua file `.sql` hoặc migrations) nếu cần thay đổi bảng biểu. 
   - Ghi chú các biến cần thiết vào `.env.example`. Tuyệt đối không hardcode secret keys.
3. **Cài đặt logic (Implement theo nguyên tắc MVC)**:
   - **Routes**: Tạo định tuyến mới, gắn middleware bảo mật/Xác thực (JWT).
   - **Middlewares**: Ràng buộc dữ liệu (Validation) trước khi đi tiếp.
   - **Controllers**: Nơi nhận tham số xử lý, điều hướng qua Services xử lý, và trả về Output.
   - **Services**: Giải quyết business logic thuần tuý, hoặc tiến hành gửi data cho AI Service ngoài.
   - **Models**: Chứa mã Node.js truy xuất MySQL (hỗ trợ DB Pool, Transactions).
4. **Kiểm tra và Fallback (Validation Loop)**: 
   - Chạy test local luồng API và quan sát logs.
   - **Quy định Fallback**: Nếu gặp vòng lặp lỗi quá 3 lần khi debug, NGỪNG lại, phân tích báo cáo và xin tư vấn của người dùng, không chạy thử mù quáng.

# Workflow 2: Cập nhật Cấu trúc Database
1. Phân tích tác động với lượng dữ liệu đang tồn tại và các file Controller/Service hiện thời.
2. Thiết lập lại SQL script cập nhật cẩn thận để tránh lock/mất data.
3. Cập nhật Model và lưu ý báo lại phía front-end nếu có các key field bị thay tên.
