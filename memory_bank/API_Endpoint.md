## API Endpoints - Employee Attendance Management System

> **Cổng vào duy nhất:** API Gateway `http://localhost:8080`
> **Auth Header:** `Authorization: Bearer <JWT_TOKEN>` hoặc HttpOnly Cookie `access_token`

---

## 🔐 Gateway Routes (api-gateway/application.yml)

| Route ID | Path Pattern | Upstream Service | Strip Prefix | Ghi chú |
|----------|-------------|-----------------|--------------|---------|
| `auth-service-public` | `/api/auth/**` | `lb://auth-service` | Yes (1) | `/api/auth/login` → `/auth/login` trên auth-service |
| `auth-service-staff` | `/api/staff/**` | `lb://auth-service` | No | `/api/staff` → `/api/staff` trên auth-service (port 8081) |
| `auth-service-profile` | `/api/profile/**` | `lb://auth-service` | No | `/api/profile/me` → `/api/profile/me` trên auth-service (port 8081) |
| `core-service` | `/api/core/**` | `lb://core-service` | Yes (2) | `/api/core/attendance/...` → `/attendance/...` trên core-service (port 8082) |

> ⚠️ **Lưu ý quan trọng:** Route `/api/staff/**` KHÔNG strip prefix vì `StaffController` mapping là `/api/staff`.
> Route `/api/auth/**` strip 1 prefix vì `AuthController` mapping là `/auth/login`, `/auth/introspect`, v.v.
> API nội bộ `/api/internal/**` của `core-service` KHÔNG dành cho external client qua Gateway. Luồng AI service → core-service gọi trực tiếp trong Docker network.

---

## 1. Auth Controller (`/auth`) — auth-service port 8081

> Gọi qua Gateway: `POST http://localhost:8080/api/auth/login`

| Method | Gateway Path | Upstream Path | Request Body | Phân quyền | Mô tả |
|--------|-------------|--------------|--------------|------------|-------|
| POST | `/api/auth/login` | `/auth/login` | `{"username":"email","password":"..."}` | Public | Xác thực email/password, trả về JWT. |
| POST | `/api/auth/introspect` | `/auth/introspect` | `{"token":"..."}` | Public | Kiểm tra tính hợp lệ của token. Response: `{code,message,result:{valid,userId,roles}}` |
| POST | `/api/auth/refresh` | `/auth/refresh` | `{"token":"..."}` | Public | Refresh token khi hết hạn, vô hiệu hóa token cũ. |
| POST | `/api/auth/logout` | `/auth/logout` | `{"token":"..."}` | Authenticated | Đăng xuất (Vô hiệu hóa token, thêm vào blacklist). |

### Login Response Example
```json
{
  "code": 200,
  "message": "Login successful",
  "result": {
    "token": "eyJhbGci...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "staffId": "SYS000001",
    "name": "System Administrator",
    "role": "ADMIN"
  }
}
```

### Introspect Response Example
```json
{
  "code": 200,
  "message": "Token is valid",
  "result": {
    "valid": true,
    "userId": "ba09ad68-ab9e-4c38-a0c1-5ea2a93260d8",
    "roles": "ROLE_ADMIN"
  }
}
```

---

## 2. Staff Controller (`/api/staff`) — auth-service port 8081

> Gọi qua Gateway: `POST http://localhost:8080/api/staff`
> **Yêu cầu:** JWT token với `ROLE_ADMIN` (Gateway inject `X-User-Roles: ROLE_ADMIN` vào header nội bộ)

| Method | Gateway Path | Upstream Path | Request Body | Phân quyền | Mô tả |
|--------|-------------|--------------|--------------|------------|-------|
| POST | `/api/staff` | `/api/staff` | `StaffCreationRequest` | `ROLE_ADMIN` | Tạo nhân viên mới. Tự sinh `staff_id` (NV+6 số), password mặc định = dob (ddMMyyyy) BCrypt hashed. |
| GET | `/api/staff` | `/api/staff` | - | `ROLE_ADMIN` | Lấy danh sách toàn bộ nhân viên trong hệ thống. |
| PUT | `/api/staff/{id}` | `/api/staff/{id}` | `StaffUpdateRequest` | `ROLE_ADMIN` | Cập nhật thông tin nhân viên. |
| PATCH | `/api/staff/{id}/status` | `/api/staff/{id}/status` | Query: `?status=...` | `ROLE_ADMIN` | Thay đổi trạng thái nhân viên (Ví dụ: ACTIVE, INACTIVE) thay vì xóa vật lý. |

### StaffCreationRequest
```json
{
  "name": "Nguyen Van A",
  "email": "a.nguyen@company.com",
  "dob": "1998-03-20",
  "department": "IT",
  "position": "Developer",
  "phone": "0912345678",
  "identityCard": "079098001234",
  "bankAccount": "9876543210",
  "bankName": "Techcombank",
  "role": "USER"
}
```

