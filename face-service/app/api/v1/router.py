from fastapi import APIRouter

from app.api.v1.checkin import router as checkin_router
from app.api.v1.enrollment import router as enrollment_router


# api_router là router tổng cho version v1. app/main.py include router này với
# prefix "/api/v1", nên endpoint enrollment đầy đủ là "/api/v1/enroll/ws"
# và endpoint check-in đầy đủ là "/api/v1/checkin/ws".
api_router = APIRouter()
api_router.include_router(enrollment_router, tags=["enrollment"])
api_router.include_router(checkin_router, tags=["checkin"])
