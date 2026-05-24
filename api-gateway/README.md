# API Gateway Service

Spring Cloud Gateway service handling request routing and JWT authentication proxy.

## Port
8080

## Responsibilities
- Centralized entry point for all /api/** requests
- Dynamic routing to microservices via Eureka service registry
- JWT authentication: reads HttpOnly Cookie, verifies token signature (HS512), checks blacklist via auth-service
- Injects internal headers: X-User-Id, X-Staff-Id, X-User-Roles
- Rate limiting and logging

## Key Configuration
- Routes defined in application.yml
- SIGNED_KEY shared with auth-service for JWT verification
- Eureka client for service discovery

## Routes
- /api/auth/** -> auth-service (strip prefix 1)
- /api/staff/** -> auth-service (no strip)
- /api/profile/** -> auth-service (no strip)
- /api/core/** -> core-service (strip prefix 2)

## Tech Stack
- Spring Boot 3.x
- Spring Cloud Gateway
- Spring WebFlux (reactive)
- Netflix Eureka Client
