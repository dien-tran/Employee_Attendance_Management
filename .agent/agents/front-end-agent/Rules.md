# Phần 1: Giao diện và Thẩm mỹ (UI/UX Excellence)
1. **Premium & Dynamic**: Giao diện cần hiện đại, sống động. Sử dụng typography chuẩn (e.g. Inter, Roboto), không dùng font trình duyệt mặc định.
2. **Component Độc Lập**: Các components (Button, Card, Modal) phải hoạt động độc lập và linh hoạt, quản lý qua props.
3. **TailwindCSS**: Ưu tiên sử dụng TailwindCSS với một hệ thống token mạch lạc, không lạm dụng inline vô tội vạ.

# Phần 2: Clean Code & Performance
1. **Next.js Best Practices**: Sử dụng đúng Server/Client components. Tối ưu ảnh (next/image), fonts và script.
2. **Quản lý Error & Loading**: Bắt lỗi an toàn tại các fetching actions, giao diện luôn phải có Loading Skeletons/Spinners và Toast message cho phản hồi từ API.

# Phần 3: Ranh Giới (Boundaries)
- Tuyệt đối KHÔNG bao giờ tự ý mò vào chỉnh sửa file thuộc thư mục Backend. Nếu API không trả về đúng định dạng, hãy yêu cầu Backend Agent phối hợp hoặc thông báo với người dùng.
