# Step 13 — Frontend Check-in Page

## Mục tiêu

Tạo trang `/checkin` cho check-in/check-out realtime bằng camera.

## File dự kiến

- `frontend/src/app/checkin/page.tsx` mới.
- Có thể refactor helper camera nếu cần, nhưng phải preview trước.

## Nội dung chính

- Toggle `checkin` / `checkout`.
- Mở camera.
- Hiển thị preview bằng canvas.
- Gửi frame qua WebSocket mỗi `frame_interval_ms`.
- Vẽ bbox overlay theo tọa độ backend.
- Hiển thị kết quả trực tiếp trên camera.

## Camera ratio cần duyệt

Đề xuất theo thiết bị:

- Laptop/webcam ngang: `4:3`, `640x480`.
- Kiosk/phone dọc: `3:4`, `480x640`.

Hiện enrollment page đã chỉnh về `4:3` để hợp webcam laptop.

## WebSocket payload

```json
{
  "action": "attendance_frame",
  "type": "checkin",
  "image": "data:image/jpeg;base64,/9j/..."
}
```

## Status cần xử lý

- `PROCESSING`.
- `REJECTED`.
- `UNKNOWN_FACE`.
- `ATTENDANCE_SUCCESS`.
- `ALREADY_RECORDED`.
- `CHECKOUT_WITHOUT_CHECKIN`.
- `EMPLOYEE_INACTIVE`.
- `ERROR`.

## Comment bắt buộc

- Hàm capture canvas: input video frame, output base64 JPEG.
- Hàm gửi WebSocket: payload gửi backend.
- Handler response: status nào terminal, status nào tiếp tục session.
- Camera ratio: vì sao chọn 4:3 hoặc 3:4.

## Tiêu chí nghiệm thu

- `npm run lint` pass.
- `npm run build` pass.
- Camera frame không lệch như lỗi trước.
- Result overlay nằm trên camera, không cần panel ngoài cho trạng thái chính.

