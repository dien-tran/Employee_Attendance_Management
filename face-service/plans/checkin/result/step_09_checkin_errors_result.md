# Step 09 Result - CheckinError and Error Helpers

## Trang thai

DONE

## File da chinh sua

- `app/core/exceptions.py`
- `app/schemas/checkin.py`

## File da tao

- `plans/checkin/result/step_09_checkin_errors_result.md`

## Noi dung da thuc hien

- Them `CheckinErrorCode`.
- Them `CheckinError`.
- Them helper loi:
  - `checkin_invalid_message(...)`
  - `checkin_invalid_image(...)`
  - `checkin_frame_error(...)`
  - `checkin_attendance_error(...)`
  - `checkin_db_error(...)`
  - `checkin_timeout_error(...)`
  - `checkin_internal_error(...)`
- Cap nhat `parse_attendance_frame_message(...)` de dung `checkin_invalid_message(...)` tu core exceptions.
- Giu `CheckinMessageValidationError` la alias cua `CheckinError` de khong gay code da viet theo step 08.

## Error mapping

Per-frame:

- `INVALID_IMAGE`
- `NO_FACE`
- `MULTIPLE_FACES`
- `LOW_CONFIDENCE`
- `FACE_OUT_OF_FRAME`
- `BLUR`
- `TOO_DARK`
- `TOO_BRIGHT`
- `BAD_POSE`
- `FACE_TOO_SMALL`
- `UNKNOWN_FACE`

Session-level:

- `INVALID_MESSAGE`
- `ALREADY_RECORDED`
- `CHECKOUT_WITHOUT_CHECKIN`
- `EMPLOYEE_INACTIVE`
- `EMPLOYEE_NOT_FOUND`
- `DB_ERROR`
- `SESSION_TIMEOUT`
- `INTERNAL_ERROR`

## Quyet dinh ky thuat

- Khong thay doi `EnrollmentError`, `invalid_message`, `invalid_image`, `timeout_error`, `vector_db_error`, `internal_error` cua enrollment.
- `CheckinError.to_websocket_payload()` tra:
  - `UNKNOWN_FACE` khi code la `UNKNOWN_FACE`.
  - `REJECTED` khi la per-frame error.
  - `ERROR` khi la session-level error.
- Per-frame error khong nhat thiet dong WebSocket; frontend co the tiep tuc gui frame moi.
- Session-level error nen dong session sau khi gui payload loi.
- `details` chi duoc dua vao payload khi co du lieu, va duoc ep ve dict de JSON-safe.

## Kiem tra da chay

- `python -m compileall -q app/core/exceptions.py app/schemas/checkin.py app/schemas/enrollment.py app/api/v1/enrollment.py`
- Import check:
  - `EnrollmentError`
  - `invalid_message`
  - `CheckinError`
  - `checkin_invalid_message`
  - `checkin_frame_error`
  - `parse_enrollment_capture_message`
  - `parse_attendance_frame_message`
- Payload check:
  - `UNKNOWN_FACE` -> `{"status": "UNKNOWN_FACE", ...}`
  - `ALREADY_RECORDED` -> `{"status": "ERROR", ...}`
  - `INVALID_MESSAGE` -> `{"status": "ERROR", ...}`
- Invalid check-in schema payload raise `CheckinError` voi `ERROR / INVALID_MESSAGE`.

## Ghi chu

- Step nay khong sua enrollment behavior.
- Cac pipeline/API step sau se bat `CheckinError` va gui `error.to_websocket_payload()` ve frontend.
