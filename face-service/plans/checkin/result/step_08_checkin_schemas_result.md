# Step 08 Result - Check-in WebSocket Schemas

## Trang thai

DONE

## File da tao

- `app/schemas/checkin.py`
- `plans/checkin/result/step_08_checkin_schemas_result.md`

## Noi dung da thuc hien

- Tao request schema `AttendanceFrameMessage`.
- Tao response schemas:
  - `ProcessingFrameResponse`
  - `RejectedFrameResponse`
  - `UnknownFaceResponse`
  - `AttendanceSessionResponse`
  - `CheckinErrorResponse`
- Tao overlay model `CheckinEmployeeOverlay`.
- Tao parser helper `parse_attendance_frame_message(payload)`.
- Tao `CheckinMessageValidationError` de validation error co the doi thanh payload co cau truc.

## Quyet dinh ky thuat

- Request contract:
  - `action`: literal `"attendance_frame"`.
  - `type`: literal `"checkin"` hoac `"checkout"`.
  - `image`: JPEG data URL hoac raw base64 string.
- Schema khong decode image; decode se lam trong pipeline.
- Neu `image` la data URL thi schema reject cac media type khac JPEG/JPG.
- Dung `extra="forbid"` de reject field du, theo pattern enrollment.
- Response models co cac field frontend dung cho overlay:
  - `face_bbox`
  - `employee`
  - `message`
  - `attendance_status`
- `to_websocket_payload()` dung `model_dump(mode="json", exclude_none=True)` de payload JSON-safe.
- `CheckinMessageValidationError` la tam thoi trong schema layer; step 09 se them `CheckinError` vao `app/core/exceptions.py`.

## Kiem tra da chay

- `python -m compileall -q app/schemas/checkin.py`
- Parse payload hop le:
  - `{"action":"attendance_frame","type":"checkin","image":"data:image/jpeg;base64,/9j/abc"}`
- Kiem tra response JSON-safe:
  - `AttendanceSessionResponse(...).to_websocket_payload()`
- Kiem tra invalid payload:
  - Extra field bi reject thanh `ERROR / INVALID_MESSAGE`.
  - `data:image/png;base64,...` bi reject thanh `ERROR / INVALID_MESSAGE`.

## Ghi chu

- Chua sua `app/core/exceptions.py` trong step nay vi step 09 da tach rieng cho `CheckinError`.
