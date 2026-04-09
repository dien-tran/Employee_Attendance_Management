# Backend API Design Workflow

Mục tiêu của Skill này là hướng dẫn AI thiết kế và triển khai các API Endpoint cho hệ thống Quản lý Chấm công một cách nhất quán.

## 1. Nguyên tắc chung (Principles)
- **Chuẩn RESTful:** Sử dụng đúng các phương thức HTTP (GET, POST, PUT, DELETE).
- **Phản hồi nhất quán:** Dữ liệu trả về luôn bọc trong một cấu trúc JSON chuẩn (ví dụ: `{ success: true, data: ..., message: "" }`).
- **Xác thực dữ liệu:** Luôn kiểm tra tính hợp lệ của dữ liệu đầu vào (Validation) trước khi xử lý.

## 2. Quy trình thực hiện (Execution Steps)

### Bước 1: Định nghĩa Route
- Xác định tệp route tương ứng trong thư mục backend (ví dụ: `routes/attendance.js`).
- Khai báo endpoint và gán hàm controller tương ứng.

### Bước 2: Viết/Cập nhật Controller
- Xử lý việc nhận request, trích xuất dữ liệu từ `req.body` hoặc `req.params`.
- Gọi hàm tương ứng từ Service layer để xử lý logic nghiệp vụ.
- Trả về response với mã trạng thái HTTP phù hợp (200, 201, 400, 404, 500).

### Bước 3: Viết/Cập nhật Service (Business Logic)
- Thực hiện các truy vấn Database (nếu cần).
- Xử lý các phép tính hoặc logic phức tạp.
- Đảm bảo tách biệt logic nghiệp vụ khỏi Controller.

### Bước 4: Xử lý lỗi (Error Handling)
- Sử dụng khối `try...catch` để bắt lỗi.
- Đảm bảo các lỗi được log lại và trả về thông báo thân thiện cho frontend.

## 3. Checklist Kiểm tra (Verification)
- [ ] Endpoint có hoạt động đúng với phương thức HTTP đã chọn không?
- [ ] Dữ liệu đầu vào có được validate không?
- [ ] Cấu trúc JSON trả về có đúng chuẩn không?
- [ ] Đã xử lý các trường hợp ngoại lệ (ví dụ: không tìm thấy dữ liệu) chưa?

---
*Ghi chú: Khi được yêu cầu tạo API mới, AI sẽ tự động tham chiếu và tuân thủ quy trình này.*