### StaffResponse (201 Created)
```json
{
  "code": 201,
  "message": "Staff created successfully",
  "result": {
    "id": "uuid",
    "staffId": "NV000001",
    "name": "Nguyen Van A",
    "email": "a.nguyen@company.com",
    "department": "IT",
    "position": "Developer",
    "onboardDate": "2026-05-13",
    "status": "ACTIVE",
    "phone": "0912345678",
    "identityCard": "079098001234",
    "bankAccount": "9876543210",
    "bankName": "Techcombank",
    "dob": "1998-03-20",
    "role": "USER"
  }
}
```

### Staff Update / Status Responses

`PUT /api/staff/{id}`:
```json
{
  "code": 200,
  "message": "Staff updated successfully",
  "result": {
    "id": "uuid",
    "staffId": "NV000001",
    "name": "Nguyen Van A",
    "email": "a.nguyen@company.com",
    "department": "IT",
    "position": "Developer",
    "status": "ACTIVE",
    "phone": "0912345678",
    "role": "USER"
  }
}
```

`PATCH /api/staff/{id}/status?status=INACTIVE`:
```json
{
  "code": 200,
  "message": "Staff status updated successfully",
  "result": {
    "id": "uuid",
    "staffId": "NV000001",
    "status": "INACTIVE"
  }
}
```

### Error Responses
| HTTP Status | Khi nào | Response |
|-------------|---------|----------|
| 401 | Không có token | (empty body) |
| 403 | Token có role USER (không phải ADMIN) | `{"code":403,"message":"Access denied: ADMIN role required"}` |
| 409 | Email hoặc staffId đã tồn tại | `{"code":409,"message":"Email already exists"}` |

---

## 3. Profile Controller (`/api/profile`) — auth-service port 8081

> Gọi qua Gateway: `GET http://localhost:8080/api/profile/me`
> **Yêu cầu:** JWT hợp lệ. API Gateway inject `X-User-Id` và `X-User-Roles`.

| Method | Gateway Path | Upstream Path | Request Body | Phân quyền | Mô tả |
|--------|-------------|--------------|--------------|------------|-------|
| GET | `/api/profile/me` | `/api/profile/me` | - | Authenticated | Lấy hồ sơ của chính user đang đăng nhập. |
| PUT | `/api/profile/me` | `/api/profile/me` | `ProfileUpdateRequest` | Authenticated | Cập nhật thông tin hồ sơ cá nhân của chính user đang đăng nhập. |

### ProfileUpdateRequest
```json
{
  "name": "Nguyen Van A",
  "department": "QA",
  "phone": "0912345678"
}
```

### Profile Response
```json
{
  "code": 200,
  "message": "Profile updated successfully",
  "result": {
    "id": "uuid",
    "staffId": "NV000001",
    "name": "Nguyen Van A",
    "email": "a.nguyen@company.com",
    "department": "QA",
    "position": "Developer",
    "status": "ACTIVE",
    "phone": "0912345678",
    "role": "USER"
  }
}
```

### Profile Error Responses
| HTTP Status | Khi nào | Response |
|-------------|---------|----------|
| 401 | Không có token tại Gateway | (empty body) |
| 401 | Thiếu `X-User-Id` ở auth-service | `{"code":401,"message":"Missing authenticated user id"}` |
| 401 | `X-User-Id` không phải UUID hợp lệ | `{"code":401,"message":"Invalid authenticated user id"}` |

---

## 4. Attendance Controller (`/attendance`) — core-service port 8082

> Gọi qua Gateway: `GET http://localhost:8080/api/core/attendance/my`
> **Yêu cầu:** JWT hợp lệ. API Gateway inject `X-Staff-Id`, `X-User-Id`, `X-User-Roles`.

| Method | Gateway Path | Upstream Path | Request Body | Phân quyền | Mô tả |
|--------|-------------|--------------|--------------|------------|-------|
| POST | `/api/core/attendance/check-in?type=CHECK_IN` | `/attendance/check-in` | - | Authenticated | Chấm công thủ công cho staff hiện tại từ `X-Staff-Id`. |
| GET | `/api/core/attendance/my?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | `/attendance/my` | - | Authenticated | Lấy lịch sử chấm công của chính user hiện tại. |
| GET | `/api/core/attendance/today` | `/attendance/today` | - | `ROLE_ADMIN` | Lấy tất cả bản ghi chấm công hôm nay. |
| GET | `/api/core/attendance/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | `/attendance/range` | - | `ROLE_ADMIN` | Lấy bản ghi chấm công theo khoảng ngày. |
| GET | `/api/core/attendance/staff/{staffId}/today` | `/attendance/staff/{staffId}/today` | - | `ROLE_ADMIN` | Lấy bản ghi chấm công hôm nay của một nhân viên. |

### Attendance Response Example
```json
{
  "code": 200,
  "message": "Success",
  "result": [
    {
      "id": "uuid",
      "staffId": "NV000001",
      "type": "CHECK_IN",
      "timestamp": "2026-05-16T08:02:15",
      "date": "2026-05-16",
      "onTime": true
    }
  ]
}
```

## 5. Internal Attendance M2M API (`/api/internal/attendance`) — core-service port 8082

> Gọi nội bộ trong Docker network: `POST http://core-service:8082/api/internal/attendance/sync`
> **Không gọi qua API Gateway/browser.**
> **Auth Header:** `X-Internal-Token: Bearer <INTERNAL_M2M_JWT>`

