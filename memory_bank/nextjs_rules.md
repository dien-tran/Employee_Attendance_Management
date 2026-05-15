# NEXT.JS & FRONTEND INTEGRATION RULES (TOKEN OPTIMIZATION)

Tài liệu này chứa các quy tắc chi tiết khi Agent làm việc với Frontend (Next.js/React). BẮT BUỘC tuân thủ để tối ưu hóa Token và đảm bảo chuẩn kiến trúc.

## 1. GIỚI HẠN BỐI CẢNH (CONTEXT LIMITATION)
- **Không đọc tràn lan:** TUYỆT ĐỐI KHÔNG dùng lệnh đọc toàn bộ nội dung file `memory_bank/API_Endpoint.md` hay quét toàn bộ thư mục `app/`.
- **Tìm kiếm mục tiêu:** Khi cần tìm API cho một task, BẮT BUỘC dùng lệnh `grep` để lấy đúng đoạn cần thiết. VD: `grep -A 15 "POST /api/auth/login" memory_bank/API_Endpoint.md`.
- **Focus Component:** Chỉ mở và đọc đúng các file UI/Component liên quan trực tiếp đến Task.

## 2. KIẾN TRÚC GỌI API (API CLIENT)
- **Centralized Config:** Chỉ cấu hình API Client (Axios hoặc Fetch) ở duy nhất một nơi (VD: `lib/api-client.ts`).
- **Gateway Base URL:** Mọi request đều bắt buộc trỏ về API Gateway: `http://localhost:8080`. KHÔNG gọi thẳng vào các Microservices.
- **Credentials:** Cấu hình API Client luôn gửi kèm HttpOnly Cookie (Axios: `withCredentials: true`, Fetch: `credentials: 'include'`).
- **Bảo Mật:** KHÔNG ĐƯỢC lưu JWT Token vào `localStorage`. Hệ thống dùng HttpOnly Cookie từ Backend.

## 3. STATE MANAGEMENT (ZUSTAND)
- Quản lý Global State (thông tin User đăng nhập, Theme) ưu tiên sử dụng Zustand.
- Store Auth cơ bản cần lưu trữ: `isAuth` (boolean) và `user` (id, email, name, role).

## 4. QUY TRÌNH TÍCH HỢP BẮT BUỘC (INTEGRATION WORKFLOW)
1. **Types/Interfaces:** Định nghĩa DTO Request/Response TypeScript khớp với Backend.
2. **Services Layer:** Viết các hàm gọi API tách biệt hoàn toàn khỏi giao diện, gom nhóm tại thư mục `services/` (VD: `services/auth.service.ts`).
3. **UI Integration:** Import service vào UI Component. Thay thế Mock Data bằng hàm lấy dữ liệu thật.
4. **UX Handling:** Bắt buộc phải xử lý đủ 3 trạng thái: `Loading`, `Success`, `Error` (dùng thư viện Toast notification đang có).

## 5. BẢO VỆ UI (UI PROTECTION)
- Giao diện, CSS, Layout và các thư viện UI (Tailwind, Framer Motion, Radix) đã được đội thiết kế chốt.
- TUYỆT ĐỐI KHÔNG tự ý cấu trúc lại HTML/CSS, refactor style, hay thay đổi UI Component nếu Task không yêu cầu cụ thể.
- **Framer Motion Types:** Nếu có cảnh báo lỗi Type của thư viện Framer Motion khi truyền props, BẮT BUỘC dùng `as any` hoặc `@ts-ignore` để bypass. Đừng cố gắng sửa library core, hãy tập trung vào Data Fetching API.

## 6. KIỂM THỬ END-TO-END (E2E TESTING)
- BẮT BUỘC tuân thủ các quy tắc về kiểm thử Playwright đã được định nghĩa riêng biệt.
- **Liên kết Rules:** Khi có Task yêu cầu viết E2E Test, cấu hình Playwright hoặc tạo kịch bản Automation UI, Agent BẮT BUỘC phải mở, đọc và tuân thủ chặt chẽ các luật trong file `memory_bank/e2e_testing_rules.md`.