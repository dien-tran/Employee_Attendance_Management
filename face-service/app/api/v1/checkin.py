from __future__ import annotations

from json import JSONDecodeError
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.dependencies import create_checkin_pipeline
from app.core.exceptions import checkin_internal_error, checkin_invalid_message


router = APIRouter()

TERMINAL_STATUSES = {
    "ATTENDANCE_SUCCESS",
    "ALREADY_RECORDED",
    "CHECKOUT_WITHOUT_CHECKIN",
    "EMPLOYEE_INACTIVE",
    "EMPLOYEE_NOT_FOUND",
    "ERROR",
    "SESSION_TIMEOUT",
}


async def _safe_send_json(websocket: WebSocket, payload: dict[str, Any]) -> bool:
    """Send JSON without surfacing normal client disconnects as server errors.

    Args:
        websocket: Accepted FastAPI WebSocket connection.
        payload: JSON-safe response dict from `CheckinPipeline`.

    Returns:
        `True` when the payload was sent, otherwise `False` when the client
        already disconnected.

    Example:
        `sent = await _safe_send_json(websocket, response)`
    """

    # Client có thể đóng tab/ngắt mạng đúng lúc backend đang gửi feedback.
    # Khi đó send_json ném WebSocketDisconnect; endpoint chỉ cần dừng loop.
    try:
        await websocket.send_json(payload)
    except WebSocketDisconnect:
        return False
    return True


async def _safe_close(websocket: WebSocket, code: int) -> None:
    """Close WebSocket while ignoring already-closed client connections.

    Args:
        websocket: FastAPI WebSocket connection.
        code: WebSocket close code, for example `status.WS_1000_NORMAL_CLOSURE`.

    Returns:
        None.

    Example:
        `await _safe_close(websocket, status.WS_1000_NORMAL_CLOSURE)`
    """

    # Nếu socket đã đóng từ phía client thì close() cũng có thể fail; bỏ qua để
    # log không bị stack trace không cần thiết.
    try:
        await websocket.close(code=code)
    except RuntimeError:
        pass
    except WebSocketDisconnect:
        pass


@router.websocket("/checkin/ws")
async def checkin_websocket(websocket: WebSocket) -> None:
    # Endpoint WebSocket cho frontend stream frame check-in/check-out.
    # URL sau khi include prefix /api/v1 sẽ là: /api/v1/checkin/ws
    # Request contract:
    # {
    #   "action": "attendance_frame",
    #   "type": "checkin" | "checkout",
    #   "image": "data:image/jpeg;base64,/9j/..."
    # }
    await websocket.accept()

    try:
        # Mỗi WebSocket connection có một CheckinPipeline riêng vì pipeline giữ
        # session state như candidate_employee_id, consecutive_high, timeout và
        # completed. Các model/service nặng vẫn là singleton từ dependencies.py.
        pipeline = create_checkin_pipeline()
    except Exception as exc:
        sent = await _safe_send_json(
            websocket,
            checkin_internal_error(
                "Không thể khởi tạo check-in/check-out pipeline",
                details={"error": str(exc)},
            ).to_websocket_payload(),
        )
        if sent:
            await _safe_close(websocket, code=status.WS_1011_INTERNAL_ERROR)
        return

    while True:
        try:
            payload: Any = await websocket.receive_json()
        except WebSocketDisconnect:
            # Client đóng tab/ngắt camera/ngắt mạng. Đây là luồng bình thường.
            break
        except JSONDecodeError as exc:
            sent = await _safe_send_json(
                websocket,
                checkin_invalid_message(
                    "JSON gửi lên không hợp lệ",
                    details={"error": str(exc)},
                ).to_websocket_payload(),
            )
            if sent:
                await _safe_close(websocket, code=status.WS_1000_NORMAL_CLOSURE)
            break

        if not isinstance(payload, dict):
            sent = await _safe_send_json(
                websocket,
                checkin_invalid_message(
                    "WebSocket message phải là JSON object",
                    details={"received_type": type(payload).__name__},
                ).to_websocket_payload(),
            )
            if sent:
                await _safe_close(websocket, code=status.WS_1000_NORMAL_CLOSURE)
            break

        # Pipeline xử lý toàn bộ: schema -> decode -> detection -> anti-spoofing
        # advisory -> quality -> embedding -> Qdrant search -> attendance decision.
        # Response là dict JSON-safe, có thể gửi thẳng qua websocket.send_json().
        response = await pipeline.handle_frame_payload(payload)
        sent = await _safe_send_json(websocket, response)
        if not sent:
            break

        # Terminal statuses đại diện cho kết quả cuối hoặc lỗi session. Sau khi
        # gửi response, đóng socket để frontend dừng gửi frame cũ của session này.
        if response["status"] in TERMINAL_STATUSES:
            await _safe_close(websocket, code=status.WS_1000_NORMAL_CLOSURE)
            break
