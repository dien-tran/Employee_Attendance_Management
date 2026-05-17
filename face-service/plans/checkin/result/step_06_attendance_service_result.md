# Step 06 Result - Attendance Business Service

## Trang thai

DONE

## File da tao

- `app/services/attendance.py`
- `plans/checkin/result/step_06_attendance_service_result.md`

## Noi dung da thuc hien

- Tao `AttendanceService` de tach business rules khoi MySQL CRUD.
- Tao helper:
  - `resolve_local_now(timezone_name)`
  - `get_check_date(now)`
  - `parse_hhmm(value)`
- Tao typed decision:
  - `AttendanceDecision`
  - `AttendanceDecisionCode`
  - `PunctualityStatus`
- Tao `AttendanceRepository` protocol de service co the test bang fake repository.
- Ho tro decision codes:
  - `ATTENDANCE_SUCCESS`
  - `ALREADY_RECORDED`
  - `CHECKOUT_WITHOUT_CHECKIN`
  - `EMPLOYEE_INACTIVE`
  - `EMPLOYEE_NOT_FOUND`
  - `DB_ERROR`

## Quyet dinh ky thuat

- `AttendanceService` khong doc global config truc tiep; `attendance_config` duoc inject tu ben ngoai.
- `record_attendance()` chap nhan `StaffRecord`, employee id string, hoac `None`:
  - `StaffRecord`: pipeline/API da co staff thi khong can query lai.
  - `str`: service se goi repository de lay staff.
  - `None`: tra `EMPLOYEE_NOT_FOUND`.
- `now=None` se lay thoi gian hien tai theo timezone config, vi du `"Asia/Ho_Chi_Minh"`.
- Test co the truyen `datetime` co dinh vao `now` de kiem tra late/early on dinh.
- `similarity_score` duoc giu trong decision de API/pipeline hien thi, nhung khong ghi DB vi schema step 01 khong co cot nay.
- Check-in sau `checkin_deadline` duoc tinh la `late`.
- Check-out truoc `checkout_start` duoc tinh la `early`.

## Kiem tra da chay

- `python -m compileall -q app/services/attendance.py`
- `python -c "from app.services.attendance import AttendanceService, AttendanceDecision, parse_hhmm, resolve_local_now; print(parse_hhmm('08:00')); print('attendance import ok')"`
- Inline fake repository check:
  - Late check-in luc 08:05 -> `ATTENDANCE_SUCCESS late False`
  - Duplicate check-in cung ngay -> `ALREADY_RECORDED`
  - Checkout luc 16:35 sau khi da check-in -> `ATTENDANCE_SUCCESS on_time True`

## Ghi chu

- Step nay chua goi MySQL that, AI model, hay Qdrant.
- DB integration va E2E se nam o cac step verification/e2e sau.
