# Auth Service

Authentication and staff management service.

## Port
8081

## Responsibilities
- User authentication (login/logout)
- JWT token creation and validation
- Staff CRUD operations (ADMIN only)
- Profile management (self)
- Token blacklist management
- Auto-seed admin account on startup

## Key Endpoints
- POST /auth/login - Login with email/password
- POST /auth/logout - Invalidate token
- POST /auth/refresh - Refresh JWT
- POST /auth/introspect - Check token validity
- POST /api/staff - Create employee (ADMIN)
- GET /api/staff - List employees (ADMIN)
- PUT /api/staff/{id} - Update employee (ADMIN)
- PATCH /api/staff/{id}/status - Change status (ADMIN)
- GET /api/profile/me - Get own profile
- PUT /api/profile/me - Update own profile

## Database
auth_db with tables: users, roles, permissions, invalidated_tokens, staffs

## Tech Stack
- Spring Boot 3.x
- spring-security-crypto (BCryptPasswordEncoder)
- nimbus-jose-jwt (HS512)
- MySQL

## Seed Account
- Email: admin@example.com
- Staff ID: SYS000001
- Password: from SEED_ADMIN_PASSWORD
