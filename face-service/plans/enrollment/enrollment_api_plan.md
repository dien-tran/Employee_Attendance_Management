# Enrollment API/WebSocket Plan

## Mục tiêu

Triển khai API layer để frontend gửi frame enrollment qua WebSocket.

Files:

```text
app/api/__init__.py
app/api/v1/__init__.py
app/api/v1/enrollment.py
app/api/v1/router.py
app/main.py
```

---

## Endpoint

Endpoint chuẩn:

```text
ws://localhost:8000/api/v1/enroll/ws
```

Trong code:

```python
@router.websocket("/enroll/ws")
async def enroll_websocket(websocket: WebSocket) -> None:
    ...
```

`app/main.py` include router với prefix:

```python
app.include_router(api_router, prefix="/api/v1")
```

---

## Luồng WebSocket

Khi frontend connect:

1. Backend `accept()` connection.
2. Backend gọi `create_enrollment_pipeline()`.
3. Mỗi connection có một pipeline/session riêng.
4. Các model service bên trong pipeline vẫn là singleton từ `dependencies.py`.
5. Frontend gửi JSON frame.
6. Endpoint gọi:

```python
response = pipeline.handle_capture_payload(payload)
await websocket.send_json(response)
```

7. Nếu response là `GOOD_FRAME` hoặc `REJECTED`, connection tiếp tục nhận frame.
8. Nếu response là `ENROLLMENT_COMPLETE` hoặc `ERROR`, backend đóng connection.

---

## Client Message

```json
{
  "action": "capture",
  "employee_id": "NV001",
  "full_name": "Nguyen Van A",
  "date_of_birth": "1998-04-21",
  "image": "data:image/jpeg;base64,/9j/..."
}
```

Endpoint chỉ kiểm tra message là JSON object. Schema validation chi tiết nằm trong pipeline/schema.

---

## Responses

Frame tốt:

```json
{
  "status": "GOOD_FRAME",
  "accepted_count": 1,
  "required_count": 10,
  "anti_spoof_score": 0.94,
  "face_bbox": [120.5, 80.0, 320.0, 340.25],
  "message": "Frame đạt chất lượng (1/10)"
}
```

Frame bị loại:

```json
{
  "status": "REJECTED",
  "reason": "BLUR",
  "accepted_count": 3,
  "required_count": 10,
  "message": "Ảnh bị mờ, vui lòng giữ yên camera"
}
```

Hoàn tất:

```json
{
  "status": "ENROLLMENT_COMPLETE",
  "success": true,
  "message": "Đăng ký khuôn mặt thành công",
  "data": {
    "embedding_id": "a1b2c3d4",
    "employee_id": "NV001",
    "full_name": "Nguyen Van A",
    "date_of_birth": "1998-04-21",
    "num_frames_used": 10,
    "anti_spoof_score_avg": 0.95,
    "quality_score_avg": 0.91
  }
}
```

---

## Main App

`app/main.py` có:

- `create_app()`;
- CORS middleware cho frontend test;
- `/health` endpoint nhẹ, không load model;
- include `/api/v1`.

Chạy server:

```bash
uvicorn app.main:app --reload
```

Health check:

```text
GET /health
```

trả:

```json
{"status": "ok"}
```

---

## Test

Compile:

```bash
python -m py_compile app/api/__init__.py app/api/v1/__init__.py app/api/v1/enrollment.py app/api/v1/router.py app/main.py
```

Smoke:

- import `app.main:app`;
- route `/health` tồn tại;
- route `/api/v1/enroll/ws` tồn tại;
- `TestClient(app).get("/health")` trả `{"status": "ok"}`.

Không test WebSocket full flow ở bước này vì connect sẽ khởi tạo model thật.

---

## Ghi chú

- API layer không tự xử lý AI logic.
- API layer không tự decode ảnh.
- API layer không tự lưu Qdrant.
- Tất cả logic enrollment nằm trong `EnrollmentPipeline`.
