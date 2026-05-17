# Core Exceptions Plan

## Mục tiêu

Triển khai lớp lỗi dùng chung cho enrollment để pipeline và WebSocket trả feedback thống nhất.

File chính:

```text
app/core/exceptions.py
```

---

## Vì sao cần bước này

Các service hiện tại trả nhiều loại status riêng:

- Detection: `NO_FACE`, `MULTIPLE_FACES`, `LOW_CONFIDENCE`
- Anti-spoofing: `SPOOF_DETECTED`
- Quality gate: `BLUR`, `TOO_DARK`, `TOO_BRIGHT`, `FACE_TOO_SMALL`, `BAD_POSE`
- Vector DB: lỗi kết nối/upsert Qdrant

Pipeline/WebSocket cần một format chung để frontend hiển thị realtime, ví dụ:

```json
{
  "status": "REJECTED",
  "reason": "BLUR",
  "accepted_count": 3,
  "required_count": 10,
  "message": "Ảnh bị mờ, vui lòng giữ yên camera"
}
```

---

## Interface

Class chính:

```python
EnrollmentError(code, message, details={}, per_frame=True)
```

Ví dụ dùng trong pipeline sau này:

```python
from app.core.exceptions import EnrollmentError

raise EnrollmentError(
    code="NO_FACE",
    message="Không phát hiện khuôn mặt trong ảnh",
    details={"frame_index": 4},
    per_frame=True,
)
```

Convert sang payload WebSocket:

```python
payload = exc.to_websocket_payload(
    accepted_count=accepted_count,
    required_count=required_count,
)
```

---

## Status

Per-frame reject:

- `INVALID_IMAGE`
- `NO_FACE`
- `MULTIPLE_FACES`
- `LOW_CONFIDENCE`
- `SPOOF_DETECTED`
- `BLUR`
- `TOO_DARK`
- `TOO_BRIGHT`
- `FACE_TOO_SMALL`
- `BAD_POSE`

Session/system error:

- `INVALID_MESSAGE`
- `TIMEOUT`
- `VECTOR_DB_ERROR`
- `INTERNAL_ERROR`

---

## Helper Functions

`app/core/exceptions.py` có helper:

- `invalid_message(...)`
- `invalid_image(...)`
- `timeout_error(...)`
- `vector_db_error(...)`
- `internal_error(...)`

Các helper này giúp pipeline tạo lỗi thường gặp nhanh hơn và giữ đúng `per_frame`.

---

## Test

Compile:

```bash
python -m py_compile app/core/exceptions.py
```

Smoke test:

```python
from app.core.exceptions import invalid_image

exc = invalid_image("invalid image", {"field": "image"})
payload = exc.to_websocket_payload(2, 10)

assert payload["status"] == "REJECTED"
assert payload["reason"] == "INVALID_IMAGE"
assert payload["accepted_count"] == 2
assert payload["required_count"] == 10
```

---

## Ghi chú

- Bước này chưa nối pipeline/WebSocket.
- Bước schema kế tiếp sẽ validate message đầu vào như `employee_id`, `full_name`, `date_of_birth`, `image`.
- Bước pipeline sau đó sẽ map kết quả từ detection/anti-spoofing/quality thành `EnrollmentError` khi cần reject frame.
