# Environment Setup Guide

Tài liệu này dành cho thành viên mới clone/pull code và cho lúc chạy E2E bằng Docker Compose.

## 1. Tạo file `.env`

Tại thư mục root `Employee_Attendance_Management`:

```powershell
Copy-Item .env.example .env
```

Trên macOS/Linux:

```bash
cp .env.example .env
```

Sau đó sửa `.env`. Không commit file `.env`; repo chỉ commit `.env.example`.

## 2. Nhóm biến bắt buộc

`SIGNED_KEY`

- Dùng chung cho `auth-service` và `api-gateway`.
- Cần tối thiểu 64 bytes để dùng HS512 ổn định.
- Local có thể dùng placeholder trong `.env.example`; môi trường thật phải tạo key riêng, ví dụ `openssl rand -hex 64`.

`JWT_ACCESS_TOKEN_TTL_SECONDS` và `JWT_SLIDING_SESSION_TTL_SECONDS`

- `JWT_ACCESS_TOKEN_TTL_SECONDS`: thời hạn của từng access token được cấp.
- `JWT_SLIDING_SESSION_TTL_SECONDS`: trần thời gian tối đa của một phiên đăng nhập qua các lần refresh/rotate token.
- Vì hiện chưa dùng refresh token riêng, `/auth/refresh` chỉ refresh khi access token hiện tại còn hợp lệ và phiên sliding chưa hết hạn.

`AUTH_DB_*` và `CORE_DB_*`

- Dùng để tạo MySQL container và truyền credential vào service Spring.
- Nếu đổi DB user/password sau khi database volume đã được tạo, MySQL không tự đổi user cũ. Với môi trường local sạch có thể chạy:

```powershell
docker compose down -v
```

Lệnh này xóa volume DB local, chỉ dùng khi chấp nhận mất dữ liệu local.

`LLM_PROVIDER` và key/model/base URL theo provider

- `chat-service` hỗ trợ `LLM_PROVIDER=chutes|openrouter`.
- Nếu dùng Chutes: cấu hình `CHUTES_API_KEY`, `CHUTES_MODEL`, `CHUTES_BASE_URL` (ví dụ `https://llm.chutes.ai/v1`).
- Nếu dùng OpenRouter: cấu hình `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`.
- Nếu API key của provider đang chọn để trống, `chat-service` vẫn chạy nhưng các câu hỏi cần LLM sẽ trả lỗi dịch vụ.
- Có thể cấu hình thêm `ORCHESTRATOR_MODEL`, `CLASSIFIER_CONFIDENCE_THRESHOLD` trong `.env`.

`SEED_ADMIN_*`

- `SEED_ADMIN_ENABLED=true` để `auth-service` tự tạo admin local khi DB chưa có admin.
- `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` phải khớp với `E2E_ADMIN_EMAIL` và `E2E_ADMIN_PASSWORD` nếu muốn chạy E2E.
- Với staging/production nên tắt seed hoặc dùng Secret được quản lý riêng.

`E2E_*`

- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`: tài khoản admin để Playwright login.
- `E2E_USER_DOB`: ngày sinh dùng khi E2E tạo user test.
- `E2E_USER_PASSWORD`: phải khớp rule backend `ddMMyyyy` từ `E2E_USER_DOB`. Ví dụ `1998-03-20` thì password là `20031998`.

## 3. Cách `.env` được đọc

Docker Compose tự đọc file `.env` ở cùng thư mục với `docker-compose.yml`.

Các biến trong `.env` được Compose dùng để thay vào `docker-compose.yml`, ví dụ:

```yaml
SIGNED_KEY: ${SIGNED_KEY:?Set SIGNED_KEY in .env}
```

Ký hiệu `:?` làm Compose fail sớm nếu thiếu biến, giúp tránh lỗi mơ hồ khi container đã chạy.

Spring Boot không tự đọc file `.env` khi chạy trực tiếp bằng IDE. Nếu chạy service không qua Docker Compose, cần set Environment Variables trong Run Configuration của IDE hoặc terminal.

Frontend container dùng Nginx template. Biến `FRONTEND_API_GATEWAY_URL` trong `.env` được truyền thành `API_GATEWAY_URL`, rồi Nginx render `front-end/nginx.conf` lúc container start.

API Gateway dùng thêm `CHAT_SERVICE_URL` để route:

- `POST /api/chatbot/message` -> `chat-service:/message`
- `GET /api/chatbot/health` -> `chat-service:/health`

Playwright trong `e2e-runner` đọc biến qua `process.env`, các biến này được truyền từ Compose.

## 4. Chạy toàn bộ hệ thống local

```powershell
docker compose up --build -d
```

Kiểm tra config trước khi chạy:

```powershell
docker compose config --quiet
```

Nếu command trên báo thiếu biến, mở `.env` và điền biến được nhắc.

Sau khi stack lên, có thể kiểm tra nhanh health chatbot:

```bash
curl http://localhost:8080/api/chatbot/health
```

## 5. Chạy E2E

Đảm bảo `.env` đã có:

- `SEED_ADMIN_ENABLED=true`
- `SEED_ADMIN_EMAIL` = `E2E_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD` = `E2E_ADMIN_PASSWORD`
- `E2E_USER_PASSWORD` khớp `E2E_USER_DOB`

Sau đó chạy:

```powershell
docker compose up --build -d frontend
docker compose run --rm e2e-runner
```

Hoặc chạy một lượt:

```powershell
docker compose up --build --abort-on-container-exit e2e-runner
```

## 6. Seed demo attendance cho UI

E2E sẽ cleanup bản ghi attendance sau khi test. Nếu cần dữ liệu giữ lại để kiểm tra UI thủ công, chạy script seed riêng:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\seed-demo-attendance.ps1
```

Mặc định script:

- Đọc `.env` ở repo root.
- Login admin qua `http://localhost:8080/api/auth/login`.
- Gọi trực tiếp core-service `http://localhost:8082/api/internal/attendance/sync` bằng `X-Internal-Token`.
- Tạo bản ghi demo cho ngày hiện tại, gồm admin và E2E user.
- Không cleanup dữ liệu, để UI `/admin/attendance` và `/user/attendance` có dữ liệu hiển thị.

Có thể seed ngày cụ thể:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\seed-demo-attendance.ps1 -Date 2026-05-17
```

## 7. Mapping sang Kubernetes

Dùng ConfigMap cho giá trị không nhạy cảm:

- `DB_HOST`, `DB_PORT`, `DB_NAME`
- `EUREKA_URL`, `AUTH_INTROSPECT_URL`
- `API_GATEWAY_URL`
- `SEED_ADMIN_ENABLED`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_STAFF_ID`

Dùng Secret cho giá trị nhạy cảm:

- `SIGNED_KEY`
- `DB_USERNAME`, `DB_PASSWORD`
- database root/admin password
- `SEED_ADMIN_PASSWORD`
- E2E credentials nếu chạy test trong namespace riêng
