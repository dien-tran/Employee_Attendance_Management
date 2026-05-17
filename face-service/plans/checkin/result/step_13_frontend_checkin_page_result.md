# Step 13 Result - Frontend Check-in and Checkout Pages

## Trang thai

DONE

## File da tao

- `frontend/src/app/_components/AttendanceKiosk.tsx`
- `frontend/src/app/checkin/page.tsx`
- `frontend/src/app/checkout/page.tsx`
- `plans/checkin/result/step_13_frontend_checkin_page_result.md`

## Noi dung da thuc hien

- Tao component dung chung `AttendanceKiosk`.
- Tao route `/checkin` cho cong check-in.
- Tao route `/checkout` cho cong check-out.
- Camera tu dong mo khi vao trang.
- Camera giu bat lien tuc trong khi trang dang mo.
- Frontend gui frame dinh ky qua WebSocket `/api/v1/checkin/ws`.
- Payload gui backend:
  - `/checkin` gui `type: "checkin"`.
  - `/checkout` gui `type: "checkout"`.
- Ve bbox overlay tren camera theo `face_bbox` backend tra ve.
- Hien ket qua chinh truc tiep tren camera overlay.
- Sau terminal response, frontend cho ngan roi tu mo session WebSocket moi de tiep tuc quet.

## Quyet dinh ky thuat

- Dung route rieng `/checkin` va `/checkout` thay vi toggle trong cung mot page, theo yeu cau moi cua user.
- Khong tao hai backend endpoint rieng; backend van dung `/api/v1/checkin/ws`, khac nhau bang field `type` trong payload.
- Dung `NEXT_PUBLIC_ATTENDANCE_WS_URL` de override WebSocket URL khi backend chay host/port khac.
- Mac dinh WebSocket URL la `ws://127.0.0.1:8000/api/v1/checkin/ws`.
- Dung canvas 4:3 `640x480`, cover-center frame webcam de tranh lech khung nhu loi camera truoc.
- Canvas preview mirror bang CSS cho nguoi dung de can mat de hon; data URL gui backend van lay tu canvas goc.
- Terminal statuses lam frontend dung session hien tai va restart session moi:
  - `ATTENDANCE_SUCCESS`
  - `ALREADY_RECORDED`
  - `CHECKOUT_WITHOUT_CHECKIN`
  - `EMPLOYEE_INACTIVE`
  - `EMPLOYEE_NOT_FOUND`
  - `ERROR`

## Kiem tra da chay

- `npm run lint`
- `npm run build`

Ket qua build route:

- `/`
- `/checkin`
- `/checkout`

## Ghi chu

- Da thu khoi dong Next server tren port 3000 de verify HTTP route, nhung process nen trong shell nay bao ready roi khong giu HTTP listener reachable. Vi vay chua browser-test truc tiep duoc trong step nay.
- Build production da pass, nen route `/checkin` va `/checkout` da compile thanh cong.
