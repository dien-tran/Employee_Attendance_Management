from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router


def create_app() -> FastAPI:
    # Factory giúp test import app mà không tự chạy uvicorn.
    # Model AI chưa load tại đây; model chỉ load khi WebSocket gọi
    # create_enrollment_pipeline() trong endpoint enrollment.
    app = FastAPI(
        title="Face Services",
        version="0.1.0",
    )

    # CORS mở cho frontend test/prototype. Khi lên production nên giới hạn lại
    # domain frontend thật thay vì allow_origins=["*"].
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check nhẹ để kiểm tra server sống mà không load model.
    @app.get("/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    # Include API v1. WebSocket enrollment nằm ở /api/v1/enroll/ws.
    app.include_router(api_router, prefix="/api/v1")
    return app


# uvicorn entrypoint:
# uvicorn app.main:app --reload
app = create_app()
