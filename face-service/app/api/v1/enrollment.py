from __future__ import annotations

from json import JSONDecodeError
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.dependencies import create_enrollment_pipeline
from app.core.exceptions import internal_error, invalid_message


router = APIRouter()


async def _safe_send_json(websocket: WebSocket, payload: dict[str, Any]) -> bool:
    # Client có thể đóng tab/ngắt mạng đúng lúc backend đang gửi feedback.
    # Khi đó send_json ném WebSocketDisconnect; endpoint chỉ cần dừng loop,
    # không coi đây là lỗi server.
    try:
        await websocket.send_json(payload)
    except WebSocketDisconnect:
        return False
    return True


async def _safe_close(websocket: WebSocket, code: int) -> None:
    # Nếu socket đã đóng từ phía client thì close() cũng có thể fail; bỏ qua để
    # log không bị stack trace không cần thiết.
    try:
        await websocket.close(code=code)
    except RuntimeError:
        pass
    except WebSocketDisconnect:
        pass


@router.websocket("/enroll/ws")
async def enroll_websocket(websocket: WebSocket) -> None:
    # Endpoint WebSocket cho frontend stream frame enrollment.
    # URL sau khi include prefix /api/v1 sẽ là: /api/v1/enroll/ws
    await websocket.accept()

    try:
        # Mỗi WebSocket connection tạo một pipeline/session riêng để accepted_count,
        # good_embeddings và employee_metadata không bị trộn giữa nhiều nhân viên.
        # Các model nặng bên trong pipeline vẫn là singleton từ dependencies.py.
        pipeline = create_enrollment_pipeline()
    except Exception as exc:
        # Nếu model/config khởi tạo lỗi, báo frontend biết rồi đóng connection.
        # Ví dụ thiếu model weights, runtime GPU sai, hoặc config thiếu key.
        sent = await _safe_send_json(
            websocket,
            internal_error(
                "Không thể khởi tạo enrollment pipeline",
                details={"error": str(exc)},
            ).to_websocket_payload(),
        )
        if sent:
            await _safe_close(websocket, code=status.WS_1011_INTERNAL_ERROR)
        return

    while True:
        try:
            # Frontend gửi JSON dạng:
            # {
            #   "action": "capture",
            #   "employee_id": "NV001",
            #   "full_name": "Nguyen Van A",
            #   "date_of_birth": "1998-04-21",
            #   "image": "data:image/jpeg;base64,/9j/..."
            # }
            payload: Any = await websocket.receive_json()
        except WebSocketDisconnect:
            # Client đóng tab/ngắt camera/ngắt mạng. Không cần trả lỗi.
            break
        except JSONDecodeError as exc:
            # JSON sai cú pháp: chưa vào pipeline được vì không parse thành dict.
            sent = await _safe_send_json(
                websocket,
                invalid_message(
                    "JSON gửi lên không hợp lệ",
                    details={"error": str(exc)},
                ).to_websocket_payload(),
            )
            if sent:
                await _safe_close(websocket, code=status.WS_1000_NORMAL_CLOSURE)
            break

        if not isinstance(payload, dict):
            # WebSocket contract yêu cầu object JSON, không nhận list/string/number.
            sent = await _safe_send_json(
                websocket,
                invalid_message(
                    "WebSocket message phải là JSON object",
                    details={"received_type": type(payload).__name__},
                ).to_websocket_payload(),
            )
            if sent:
                await _safe_close(websocket, code=status.WS_1000_NORMAL_CLOSURE)
            break

        # Pipeline xử lý toàn bộ: schema -> decode -> detection -> anti-spoofing
        # -> quality -> embedding -> Qdrant khi đủ frame. Response là dict JSON-safe.
        response = pipeline.handle_capture_payload(payload)
        sent = await _safe_send_json(websocket, response)
        if not sent:
            break

        # Khi enrollment hoàn tất hoặc lỗi cấp session, đóng connection để frontend
        # biết session này đã kết thúc và không tiếp tục gửi frame cũ.
        if response["status"] in {"ENROLLMENT_COMPLETE", "ERROR"}:
            await _safe_close(websocket, code=status.WS_1000_NORMAL_CLOSURE)
            break
