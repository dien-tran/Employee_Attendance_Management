## Quy tắc Kiến trúc Microservices (Microservices Architecture Rules)

1. **Luật về Giao tiếp (Inter-service Communication):**
   - Core Service KHÔNG ĐƯỢC import các thư viện JWT. 
   - Nó chỉ lấy thông tin user đăng nhập thông qua Header `X-User-Id` (VD: `request.getHeader("X-User-Id")`) do tầng API Gateway bóc tách và truyền xuống.

2. **Luật về Database (Database Isolation):**
   - Mỗi service có một cấu hình DB hoàn toàn riêng biệt (VD: `auth_db`, `core_db`).
   - TUYỆT ĐỐI không được phép Join bảng (SQL Join) chéo hệ thống, ví dụ giữa bảng `User` (thuộc Auth) và `Attendance` (thuộc Core). 
   - Nếu Core cần thông tin chi tiết của User, hãy thực hiện gọi API nội bộ (thông qua RestTemplate, WebClient hoặc OpenFeign) sang Auth Service.

3. **Luật về Triển khai (Deployment / Docker):**
   - Mỗi service Spring Boot khi khởi tạo phải kèm theo một `Dockerfile` (sử dụng Multi-stage build: dùng `maven:3.9.6-eclipse-temurin-21` để build và `eclipse-temurin:21-jre-jammy` để chạy).
   - Tất cả các service phải được tích hợp chung vào file `docker-compose.yml` ở thư mục gốc. Đảm bảo cấu hình chung mạng (network), các biến môi trường kết nối Eureka và Database.

4. **Luật về Kiểm thử (Testing Guidelines):**
   - **Unit Test:** Bắt buộc dùng `JUnit 5` và `Mockito`. Phải mock toàn bộ các dependencies (Repository, OpenFeign, WebClient). KHÔNG khởi tạo `@SpringBootTest` để test chạy nhanh và độc lập DB.
   - **Integration Test & API Test:** Sử dụng `@SpringBootTest` và `MockMvc`.
   - **Quản lý Môi trường:** Sử dụng **Testcontainers** để tự động cấp phát DB khi test. Nếu không dùng Testcontainers, BẮT BUỘC yêu cầu User chạy `docker-compose up -d` bật DB trước khi chạy `mvn test`.
   - **Chạy Test (Dockerized Test):** TUYỆT ĐỐI không chạy `mvn test` hay `./mvnw test` trực tiếp trên máy local để tránh phụ thuộc phiên bản Java local. BẮT BUỘC mượn Docker Image chứa Maven để chạy. Cú pháp bắt buộc: `docker run --rm -v "${PWD}/<tên-module>:/app" -w /app maven:3.9.6-eclipse-temurin-21 mvn clean test` (Nếu Agent chạy trên Windows CMD, tự động thay `${PWD}` bằng `%cd%`).
   - **Quy trình Test API tự động:** KHÔNG khởi động server để test thủ công bằng `curl`. BẮT BUỘC viết file test dùng `@WebMvcTest` hoặc `@SpringBootTest` kết hợp `MockMvc`. Dùng `memory_bank/API_Endpoint.md` làm Nguồn Sự Thật (Source of Truth).
