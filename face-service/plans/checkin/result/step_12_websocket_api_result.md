# Step 12 Result - Check-in WebSocket API

## Trang thai

DONE

## File da tao

- `app/api/v1/checkin.py`
- `plans/checkin/result/step_12_websocket_api_result.md`

## File da chinh sua

- `app/api/v1/router.py`

## Noi dung da thuc hien

- Tao WebSocket endpoint:
  - Router path: `/checkin/ws`
  - Full path sau prefix v1: `/api/v1/checkin/ws`
- Moi connection tao mot `CheckinPipeline` rieng bang `create_checkin_pipeline()`.
- Endpoint nhan JSON object tu `websocket.receive_json()`.
- Goi `await pipeline.handle_frame_payload(payload)`.
- Gui response JSON-safe bang `_safe_send_json(...)`.
- Dong WebSocket khi response la terminal status.
- Include `checkin_router` vao `api_router`.

## Terminal statuses

- `ATTENDANCE_SUCCESS`
- `ALREADY_RECORDED`
- `CHECKOUT_WITHOUT_CHECKIN`
- `EMPLOYEE_INACTIVE`
- `EMPLOYEE_NOT_FOUND`
- `ERROR`
- `SESSION_TIMEOUT`

## Quyet dinh ky thuat

- Endpoint khong tu khoi tao model/service nang; chi goi factory `create_checkin_pipeline()`.
- Moi WebSocket connection co pipeline rieng vi pipeline giu session state.
- Shared services/model van la singleton trong dependency container.
- `_safe_send_json(...)` bat `WebSocketDisconnect` de client disconnect khong thanh server error.
- `_safe_close(...)` bo qua socket da dong de log khong co stack trace thua.
- JSON sai cu phap va payload khong phai object duoc map thanh `ERROR / INVALID_MESSAGE`.

## Kiem tra da chay

- `python -m compileall -q app/api/v1/checkin.py app/api/v1/router.py app/main.py app/pipeline/checkin.py`
- Import app:
  - `from app.main import app`
- Route list co:
  - `/api/v1/checkin/ws`
  - `/api/v1/enroll/ws`
- Check `TERMINAL_STATUSES` co day du status yeu cau trong plan.

## Ghi chu

- Chua chay WebSocket voi browser/client that trong step nay.
- Frontend ket noi endpoint nay se duoc lam o step 13.
