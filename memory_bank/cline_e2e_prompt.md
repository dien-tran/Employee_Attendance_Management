# Prompt for Cline Agent - Task 3.7 E2E Automation

Bạn là Cline Agent được giao chạy automation Playwright thật cho Employee Attendance Management System.

## Context bắt buộc phải đọc trước

Đọc các file sau trước khi thao tác:

- `memory_bank/active_plan.json`
- `memory_bank/e2e_testing_rules.md`
- `memory_bank/API_Endpoint.md`
- `memory_bank/lessons_learned.md`
- `front-end/playwright.config.ts`
- `front-end/tests/e2e/auth.setup.ts`
- `front-end/tests/e2e/admin-crud.spec.ts`
- `front-end/tests/e2e/user-profile.spec.ts`
- `docker-compose.yml`

Task cần thực hiện là `3.7`: Chạy Playwright Automation qua Docker E2E Runner và thu thập kết quả.

## Quy tắc quan trọng

- Không chạy `npx playwright test` trực tiếp trên host.
- Không chạy `npm install` trực tiếp trên host.
- Chỉ chạy E2E qua Docker runner đã định nghĩa trong `docker-compose.yml`.
- Không refactor lan man.
- Không sửa các task đã `DONE` nếu lỗi không liên quan trực tiếp tới E2E execution.
- Nếu cần sửa code, chỉ sửa phần nhỏ, có nguyên nhân rõ ràng, rồi chạy lại Docker E2E runner.
- Nếu gặp lỗi lớn hoặc không chắc nguyên nhân, dừng lại và báo cáo đầy đủ thay vì đoán mò.

## Lệnh chạy chuẩn

Chạy từ thư mục repo root `Employee_Attendance_Management`:

```bash
docker-compose up -d
docker-compose run --rm e2e-runner
```

Không dùng lệnh khác để chạy Playwright trừ khi chỉ để đọc artifact/report.

## Những thay đổi đã chuẩn bị trước cho E2E

- Frontend API client mặc định gọi same-origin `/api/...` qua nginx proxy.
- E2E setup/cleanup API mặc định dùng `PLAYWRIGHT_BASE_URL`, tức `http://frontend` trong Docker.
- Frontend Docker builder đã đổi sang `node:22-alpine` để phù hợp `next@16.2.0`.
- Profile API mới:
  - `GET /api/profile/me`
  - `PUT /api/profile/me`
- Staff API admin đã trả wrapper `ApiResponse`.

## Kỳ vọng khi chạy

Playwright sẽ chạy:

- `auth.setup.ts`: login admin, tạo/activate E2E user nếu cần, login user, lưu storage state.
- `admin-crud.spec.ts`: validation login admin và tạo nhân viên bằng admin session.
- `user-profile.spec.ts`: mở profile bằng user session, update profile với intercept `PUT /api/profile/me`, assert DOM/toast, restore dữ liệu trong `finally`.

## Nếu fail thì cần thu thập

Báo cáo theo format sau:

```md
## E2E Result
- Command đã chạy:
- Tổng số test pass/fail:
- Test fail:
- Error message chính:
- Dòng log liên quan:
- Artifact paths:
  - Screenshot:
  - Video:
  - Trace:
- Nhận định nguyên nhân:
- Đã sửa gì (nếu có):
- Có cần Codex/debug tiếp không:
```

Nếu có artifact:

- `front-end/test-results/**`
- `front-end/playwright-report/**`

hãy ghi rõ đường dẫn để người khác mở lại.

## Các lỗi có khả năng gặp

- `503 Service Unavailable`: backend/gateway/Eureka chưa ready hoặc route Gateway chưa match.
- `401 Unauthorized`: cookie storage state không được lưu/gửi đúng origin, hoặc setup login fail.
- `ERR_NAME_NOT_RESOLVED api-gateway`: browser/frontend còn gọi hostname Docker internal trực tiếp thay vì `/api`.
- Frontend build fail vì Node version: kiểm tra Dockerfile phải dùng `node:22-alpine`.
- Test timeout khi chờ `/api/profile/me`: kiểm tra Profile route trong Gateway và `ProfileController`.

## Hoàn thành task khi

- E2E runner chạy xong và có kết quả rõ ràng.
- Nếu pass: cập nhật `memory_bank/active_plan.json` task `3.7` sang `DONE` và ghi summary ngắn.
- Nếu fail nhưng đã thu thập đủ artifact/log: giữ task `3.7` là `IN-PROGRESS` hoặc `PENDING`, ghi rõ blocker và artifact paths.
