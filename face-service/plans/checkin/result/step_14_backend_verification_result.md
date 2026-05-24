# Step 14 Result - Backend Verification

## Trang thai

DONE

## File da tao

- `plans/checkin/result/step_14_backend_verification_result.md`

## File da chinh sua

- `plans/checkin/plan_step_by_step/PROGRESS.json`

## Kiem tra backend da chay

- `python -m compileall -q app`
- `python -c "from app.main import app; print(app.title if hasattr(app, 'title') else 'ok'); print(sorted(route.path for route in app.routes if hasattr(route, 'path')))"`
- Config required keys check:
  - `checkin.*`
  - `attendance.*`
  - `mysql.pool_size`
  - `mysql.pool_timeout`
- Dependency smoke check:
  - `get_mysql_service()`
  - `get_attendance_service()`
  - `reset_dependency_cache()`
- Check-in imports:
  - `CheckinPipeline`
  - `AttendanceFrameMessage`
  - `CheckinError`
  - `FaceSearchHit`
  - `AttendanceService`

## Kiem tra Docker/Runtime

- `docker compose ps`
- `GET http://127.0.0.1:8000/health`
- `curl.exe -s http://127.0.0.1:6333/collections`
- MySQL schema:
  - `SHOW TABLES`
  - `DESCRIBE staffs`
  - `DESCRIBE attendances`
- Backend container:
  - `import aiomysql`
  - `MySQLDatabaseService.connect()`
  - `get_staff_by_employee_id("__missing__")`
  - `close()`

## Ket qua

- Backend compile pass.
- Import `app.main:app` pass.
- Route list co:
  - `/api/v1/checkin/ws`
  - `/api/v1/enroll/ws`
  - `/health`
- Config khong thieu key check-in/attendance/mysql moi.
- Docker services dang chay:
  - `attendance_mysql`
  - `face_backend`
  - `face_qdrant`
- Backend health tra `{"status":"ok"}`.
- Qdrant co collection `face_embeddings`.
- MySQL co bang:
  - `staffs`
  - `attendances`
- Backend container import `aiomysql` thanh cong.
- Backend container MySQL async smoke test pass.
- Frontend:
  - `npm run lint` pass.
  - `npm run build` pass.
  - Build co route `/checkin` va `/checkout`.

## Van de phat hien va da xu ly

### MySQL schema chua co trong volume hien tai

Lan dau kiem tra `DESCRIBE staffs` bi loi:

- `Table 'attendance_db.staffs' doesn't exist`

Nguyen nhan:

- MySQL init SQL trong `/docker-entrypoint-initdb.d` chi tu chay khi data directory rong.
- Volume MySQL hien tai da ton tai truoc khi step 02 mount SQL.

Xu ly:

- Da pipe `sql/01_create_attendance_tables.sql` vao MySQL container.
- Sau do `SHOW TABLES` va `DESCRIBE` cho `staffs`, `attendances` pass.

### Backend image cu chua co aiomysql

Lan dau kiem tra container backend:

- `ModuleNotFoundError: No module named 'aiomysql'`

Nguyen nhan:

- requirements da cap nhat o step 04, nhung Docker image dang chay la image cu.

Xu ly:

- Da chay `docker compose build backend`.
- Da restart backend bang `docker compose up -d backend`.
- Sau rebuild, `import aiomysql` trong backend container pass.

### Ghi chu ve cryptography warning/error cu

Log backend co mot so lan startup cu loi:

- `cryptography package is required for sha256_password or caching_sha2_password auth methods`

Trang thai sau cung:

- Backend da healthy.
- MySQL async smoke test tu backend container pass.

## Lenh frontend da chay

- `npm run lint`
- `npm run build`

## Ghi chu

- Chua thuc hien E2E camera that trong step nay.
- Step 15 se la E2E enrollment -> check-in -> check-out neu co du camera va data nhan vien test.
