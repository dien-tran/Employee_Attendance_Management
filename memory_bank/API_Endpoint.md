## API Endpoints - Employee Attendance Management System

> **Cổng vào duy nhất:** API Gateway `http://localhost:8080`
> **Auth Header:** `Authorization: Bearer <JWT_TOKEN>` hoặc HttpOnly Cookie `access_token`

---

## 🔐 Gateway Routes (api-gateway/application.yml)

| Route ID | Path Pattern | Upstream Service | Strip Prefix | Ghi chú |
|----------|-------------|-----------------|--------------|---------|
| `auth-service-public` | `/api/auth/**` | `lb://auth-service` | Yes (1) | `/api/auth/login` → `/auth/login` trên auth-service |
| `auth-service-staff` | `/api/staff/**` | `lb://auth-service` | No | `/api/staff` → `/api/staff` trên auth-service (port 8081) |
| `core-service` | `/api/core/**` | `lb://core-service` | Yes (1) | `/api/core/...` → `/core/...` trên core-service (port 8082) |

> ⚠️ **Lưu ý quan trọng:** Route `/api/staff/**` KHÔNG strip prefix vì `StaffController` mapping là `/api/staff`.
> Route `/api/auth/**` strip 1 prefix vì `AuthController` mapping là `/auth/login`, `/auth/introspect`, v.v.

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

### Error Responses
| HTTP Status | Khi nào | Response |
|-------------|---------|----------|
| 401 | Không có token | (empty body) |
| 403 | Token có role USER (không phải ADMIN) | `{"code":403,"message":"Access denied: ADMIN role required"}` |
| 409 | Email hoặc staffId đã tồn tại | `{"code":409,"message":"Email already exists"}` |

---

## 3. Tài khoản hệ thống mặc định (DataInitializer)

> File: `auth-service/src/main/java/com/attendance/auth/config/DataInitializer.java`
> Tự động tạo khi auth-service khởi động lần đầu (idempotent).

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | `admin123` |
| StaffId | `SYS000001` |
| Role | `ADMIN` |
| Name | `System Administrator` |
| Department | `IT` |

---

## 4. JWT Token Structure

**Algorithm:** HS512 (Nimbus JOSE JWT)
**Signed Key:** `0e796109b182226d16e5ba239be1c9ce38c78d378444b4b8e2058e914ff887b8`

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
| `X-User-Roles` | Scope từ JWT | `ROLE_ADMIN` hoặc `ROLE_USER` |

---

## 5. Password Convention

| Loại tài khoản | Password mặc định | Ví dụ |
|---------------|------------------|-------|
| Admin hệ thống (SYS000001) | `admin123` | - |
| Nhân viên mới | Ngày sinh format `ddMMyyyy` | dob=1998-03-20 → password=`20031998` |
| Nhân viên mới | Ngày sinh format `ddMMyyyy` | dob=2000-07-04 → password=`04072000` |
