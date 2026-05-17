# Step 15 Result - End-to-End Test

## Trang thai

DONE

## File da tao

- `plans/checkin/result/step_15_e2e_test_result.md`

## File da chinh sua

- `app/services/mysql_db.py`
- `requirements-cpu.txt`
- `requirements-gpu.txt`
- `plans/checkin/plan_step_by_step/PROGRESS.json`

## Du lieu test

- Staff business-service E2E:
  - `E2E_ACTIVE`: active, dung de test checkin, duplicate checkin va checkout.
  - `E2E_NOCHECKIN`: active, dung de test checkout khi chua checkin.
  - `E2E_INACTIVE`: inactive, dung de test nhan vien inactive.
- Staff WebSocket E2E:
  - `a`: active, co embedding da ton tai trong Qdrant payload.
  - Anh test: `/app/debug/anti_spoof/20260513T144643749755Z_source_frame.jpg`.

## Kiem tra da chay

- Docker/runtime:
  - `docker compose ps backend`
  - `GET /health`
  - Qdrant collection `face_embeddings`
  - MySQL rows trong `staffs` va `attendances`
- Business service E2E trong backend container:
  - Check-in thanh cong.
  - Check-in trung ngay tra `ALREADY_RECORDED`.
  - Check-out thanh cong sau khi da check-in.
  - Check-out khi chua check-in tra `CHECKOUT_WITHOUT_CHECKIN`.
  - Nhan vien inactive tra `EMPLOYEE_INACTIVE`.
- WebSocket contract:
  - Black image tra `REJECTED/NO_FACE`.
  - JSON khong phai object tra `ERROR/INVALID_MESSAGE`.
- WebSocket real face:
  - Frame 1 tra `PROCESSING`.
  - Frame 2 check-in tra `ATTENDANCE_SUCCESS`.
  - Check-in lai tra `ALREADY_RECORDED`.
  - Checkout tra `ATTENDANCE_SUCCESS`.
  - Tam doi staff `a` sang inactive, WebSocket tra `EMPLOYEE_INACTIVE`, sau do da khoi phuc `a` ve active.
- Static check:
  - `python -m compileall -q app`

## Ket qua chinh

### Business service

- `E2E_ACTIVE` check-in:
  - `ATTENDANCE_SUCCESS`
  - `inserted=True`
  - `on_time=False`
- `E2E_ACTIVE` duplicate check-in:
  - `ALREADY_RECORDED`
  - `inserted=False`
- `E2E_ACTIVE` checkout:
  - `ATTENDANCE_SUCCESS`
  - `inserted=True`
  - `on_time=False`
- `E2E_NOCHECKIN` checkout:
  - `CHECKOUT_WITHOUT_CHECKIN`
  - `inserted=False`
- `E2E_INACTIVE` check-in:
  - `EMPLOYEE_INACTIVE`
  - `inserted=False`

### WebSocket real face

- Check-in lan dau:
  - Frame 1: `PROCESSING`, employee `a`, similarity `0.8368573`.
  - Frame 2: `ATTENDANCE_SUCCESS`, employee `a`, status `late`, `on_time=false`.
- Check-in trung ngay:
  - Frame 1: `PROCESSING`, employee `a`, similarity `0.8368573`.
  - Frame 2: `ALREADY_RECORDED`, employee `a`, status `late`, `on_time=false`.
- Checkout:
  - Frame 1: `PROCESSING`, employee `a`, similarity `0.8368573`.
  - Frame 2: `ATTENDANCE_SUCCESS`, employee `a`, status `early`, `on_time=false`.
- Inactive:
  - Frame 1: `PROCESSING`, employee `a`, similarity `0.8368573`.
  - Frame 2: `EMPLOYEE_INACTIVE`, employee `a`.

### MySQL attendances sau WebSocket E2E

```text
employee_id  type      check_date   check_time           on_time
a            checkin   2026-05-17   2026-05-17 12:19:02  0
a            checkout  2026-05-17   2026-05-17 12:19:04  0
```

## Van de phat hien va da xu ly

### MySQL auth can thieu cryptography

Backend co luc restart loi:

```text
RuntimeError: 'cryptography' package is required for sha256_password or caching_sha2_password auth methods
```

Da them `cryptography>=42` vao:

- `requirements-cpu.txt`
- `requirements-gpu.txt`

Trong runtime hien tai, user MySQL `user` cung da duoc chuyen sang `mysql_native_password` de backend chay duoc ngay. Khi rebuild image lan sau, package `cryptography` se bao ve ca truong hop MySQL dung `caching_sha2_password`.

### MySQL pool giu snapshot cu

WebSocket ban dau da match dung Qdrant employee `a` nhung tra `EMPLOYEE_NOT_FOUND`. Nguyen nhan la `aiomysql` pool dang dung `autocommit=False`; SELECT co the mo transaction va pooled connection co the tai su dung snapshot cu.

Da cap nhat `app/services/mysql_db.py`:

- `get_staff_by_employee_id()` commit sau SELECT.
- `find_attendance()` commit sau SELECT.

Sau khi copy file vao container va restart backend, WebSocket E2E pass.

### Step 15 plan co truong MySQL cu

Plan Step 15 yeu cau xac nhan `status` va `similarity_score` trong MySQL. Tuy nhien Step 01 da chot schema `attendances` chi gom:

- `employee_id`
- `type`
- `check_time`
- `check_date`
- `on_time`

Vi vay Step 15 duoc verify theo schema da duoc phe duyet. `similarity_score` va `attendance_status` chi nam trong WebSocket response/business decision, khong ghi vao MySQL.

## Ket luan

- E2E backend va WebSocket check-in/check-out da pass.
- Khong insert trung cung `employee_id/type/check_date`.
- Checkout bi chan neu chua check-in.
- Nhan vien inactive bi chan.
- Unknown/no-face/invalid-message duoc tra dung dang response.
- Anti-spoofing van o che do advisory theo config hien tai.
