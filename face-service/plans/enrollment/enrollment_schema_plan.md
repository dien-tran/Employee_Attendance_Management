# Enrollment Schema Plan

## Mục tiêu

Triển khai schema Pydantic cho message WebSocket enrollment và response cơ bản.

File chính:

```text
app/schemas/enrollment.py
```

---

## Input Message

Frontend gửi:

```json
{
  "action": "capture",
  "employee_id": "NV001",
  "full_name": "Nguyen Van A",
  "date_of_birth": "1998-04-21",
  "image": "data:image/jpeg;base64,/9j/..."
}
```

Schema:

```python
EnrollmentCaptureMessage
```

Field:

- `action`: chỉ nhận `"capture"`.
- `employee_id`: mã nhân viên, không được rỗng.
- `full_name`: họ tên nhân viên, không được rỗng.
- `date_of_birth`: ngày sinh dạng ISO `YYYY-MM-DD`.
- `image`: chuỗi base64 hoặc data URL base64, không được rỗng.

---

## Helper Parse

API/WebSocket nên dùng:

```python
from app.schemas.enrollment import parse_enrollment_capture_message

message = parse_enrollment_capture_message(raw_payload)
```

Nếu payload sai schema, helper sẽ raise:

```python
EnrollmentError(code="INVALID_MESSAGE", per_frame=False)
```

`details["errors"]` đã được sanitize để JSON-serializable, tránh lỗi khi gọi `websocket.send_json(...)`.

---

## Metadata

Schema có:

```python
message.to_employee_metadata()
```

Output:

```python
{
    "employee_id": "NV001",
    "full_name": "Nguyen Van A",
    "date_of_birth": "1998-04-21",
}
```

Pipeline sẽ bổ sung:

- `enrolled_at`
- `num_frames_used`
- `anti_spoof_score_avg`
- `quality_score_avg`
- `model_version`

trước khi gọi `VectorDBService.upsert_face_embedding(...)`.

---

## Response Models

File schema có các response model:

- `GoodFrameResponse`
- `RejectedFrameResponse`
- `EnrollmentCompleteData`
- `EnrollmentCompleteResponse`
- `EnrollmentErrorResponse`

Helper:

```python
error_to_response(error)
```

dùng để convert `EnrollmentError` thành Pydantic response khi API layer muốn validate payload trước khi `send_json`.

---

## Test

Compile:

```bash
python -m py_compile app/schemas/enrollment.py
```

Smoke test:

- payload hợp lệ parse OK;
- `employee_id` được strip whitespace;
- `date_of_birth: "1998-04-21"` giữ đúng ISO;
- `date_of_birth: "21/04/1998"` raise `INVALID_MESSAGE`;
- thiếu field bắt buộc raise `INVALID_MESSAGE`;
- validation error details serialize được bằng `json.dumps(...)`;
- `error_to_response(invalid_image(...))` trả `RejectedFrameResponse`;
- `error_to_response(invalid_message(...))` trả `EnrollmentErrorResponse`.

---

## Ghi chú

- Schema không decode ảnh.
- Schema không gọi AI model.
- Schema không lưu Qdrant.
- Bước tiếp theo là `app/pipeline/enrollment.py`, nơi nối các service: decode ảnh, detection, anti-spoofing, quality, embedding, average, lưu Qdrant.
