# Employee Attendance Management System

A microservices-based attendance management system with face recognition capabilities.

## Architecture

Microservices architecture with 7 services:

1. **api-gateway** (port 8080) - Spring Cloud Gateway for routing and JWT authentication proxy
2. **auth-service** (port 8081) - Authentication, user management, staff CRUD
3. **core-service** (port 8082) - Attendance records, check-in/out, analytics
4. **eureka-service** (port 8761) - Service registry for service discovery
5. **face-service** - Face recognition and biometrics processing
6. **chat-service** - AI chatbot for HR queries (Python/FastAPI)
7. **front-end** - Next.js web application

---

## Quick Start

```bash
cp .env.example .env
# Edit .env with your configuration
docker compose up --build -d
```

Check health: `curl http://localhost:8080/api/chatbot/health`

Default Admin: admin@example.com / SEED_ADMIN_PASSWORD / SYS000001

---

## Service Details

### 1. API Gateway (api-gateway)

**Port**: 8080

**Responsibilities**:
- Centralized entry point for all /api/** requests
- Dynamic routing to microservices via Eureka service registry
- JWT authentication: reads HttpOnly Cookie, verifies token signature (HS512), checks blacklist via auth-service
- Injects internal headers: X-User-Id, X-Staff-Id, X-User-Roles
- Rate limiting and logging

**Routes:**
- /api/auth/** -> auth-service (strip prefix 1)
- /api/staff/** -> auth-service (no strip)
- /api/profile/** -> auth-service (no strip)
- /api/core/** -> core-service (strip prefix 2)

**Tech Stack:** Spring Boot 3.x, Spring Cloud Gateway, Spring WebFlux, Netflix Eureka Client

---

### 2. Auth Service (auth-service)

**Port:** 8081

**Responsibilities:**
- User authentication (login/logout)
- JWT token creation and validation (HS512)
- Staff CRUD operations (ADMIN only)
- Profile management (self)
- Token blacklist management
- Auto-seed admin account on startup

**Key Endpoints:**
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

**Database:** auth_db with tables: users, roles, permissions, invalidated_tokens, staffs

**Seed Account:** admin@example.com, SYS000001, password from SEED_ADMIN_PASSWORD

**Tech Stack:** Spring Boot 3.x, spring-security-crypto, nimbus-jose-jwt, MySQL

---

### 3. Core Service (core-service)

**Port:** 8082

**Responsibilities:**
- Attendance check-in/check-out recording
- Attendance history queries
- Analytics and reporting
- Internal M2M API for face-service sync

**Key Endpoints:**
- POST /attendance/check-in - Manual check-in (authenticated)
- GET /attendance/my - My attendance history
- GET /attendance/today - Today's records (ADMIN)
- GET /attendance/range - Range query (ADMIN)
- GET /attendance/staff/{id}/today - Specific staff (ADMIN)
- POST /api/internal/attendance/sync - Internal M2M (face-service)

**Security:** Stateless - reads X-User-Id, X-Staff-Id, X-User-Roles from Gateway headers. No JWT libraries.

**Database:** core_db with tables: attendances, analytics

**Tech Stack:** Spring Boot 3.x, MySQL, OpenFeign

---

### 4. Eureka Service (eureka-service)

**Port:** 8761

**Responsibilities:**
- Service registration: all microservices register on startup
- Service discovery: provides service locations to Gateway and other services
- Health monitoring

**Tech Stack:** Spring Boot 3.x, spring-cloud-starter-netflix-eureka-server

---

### 5. Face Service (face-service)

**Port:** 8000 (backend), 3000 (frontend test)

**Tech Stack:** Python 3, FastAPI, InsightFace (buffalo_l), MiniFASNet, Qdrant, MySQL

**Key Features:**

#### Face Enrollment
- WebSocket endpoint: /api/v1/enroll/ws
- Multi-frame capture for quality
- Pipeline: Detection -> Anti-Spoofing -> Quality Gate -> Embedding
- Average and L2-normalize embeddings before saving to Qdrant
- Metadata: employee_id, full_name, date_of_birth (ISO YYYY-MM-DD)

#### Check-in/Check-out
- WebSocket endpoint: /api/v1/checkin/ws
- Real-time face recognition via camera
- Anti-spoofing on all frames
- Cooldown mechanism to prevent duplicate check-ins
- Syncs attendance records via internal API to core-service

#### Quality Gate
Checks: blur, brightness, pitch/yaw <= 20°, face size. Rejects noisy/eye-closed/angled frames.

#### Anti-Spoofing
- Live score detection for photo/screen attacks
- Uses MiniFASNet model
- Default color space: bgr (OpenCV)

**Directory Structure:**
```
app/
  api/v1/ - API endpoints & WebSocket routers
  pipeline/ - Enrollment and Checkin pipelines
  services/ - AI services (detection, embedding, vector_db)
  schemas/ - Pydantic models
  core/ - Config, exceptions, dependencies
  utils/ - Helper functions
config/config.yaml - Configuration
models/ - Model weights (git-lfs)
frontend/ - Next.js test UI
```

**Dev Commands:**
- Backend: `docker compose up -d backend`
- Frontend: `cd frontend && npm run dev`
- CPU: `pip install -r requirements-cpu.txt`
- GPU: `pip install -r requirements-gpu.txt`

**Key Rules:**
- All parameters from config.yaml, no hardcoding
- Quality Gate before embedding
- L2-normalize before Qdrant save
- Use singleton services from get_service_container()
- WebSocket schema validation required

---

### 6. Chat Service (chat-service)

**Port:** 8000 (FastAPI)

**Architecture:** Three-layer agent system:
1. **orchestrator_agent** - LLM classifier routes to wiki|auth-db|core-db|composed
2. **llm_wiki_agent** - Handles staff/attendance questions via markdown summaries
3. **mysql_agent** - NL to SQL execution on auth_db and core_db

**Key Endpoints:**
- GET /health - Health check
- POST /message - API facade for frontend
- POST /ask - mysql_agent
- POST /ask-wiki - llm_wiki_agent
- POST /ask-orchestrated - orchestrator routing
- POST /generate-sql - SQL generation
- POST /execute-sql - SQL execution

**ETL Pipeline:**
- Scripts in scripts/hr_etl/
- Generates staff_summary.md and attendance_summary.md
- Runs on startup (if core_db.attendances empty)
- Scheduled every 300s (5 minutes)

**Mock Data:** Seeds 100 staffs and 5000 attendance events
Top departments: Operations(23), Admin(14), IT(14), Marketing(13), Sales(13)

**Tech Stack:** Python 3.12+, FastAPI, LLM provider: chutes|openrouter, MySQL dual-source

**Env Variables:**
- AUTH_DB_*, CORE_DB_* - database connections
- LLM_PROVIDER - chutes|openrouter
- CHUTES_API_KEY / OPENROUTER_API_KEY
- CLASSIFIER_CONFIDENCE_THRESHOLD (default 0.6)

---

### 7. Front-end (front-end)

**Tech Stack:** Next.js 15 (output: export for static), TypeScript, TailwindCSS, shadcn/ui, Zustand, React Hook Form + Zod

**Features:**
- Admin Portal: Dashboard, Employee CRUD, Attendance records, Face data management
- User Portal: Profile, Attendance history, Check-in station
- AI Chatbot widget
- HttpOnly Cookie authentication (no JWT in localStorage)

**API Client:** Fetch API based with credentials: 'include'. Calls same-origin /api via nginx proxy.

**Docker:** Static export served by Nginx. Proxy /api requests to api-gateway:8080. Port 3000 on host.

---

## Database Schema

### auth_db
- users, roles, permissions, invalidated_tokens, staffs (has_face column)

### core_db
- attendances, analytics

---

## Environment Setup

Copy .env.example to .env and configure:
- SIGNED_KEY - JWT signing key (min 64 bytes), shared between api-gateway and auth-service
- DB credentials for auth_db and core_db
- LLM provider keys for chat-service
- SEED_ADMIN_* variables for initial admin setup
- INTERNAL_JWT_SIGNED_KEY for face-service M2M communication

---

## API Endpoints Summary

### Authentication (/api/auth)
- POST /api/auth/login - Login
- POST /api/auth/logout - Logout
- POST /api/auth/refresh - Refresh token
- POST /api/auth/introspect - Check token

### Staff Management (/api/staff)
- POST /api/staff - Create (ADMIN)
- GET /api/staff - List (ADMIN)
- PUT /api/staff/{id} - Update (ADMIN)
- PATCH /api/staff/{id}/status - Change status (ADMIN)

### Profile (/api/profile)
- GET /api/profile/me - Get own profile
- PUT /api/profile/me - Update own profile

### Attendance (/api/core/attendance)
- POST /api/core/attendance/check-in - Check-in
- GET /api/core/attendance/my - My history
- GET /api/core/attendance/today - Today (ADMIN)
- GET /api/core/attendance/range - Range query (ADMIN)

### Chatbot (/api/chatbot)
- POST /api/chatbot/message - Send message
- GET /api/chatbot/health - Health check

### Face Service
- WS /api/v1/enroll/ws - Face enrollment
- WS /api/v1/checkin/ws - Check-in/check-out

---

## Key Conventions

- Password convention: ddMMyyyy from date of birth
- StaffId format: NV + 6 digits (e.g., NV000001)
- Admin StaffId: SYS000001
- JWT Algorithm: HS512 (Nimbus JOSE JWT)
- Token duration: 86400 seconds (24 hours)
- Internal M2M JWT uses INTERNAL_JWT_SIGNED_KEY with scope attendance:sync

---

## Lessons Learned

1. API Gateway routes must match Controller mappings (strip prefix logic)
2. WebClient DTOs must match exact JSON response structure
3. Core Service must NOT import JWT libraries
4. Frontend calls same-origin /api via nginx, not direct Docker DNS
5. E2E tests must use same origin for API helpers as browser session
6. Quality Gate runs before embedding in face pipeline
7. Embeddings must be L2-normalized before saving to Qdrant
