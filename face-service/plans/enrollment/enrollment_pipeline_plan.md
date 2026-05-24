# Enrollment Pipeline Plan

## Mục tiêu

Triển khai pipeline điều phối toàn bộ luồng enrollment multi-frame sau khi các service rời đã sẵn sàng.

File chính:

```text
app/pipeline/enrollment.py
```

---

## Vai trò

`EnrollmentPipeline` chịu trách nhiệm:

1. Validate payload bằng schema.
2. Decode ảnh base64 sang BGR OpenCV.
3. Chạy detection.
4. Chạy anti-spoofing.
5. Chạy quality gate.
6. Extract embedding của frame tốt.
7. Gom đủ `required_good_frames`.
8. Average + L2-normalize final embedding.
9. Tạo Qdrant metadata.
10. Lưu vào Qdrant.
11. Trả response cho WebSocket.

Pipeline không tự load model. Model/service nặng sẽ được tạo ở `core/dependencies.py` trong bước sau và inject vào pipeline.

---

## Interface

Khởi tạo:

```python
pipeline = EnrollmentPipeline(
    detector=face_detector,
    anti_spoofing=anti_spoofing_service,
    quality_gate=quality_gate_service,
    embedding_service=embedding_service,
    vector_db=vector_db_service,
    enrollment_config=config["enrollment"],
    model_config=config["model"],
)
```

Xử lý một frame từ WebSocket:

```python
response = pipeline.handle_capture_payload(raw_payload)
```

`response` là `dict` JSON-safe, có thể gửi thẳng:

```python
await websocket.send_json(response)
```

---

## Session State

`EnrollmentSessionState` lưu:

- `total_frames`
- `employee_metadata`
- `good_embeddings`
- `anti_spoof_scores`
- `quality_scores`
- `completed`

Mỗi WebSocket connection nên dùng một instance pipeline riêng để state không trộn giữa hai nhân viên.

---

## Response

Frame tốt nhưng chưa đủ:

```json
{
  "status": "GOOD_FRAME",
  "accepted_count": 1,
  "required_count": 10,
  "message": "Frame đạt chất lượng (1/10)"
}
```

Frame bị reject:

```json
{
  "status": "REJECTED",
  "reason": "NO_FACE",
  "accepted_count": 0,
  "required_count": 10,
  "message": "Không phát hiện khuôn mặt trong ảnh"
}
```

Hoàn tất:

```json
{
  "status": "ENROLLMENT_COMPLETE",
  "success": true,
  "message": "Đăng ký khuôn mặt thành công",
  "data": {
    "embedding_id": "embedding-id",
    "employee_id": "NV001",
    "full_name": "Nguyen Van A",
    "date_of_birth": "1998-04-21",
    "num_frames_used": 10,
    "anti_spoof_score_avg": 0.96,
    "quality_score_avg": 0.91
  }
}
```

---

## Metadata Qdrant

Pipeline tạo payload:

```python
{
    "employee_id": "NV001",
    "full_name": "Nguyen Van A",
    "date_of_birth": "1998-04-21",
    "enrolled_at": "...",
    "num_frames_used": 10,
    "anti_spoof_score_avg": 0.96,
    "quality_score_avg": 0.91,
    "model_version": "buffalo_l",
}
```

`quality_score_avg` hiện là trung bình `face.det_score` của các frame tốt, đúng với mô tả metadata trong plan chính.

---

## Error Mapping

Pipeline map các service result thành `EnrollmentError`:

- Detection fail: `NO_FACE`, `MULTIPLE_FACES`, `LOW_CONFIDENCE`
- Anti-spoofing fail: `SPOOF_DETECTED`
- Quality fail: `BLUR`, `TOO_DARK`, `TOO_BRIGHT`, `FACE_TOO_SMALL`, `BAD_POSE`
- Decode fail: `INVALID_IMAGE`
- Quá frame: `TIMEOUT`
- Qdrant fail: `VECTOR_DB_ERROR`

---

## Test

Compile:

```bash
python -m py_compile app/pipeline/__init__.py app/pipeline/enrollment.py
```

Smoke test bằng fake services:

- frame tốt đầu tiên trả `GOOD_FRAME`;
- đủ frame trả `ENROLLMENT_COMPLETE`;
- final embedding được normalize trước khi fake vector DB nhận;
- metadata có `date_of_birth`;
- detection `NO_FACE` trả `REJECTED`.

---

## Ghi chú

- Bước này chưa tạo WebSocket endpoint.
- Bước này chưa tạo singleton dependency loader.
- Bước tiếp theo là `app/api/v1/enrollment.py` hoặc `app/core/dependencies.py` + `app/main.py` tùy chọn triển khai API trước hay dependency trước.
