---
name: backend-api
description: Thiết kế và xây dựng backend API, server-side logic, database schema,
  authentication, middleware cho web application. Dùng skill này khi user yêu cầu:
  tạo REST API endpoint, GraphQL resolver, route handler, controller, service, repository;
  thiết kế database schema hoặc migration; implement authentication/authorization (JWT, OAuth);
  viết middleware (logging, rate-limit, CORS, validation); tối ưu query hoặc cấu trúc
  project backend; hoặc bất kỳ yêu cầu nào liên quan đến server-side code.
  Luôn dùng skill này thay vì tự viết backend code từ đầu.
---

# Backend API Skill

User cung cấp yêu cầu về tính năng, resource, hoặc vấn đề cần giải quyết ở server-side.
Skill này hướng dẫn xây dựng backend chuẩn — có cấu trúc rõ ràng, dễ mở rộng, an toàn.

---

## 1. Xác định ngữ cảnh trước khi viết code

Trước khi implement, hãy xác định:

- **Stack** đang dùng (Node/Express, Node/Fastify, Python/FastAPI, Go/Gin, v.v.)
- **Database** (PostgreSQL, MySQL, MongoDB, SQLite)
- **Auth** đã có chưa (JWT, session, OAuth, API key)
- **Scope** của task: route mới, refactor, debug, hay greenfield

Nếu user không nói rõ, **mặc định dùng Node.js + Express + TypeScript + PostgreSQL + Prisma**.

---

## 2. Cấu trúc thư mục chuẩn

```
src/
├── routes/          ← khai báo endpoint, gắn middleware
├── controllers/     ← nhận request, trả response, KHÔNG chứa business logic
├── services/        ← business logic, orchestration
├── repositories/    ← tất cả database queries
├── middlewares/     ← auth, validation, logging, error handler
├── models/          ← Prisma schema hoặc ORM model definitions
├── types/           ← TypeScript interfaces, DTOs, enums
├── utils/           ← helper functions thuần túy
└── config/          ← env vars, constants, db connection
```

**Nguyên tắc phân tách:**
- Controller chỉ gọi service, không query DB trực tiếp
- Service chứa logic nghiệp vụ, gọi repository
- Repository chỉ giao tiếp với DB, không chứa business logic
- Middleware chạy trước/sau controller, xử lý cross-cutting concerns

---

## 3. Quy trình implement một Feature

```
1. Định nghĩa Resource & Endpoint
       ↓
2. Viết TypeScript Types / DTOs
       ↓
3. Viết Prisma Schema / Migration (nếu cần DB mới)
       ↓
4. Viết Repository (database queries)
       ↓
5. Viết Service (business logic)
       ↓
6. Viết Controller (request/response handling)
       ↓
7. Khai báo Route + gắn Middleware
       ↓
8. Viết Tests (unit cho service, integration cho route)
```

---

## 4. Conventions bắt buộc

### Naming
| Thành phần   | Convention              | Ví dụ                     |
|--------------|-------------------------|---------------------------|
| File         | kebab-case              | `user-service.ts`         |
| Class        | PascalCase              | `UserService`             |
| Function     | camelCase               | `getUserById`             |
| Constant     | SCREAMING_SNAKE_CASE    | `MAX_LOGIN_ATTEMPTS`      |
| DB table     | snake_case (plural)     | `users`, `refresh_tokens` |
| Env var      | SCREAMING_SNAKE_CASE    | `DATABASE_URL`            |

### HTTP & REST
- `GET /resources` — list (có pagination)
- `GET /resources/:id` — get one
- `POST /resources` — create
- `PUT /resources/:id` — replace hoàn toàn
- `PATCH /resources/:id` — update một phần
- `DELETE /resources/:id` — xóa (soft delete nếu có thể)

### HTTP Status Codes
| Tình huống                      | Code |
|---------------------------------|------|
| Thành công, có data             | 200  |
| Tạo mới thành công              | 201  |
| Thành công, không có data       | 204  |
| Sai input / validation fail     | 400  |
| Chưa đăng nhập                  | 401  |
| Không có quyền                  | 403  |
| Không tìm thấy                  | 404  |
| Conflict (trùng dữ liệu)        | 409  |
| Lỗi server                      | 500  |

---

## 5. Error Handling chuẩn

Tập trung xử lý lỗi tại một chỗ duy nhất — **global error handler middleware**.

```typescript
// types/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('Unauthorized', 401, 'UNAUTHORIZED');
  }
}
```

```typescript
// middlewares/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  console.error('[Unhandled Error]', err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
}
```

**Luôn dùng `try/catch` trong controller và service, throw `AppError` thay vì `new Error`.**

---

## 6. Response Format thống nhất

Tất cả response phải theo format này để frontend dễ xử lý:

```typescript
// Thành công
{
  "success": true,
  "data": { ... },           // object hoặc array
  "meta": {                  // chỉ có khi là list
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}

// Thất bại
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [ ... ]      // optional, chi tiết lỗi từng field
  }
}
```

---

## 7. Validation với Zod

Luôn validate input tại tầng route/middleware trước khi vào controller:

```typescript
// types/user.dto.ts
import { z } from 'zod';

export const CreateUserDto = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100),
  role: z.enum(['user', 'admin']).default('user'),
});

export type CreateUserInput = z.infer<typeof CreateUserDto>;
```

```typescript
// middlewares/validate.ts
import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types/errors';

export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors.map(e => e.message).join(', ');
      return next(new ValidationError(message));
    }
    req.body = result.data;
    next();
  };
```

---

## 8. Authentication với JWT

```typescript
// middlewares/auth.ts
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../types/errors';

export interface JwtPayload {
  userId: string;
  role: string;
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new UnauthorizedError();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw new UnauthorizedError();
  }
};

export const authorize = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
    next();
  };
```

---

## 9. Database với Prisma

**Luôn thêm các field chuẩn vào mọi model:**

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String
  role      Role      @default(USER)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // soft delete

  @@map("users")
}

enum Role {
  USER
  ADMIN
}
```

**Repository pattern:**

```typescript
// repositories/user.repository.ts
import { prisma } from '../config/database';
import { CreateUserInput } from '../types/user.dto';

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async create(data: CreateUserInput & { passwordHash: string }) {
    return prisma.user.create({ data });
  }

  async softDelete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

---

## 10. Security Checklist

Luôn kiểm tra các điểm sau trước khi hoàn thành:

- [ ] **Không** log password, token, PII ra console
- [ ] **Không** trả về password hash trong response
- [ ] Input đã được validate & sanitize
- [ ] Rate limiting cho auth endpoints
- [ ] CORS chỉ cho phép origin hợp lệ
- [ ] Dùng `helmet` để set secure HTTP headers
- [ ] Secret key trong `.env`, không hardcode
- [ ] SQL query qua ORM (không raw string interpolation)
- [ ] JWT có expiry time hợp lý (access: 15m, refresh: 7d)

---

## 11. Xem thêm (đọc khi cần)

- `references/prisma-patterns.md` — Query nâng cao, transactions, relations
- `references/auth-patterns.md` — OAuth2, refresh token rotation, session
- `references/testing-backend.md` — Unit test service, integration test route
- `references/performance.md` — Index, caching, connection pool, N+1 query
