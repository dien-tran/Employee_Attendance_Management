# Step 10 Result - Dependencies Container for Check-in

## Trang thai

DONE

## File da chinh sua

- `app/core/dependencies.py`
- `app/main.py`

## File da tao

- `plans/checkin/result/step_10_dependencies_container_result.md`

## Noi dung da thuc hien

- Them `get_mysql_service()` de tao singleton `MySQLDatabaseService`.
- Them `get_attendance_service()` de tao singleton `AttendanceService`.
- Them `connect_mysql_pool()` de mo MySQL pool luc FastAPI startup.
- Them `close_mysql_pool()` de dong MySQL pool luc FastAPI shutdown.
- Them `create_checkin_pipeline()` factory de tao pipeline rieng cho moi WebSocket connection.
- Cap nhat `reset_dependency_cache()` de clear them cache cua MySQL va AttendanceService.

## Quyet dinh ky thuat

- Khong load model trong endpoint/frame loop.
- `create_checkin_pipeline()` dung deferred import `from app.pipeline.checkin import CheckinPipeline` vi pipeline se duoc tao o step 11.
- Moi WebSocket connection se co pipeline rieng vi pipeline giu session state nhu candidate, confidence counters va timeout.
- AI/vector services van dung singleton tu `ServiceContainer`.
- MySQL service la singleton, pool duoc mo mot lan theo lifecycle app, khong tao pool theo tung frame.
- `app.main:app` import van pass; startup event moi thuc su connect MySQL.

## Kiem tra da chay

- `python -m compileall -q app/core/dependencies.py app/main.py app/services/mysql_db.py app/services/attendance.py`
- Import/runtime smoke check:
  - `from app.main import app`
  - `get_mysql_service()`
  - `get_attendance_service()`
  - `reset_dependency_cache()`

## Ghi chu

- Chua goi `create_checkin_pipeline()` trong step nay vi `app/pipeline/checkin.py` se duoc tao o step 11.
- Chua test connect MySQL that trong step nay; DB integration se phu hop voi verification/e2e sau.
