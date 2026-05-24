# Core Service

Attendance management and analytics service.

## Port
8082

## Responsibilities
- Attendance check-in/check-out recording
- Attendance history queries
- Analytics and reporting
- Internal M2M API for face-service sync

## Key Endpoints
- POST /attendance/check-in - Manual check-in (authenticated)
- GET /attendance/my - My attendance history
- GET /attendance/today - Today's records (ADMIN)
- GET /attendance/range - Range query (ADMIN)
- GET /attendance/staff/{id}/today - Specific staff (ADMIN)
- POST /api/internal/attendance/sync - Internal M2M (face-service)

## Security
- Stateless: reads X-User-Id, X-Staff-Id, X-User-Roles from Gateway headers
- No JWT libraries - trusts Gateway headers
- Internal API uses X-Internal-Token header with separate JWT

## Database
core_db with tables: attendances, analytics

## Tech Stack
- Spring Boot 3.x
- MySQL
- OpenFeign for auth-service calls