| Method | Internal Path | Request Body | Phân quyền | Mô tả |
|--------|---------------|--------------|------------|-------|
| POST | `/api/internal/attendance/sync` | `SyncAttendanceRequest` | Internal M2M JWT | AI service đồng bộ bản ghi điểm danh sau khi nhận diện khuôn mặt thành công. |
| DELETE | `/api/internal/attendance/{id}` | - | Internal M2M JWT | Dọn bản ghi nội bộ theo id, dùng cho cleanup dữ liệu E2E/đồng bộ lỗi. |

### Internal M2M JWT

JWT nội bộ này **khác** JWT login user/admin.

| Field | Value |
|-------|-------|
| Algorithm | `HS512` |
| Signed key | `INTERNAL_JWT_SIGNED_KEY` |
| Header nhận token | `X-Internal-Token` |
| Issuer mặc định | `ai-service` |
| Audience mặc định | `core-service` |
| Scope bắt buộc | `attendance:sync` |

### Internal JWT Claims Example
```json
{
  "iss": "ai-service",
  "aud": "core-service",
  "scope": "attendance:sync",
  "iat": 1778680131,
  "exp": 1778681031,
  "jti": "b6d75e0e-5075-4c50-a6c8-56bbf72d8f74"
}
```

### SyncAttendanceRequest
```json
{
  "staffId": "NV000001",
  "type": "CHECK_IN",
  "timestamp": "2026-05-16T08:02:15",
  "date": "2026-05-16",
  "onTime": true
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| `staffId` | string | Yes | Mã nhân viên mapping với bảng staffs. |
| `type` | string | Yes | `CHECK_IN` hoặc `CHECK_OUT`. |
| `timestamp` | datetime | Yes | Thời điểm chấm công chính xác, ISO-8601 local datetime. |
| `date` | date | No | Nếu không truyền, core-service tự lấy từ `timestamp`. |
| `onTime` | boolean | Yes | `true` nếu đúng giờ, `false` nếu trễ. |

### Success Response (201 Created)
```json
{
  "code": 201,
  "message": "Attendance synced successfully",
  "result": {
    "id": "uuid",
    "staffId": "NV000001",
    "type": "CHECK_IN",
    "timestamp": "2026-05-16T08:02:15",
    "date": "2026-05-16",
    "onTime": true
  }
}
```

### Error Responses
| HTTP Status | Khi nào | Response |
|-------------|---------|----------|
| 400 | Body thiếu field bắt buộc hoặc `type` không phải `CHECK_IN`/`CHECK_OUT` | Spring validation error |
| 401 | Thiếu/sai `X-Internal-Token`, JWT sai chữ ký, hết hạn, sai issuer/audience/scope | `{"code":401,"message":"Invalid internal JWT"}` |
| 503 | `INTERNAL_JWT_SIGNED_KEY` chưa được cấu hình ở core-service | `{"code":503,"message":"Internal attendance sync is not configured"}` |

---

## 6. Tài khoản hệ thống mặc định (DataInitializer)

> File: `auth-service/src/main/java/com/attendance/auth/config/DataInitializer.java`
> Tự động tạo khi auth-service khởi động lần đầu (idempotent).

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | Đọc từ biến môi trường `SEED_ADMIN_PASSWORD` |
| StaffId | `SYS000001` |
| Role | `ADMIN` |
| Name | `System Administrator` |
| Department | `IT` |

---

## 7. User/Admin JWT Token Structure

**Algorithm:** HS512 (Nimbus JOSE JWT)
**Signed Key:** Đọc từ biến môi trường `SIGNED_KEY` (không commit giá trị thật)

### JWT Claims
```json
{
  "sub": "admin@example.com",
  "scope": "ROLE_ADMIN",
  "iss": "attendance-system",
  "exp": 1778766531,
  "iat": 1778680131,
  "userId": "ba09ad68-ab9e-4c38-a0c1-5ea2a93260d8",
  "jti": "4d442897-fa48-4278-84f0-e1c20a3359d5",
  "staffId": "SYS000001"
}
```

### Headers inject bởi Gateway vào downstream
| Header | Giá trị | Ví dụ |
|--------|---------|-------|
| `X-User-Id` | UUID của user | `ba09ad68-ab9e-4c38-a0c1-5ea2a93260d8` |
| `X-Staff-Id` | Mã nhân viên từ JWT claim `staffId` | `NV000001` |
| `X-User-Roles` | Scope từ JWT | `ROLE_ADMIN` hoặc `ROLE_USER` |

---

## 8. Password Convention

| Loại tài khoản | Password mặc định | Ví dụ |
|---------------|------------------|-------|
| Admin hệ thống (SYS000001) | `SEED_ADMIN_PASSWORD` | cấu hình qua env |
| Nhân viên mới | Ngày sinh format `ddMMyyyy` | dob=1998-03-20 → password=`20031998` |
| Nhân viên mới | Ngày sinh format `ddMMyyyy` | dob=2000-07-04 → password=`04072000` |
