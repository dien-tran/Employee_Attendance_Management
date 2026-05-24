# Step 16 — Frontend Browser E2E and Camera UX Verification

## Muc tieu

Kiem tra truc tiep hai cong frontend `/checkin` va `/checkout` bang browser/dev server de dam bao camera luon mo, frame nam giua, overlay khong che noi dung quan trong, va frontend gui dung WebSocket payload theo mode co dinh.

Buoc nay chi thuc hien sau khi Step 15 backend/WebSocket da pass.

## Pham vi

- Route `/checkin`.
- Route `/checkout`.
- Component dung chung `frontend/src/app/_components/AttendanceKiosk.tsx`.
- Ket noi WebSocket toi `ws://127.0.0.1:8000/api/v1/checkin/ws` hoac bien moi truong `NEXT_PUBLIC_ATTENDANCE_WS_URL`.

## Nguyen tac

- Khong doi schema backend neu khong phat hien loi bat buoc.
- Khong doi database schema trong step nay.
- Khong them toggle check-in/check-out trong cung mot trang, vi yeu cau hien tai la hai cong rieng.
- Camera phai tu mo khi vao trang va tiep tuc quet sau moi terminal response.
- Neu can chinh CSS/UX, chi chinh trong frontend va giu camera frame 4:3 centered.

## Viec can lam

1. Chay backend stack neu chua chay:
   - `docker compose ps`
   - `GET http://127.0.0.1:8000/health`
2. Chay frontend dev server:
   - `npm run dev` trong folder `frontend`
   - Neu port `3000` ban, dung port khac.
3. Mo browser kiem tra `/checkin`:
   - Trang render khong loi.
   - Browser xin quyen camera.
   - Camera preview hien trong khung 4:3 va nam giua.
   - Status overlay khong tran, khong che het khuon mat.
   - Payload gui WebSocket co `type: "checkin"`.
4. Mo browser kiem tra `/checkout`:
   - Trang render khong loi.
   - Camera tu mo nhu `/checkin`.
   - Payload gui WebSocket co `type: "checkout"`.
5. Kiem tra responsive:
   - Desktop viewport.
   - Mobile viewport.
   - Text trong badge/header/overlay khong bi tran hoac overlap.
6. Kiem tra sau terminal response:
   - `ATTENDANCE_SUCCESS`, `ALREADY_RECORDED`, `CHECKOUT_WITHOUT_CHECKIN`, `EMPLOYEE_INACTIVE`, `EMPLOYEE_NOT_FOUND`, `ERROR`.
   - Frontend dong socket hien tai, giu camera, va tu mo session moi sau delay.
7. Neu phat hien loi UX/frontend:
   - Chinh file frontend lien quan.
   - Comment code o cac ham quan trong neu them logic moi.
   - Chay lai lint/build.

## Ket qua can xac nhan

- `/checkin` gui frame voi `type: "checkin"`.
- `/checkout` gui frame voi `type: "checkout"`.
- Camera khong bi lech trai/phai ro rang trong khung preview.
- Khung camera giu ti le 4:3, uu tien webcam laptop landscape.
- Overlay ket qua nam trong camera, khong tao panel ngoai khung.
- Sau terminal response, camera van mo va session moi duoc tao.
- `npm run lint` pass.
- `npm run build` pass.

## Tieu chi nghiem thu

- User co the mo rieng cong check-in va checkout.
- Camera tu bat ma khong can bam nut bat dau.
- Giao dien khong overlap tren desktop/mobile.
- Frontend khong gui sai `type`.
- Khong co regression voi Step 15 backend E2E.

## Bao cao sau khi lam xong

Sau khi thuc hien step nay, xuat bao cao vao:

`plans/checkin/result/step_16_frontend_browser_e2e_result.md`

Bao cao can gom:

- URL frontend da test.
- Ket qua browser desktop/mobile.
- Ket qua lint/build.
- File da chinh sua neu co.
- Van de con lai neu moi truong khong cap duoc camera that.
