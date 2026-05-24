# Frontend Enrollment WebSocket Plan

## Mục tiêu

Nối frontend test/prototype với backend WebSocket enrollment.

File chính:

```text
frontend/src/app/page.tsx
```

File liên quan:

```text
frontend/src/app/layout.tsx
frontend/src/app/globals.css
```

---

## UI Input

Frontend có các field:

- `employee_id`
- `full_name`
- `date_of_birth`

`date_of_birth` dùng input type `date`, nên browser trả format ISO `YYYY-MM-DD`, khớp schema backend.

---

## WebSocket

Endpoint mặc định:

```text
ws://127.0.0.1:8000/api/v1/enroll/ws
```

Có thể override bằng env:

```text
NEXT_PUBLIC_ENROLLMENT_WS_URL=ws://127.0.0.1:8000/api/v1/enroll/ws
```

---

## Luồng Gửi Frame

Khi bấm `Bắt Đầu`:

1. Mở WebSocket.
2. Gửi frame đầu tiên ngay khi socket open.
3. Sau đó gửi mỗi `600ms`.
4. Frame được capture từ `<video>` bằng `<canvas>`.
5. Frontend yêu cầu browser ưu tiên camera vertical/portrait bằng constraint `width: 720`, `height: 960`, `aspectRatio: 3/4`.
6. Trước khi gửi, frontend đặt frame camera vào canvas portrait `3:4` kích thước `480x640`.
   - Nếu webcam là landscape, dùng fit/contain để giữ toàn bộ frame thay vì center-crop phóng to mặt.
   - Nền phần dư dùng xám trung tính.
7. Preview hiển thị chính canvas `480x640` này, không hiển thị raw `<video>`, để bbox backend trả về khớp 1:1 với UI.
8. Canvas encode thành JPEG data URL:

```ts
canvas.toDataURL('image/jpeg', 0.95)
```

Lý do giữ portrait `3:4`: MiniFASNet/Silent-Face-Anti-Spoofing khá nhạy với tỉ lệ frame đầu vào. Webcam laptop thường là landscape `16:9`, trong khi luồng tham chiếu upstream dùng frame kiểu camera portrait. Tuy nhiên center-crop landscape sang portrait có thể phóng to mặt quá mức; khi đó `crop_boxes` anti-spoofing bị clamp gần full frame và score live tụt rất thấp.

Payload gửi backend:

```json
{
  "action": "capture",
  "employee_id": "NV001",
  "full_name": "Nguyen Van A",
  "date_of_birth": "1998-04-21",
  "image": "data:image/jpeg;base64,/9j/..."
}
```

---

## Response Handling

Frontend xử lý:

- `GOOD_FRAME`: cập nhật progress `accepted_count/required_count`.
- `GOOD_FRAME`: đọc thêm `anti_spoof_score` và hiển thị thành phần trăm anti-spoofing accuracy.
- `GOOD_FRAME`: đọc `face_bbox` để vẽ bounding box trên video preview.
- `REJECTED`: hiển thị `reason`, giữ session tiếp tục.
- `REJECTED` do spoof có thể có `details.live_score`, frontend dùng score này để hiển thị kết quả anti-spoofing vừa đo.
- `REJECTED` sau khi đã detect được mặt có thể có `details.face_bbox`, frontend vẫn dùng để vẽ box.
- `ENROLLMENT_COMPLETE`: dừng gửi frame, hiển thị `embedding_id`.
- `ENROLLMENT_COMPLETE`: hiển thị thêm trung bình phiên từ `data.anti_spoof_score_avg`.
- `ERROR`: dừng gửi frame.

---

## Cleanup

Khi đóng camera hoặc rời trang:

- clear interval gửi frame;
- close WebSocket;
- stop camera tracks.

Camera stream giữ trong `streamRef` để cleanup không bị stale closure của React state.

---

## Font/Build

Đã bỏ `next/font/google` trong `frontend/src/app/layout.tsx` vì build trong môi trường bị chặn network sẽ fail khi tải Google Fonts.

Thay bằng system font trong CSS:

```css
Arial, Helvetica, sans-serif
```

---

## Test

Đã chạy:

```bash
npm run lint
npm run build
```

Kết quả: OK.

---

## Ghi chú

- Frontend này vẫn là UI test/prototype.
- Backend và Qdrant cần chạy trước khi test enrollment thật.
- Browser cần cấp quyền camera.
