# Workflow 1: Xây dựng Tính năng/Page mới
1. Xác định thiết kế tổng quan (Wireframe/Mockup tưởng tượng).
2. Tách nhỏ bài toán thành các phân mảnh cấu phần (Atomic Components).
3. Code layout vỏ trước (Hard-code data) để duyệt thẩm mỹ trực quan.
4. Tích hợp Backend API và nối dữ liệu thật (State & Hooks).

# Workflow 2: Triển khai Authentication UI (Role-based)
1. Xác định Middleware/Route Guards để tách luồng User thông thường và Admin Dashboards.
2. Tổ chức Context/State lưu trữ quyền thống nhất.

# Workflow 3: Xử lý phần cứng (Webcam / Biometrics)
1. Cấp quyền Hardware hợp lý cho người dùng.
2. Thiết kế giao diện quay/chụp để UI không bị giật lag, đảm bảo phản hồi tức thì và không bị tràn bộ nhớ trình duyệt khi dùng luồng MediaStream.
