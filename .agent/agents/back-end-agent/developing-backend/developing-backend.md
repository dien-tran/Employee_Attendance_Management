---
name: developing-backend
description: Develops backend features for the Employee Attendance Management System using MVC architecture, MySQL pools, and robust gateway security. Triggered for backend API tasks.
---

# Developing Backend for Employee Attendance Management

## When to use this skill
- Khi người dùng yêu cầu khởi tạo hoặc xây dựng các API, tính năng Backend cho Hệ thống Quản lý Chuyên cần.
- Khi cần thiết lập kiến trúc dự án, kết nối cơ sở dữ liệu hoặc triển khai các module mới.
- Khi cần rà soát hoặc củng cố các lớp bảo mật (CORS, Helmet) và xử lý lỗi global.

## Workflow

- [ ] **Bước 1: Khởi tạo và thiết lập cấu trúc MVC**
  - Tuân thủ nghiêm ngặt mô hình cấu trúc phân rã chức năng:
    - `routes/`: Chỉ có nhiệm vụ định tuyến các API endpoints.
    - `controllers/`: Chỉ nhận thông tin từ Request, gọi qua Services để xử lý và trả về Response.
    - `services/`: Nơi duy nhất chứa logic nghiệp vụ (business logic) cốt lõi của hệ thống.
    - `models/`: Đảm nhiệm việc giao tiếp trực tiếp với cơ sở dữ liệu (các truy vấn SQL).
    - `middlewares/`: Chứa các bộ lọc chặn (authentication, validation, error handler).

- [ ] **Bước 2: Cài đặt kết nối MySQL & Database Pool**
  - Cấu hình file kết nối cơ sở dữ liệu với MySQL.
  - Bắt buộc phải sử dụng cơ chế **Database Pool** (ví dụ thông qua `mysql2`) để quản lý kết nối hiệu quả, không dùng kết nối đơn lẻ (single connection).

- [ ] **Bước 3: Tích hợp bảo mật tầng cổng (Gateway Security)**
  - Tích hợp và cấu hình **CORS** middleware để ngăn chặn các request từ các nguồn không đáng tin cậy.
  - Tích hợp **Helmet** middleware nhằm bảo vệ các HTTP headers tránh khỏi các rủi ro bảo mật website phổ biến.
  - Triển khai **Global Error Handler**: Mọi lỗi sinh ra tại Controller/Service đều phải được đẩy về `errorHandler` ở Middleware để xử lý tập trung và trả về format chuẩn cho Frontend, không bao giờ để lọt stack trace ra ngoài production.

- [ ] **Bước 4: Xác thực & Fallback (Validation Loop)**
  - Áp dụng triết lý vòng lặp: **Plan → Validate → Execute**. Hãy lên mô hình logic, kiểm tra trước rồi mới viết mã khối lượng lớn.
  - **Quy định Fallback tuyệt đối:** Nếu trong quá trình validation, test script hoặc logic bị lỗi quá 3 lần liên tiếp, hệ thống agent **BẮT BUỘC DỪNG MỌI HÀNH ĐỘNG** và thông báo ngay cho con người phân tích. Không cố thử sai vô hạn.

## Tư duy & Quy định Security Context

- **KHÔNG BAO GIỜ HARDCODE CẤU HÌNH:** Mọi thông tin nhạy cảm bao gồm mật khẩu kết nối database, username, host, hay các secret keys **tuyệt đối không được gán thẳng vào code**.
- Bắt buộc phải sử dụng các biến tham chiếu từ môi trường. Mọi tham số cần thiết đều phải lấy từ `process.env.*`.
- Các biến môi trường này bao giờ cũng nên có document hướng dẫn trong file `.env.example`.

## Resources
- Sử dụng các thư viện phổ biến và chuẩn mực cho hệ sinh thái Node/Express: `express`, `mysql2`, `cors`, `helmet`.
