# Integration Test Plan

## Mục tiêu

Kiểm tra backend enrollment đã sẵn sàng chạy tích hợp sau khi có API/WebSocket.

---

## Các kiểm tra đã thực hiện

Compile toàn bộ app:

```bash
python -m compileall -q app
```

Kết quả: OK.

Import app và route:

```python
from app.main import app
```

Đã xác nhận:

- `/health` tồn tại;
- `/api/v1/enroll/ws` tồn tại;
- `GET /health` trả `{"status": "ok"}`.

Khởi tạo service singleton:

```python
from app.core.dependencies import get_service_container

services = get_service_container()
```

Kết quả:

- runtime: CPU;
- InsightFace `buffalo_l` load được 5 ONNX model;
- anti-spoofing load được 2 MiniFASNet weights;
- embedding dim: 512;
- Qdrant config: `localhost:6333`, collection `face_embeddings`.

---

## Docker/Qdrant

Đã chạy:

```bash
docker compose ps
```

Kết quả hiện tại: chưa kết nối được Docker daemon.

Lỗi ngoài sandbox:

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

Điều này thường nghĩa là Docker Desktop chưa chạy hoặc daemon chưa sẵn sàng.

Sau khi Docker/Qdrant chạy lại, đã kiểm tra trực tiếp Qdrant REST:

```text
GET http://127.0.0.1:6333/
```

Kết quả: Qdrant trả version `1.18.0`.

Đã test `VectorDBService` với Qdrant thật:

- `ensure_collection()` tạo/đảm bảo collection `face_embeddings`;
- upsert vector giả đã L2-normalized;
- retrieve lại payload thành công;
- `date_of_birth` lưu đúng;
- xóa point test sau khi kiểm tra.

Lưu ý phát hiện trong integration:

- Qdrant không nhận point ID string tự do.
- Point ID hợp lệ là unsigned integer hoặc UUID string.
- `VectorDBService` đã validate `point_id` sớm để lỗi rõ hơn.

---

## Cách test end-to-end khi Docker sẵn sàng

1. Bật Docker Desktop.

2. Start Qdrant:

```bash
docker compose up -d qdrant
```

3. Kiểm tra Qdrant:

```bash
docker compose ps
```

4. Start backend:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

5. Health check:

```text
http://127.0.0.1:8000/health
```

6. WebSocket endpoint:

```text
ws://127.0.0.1:8000/api/v1/enroll/ws
```

7. Gửi các frame từ frontend hoặc WebSocket client theo payload:

```json
{
  "action": "capture",
  "employee_id": "NV001",
  "full_name": "Nguyen Van A",
  "date_of_birth": "1998-04-21",
  "image": "data:image/jpeg;base64,/9j/..."
}
```

8. Kỳ vọng:

- frame lỗi trả `REJECTED`;
- frame tốt trả `GOOD_FRAME`;
- đủ frame tốt trả `ENROLLMENT_COMPLETE`;
- Qdrant có point mới trong collection `face_embeddings`.

---

## Ghi chú

- Backend health route không load model.
- WebSocket connect sẽ gọi `create_enrollment_pipeline()`, khi đó model singleton sẽ load nếu chưa load.
- Enrollment complete cần Qdrant đang chạy, vì pipeline gọi `VectorDBService.ensure_collection()` và `upsert_face_embedding(...)`.
