# Task 4.1 - Environment & Secret Audit

## Scope

- `docker-compose.yml`
- Backend service configs: `auth-service`, `api-gateway`, `core-service`, `eureka-service`
- Frontend runtime API routing: `front-end/nginx.conf`, `front-end/lib/api-client.ts`
- E2E setup and project documentation

## Findings & Fixes

| Area | Finding | Fix |
| --- | --- | --- |
| JWT | Shared JWT signing key was committed in Spring configs, Compose, and docs. | `SIGNED_KEY` is now required from environment for `auth-service` and `api-gateway`; docs are redacted. |
| Databases | MySQL root/app credentials were hardcoded as `root`. | Compose now requires per-service DB credentials from `.env`; Spring reads `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`. |
| Admin seed | Admin seed email/password were hardcoded in `DataInitializer`. | Seed is controlled by `SEED_ADMIN_*` env vars and disabled by default outside Compose. |
| Frontend proxy | Nginx proxied to a fixed `api-gateway:8080` URL. | Nginx config is rendered as an env template using `API_GATEWAY_URL`. |
| E2E auth | Admin E2E credentials had committed fallbacks. | E2E auth setup now requires `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, and `E2E_USER_PASSWORD`. |
| Env files | Root repo had no `.gitignore` entry for `.env`. | Added root `.gitignore`; `.env.example` is the only allowed env file. |

## K8s Mapping

Use ConfigMap for non-sensitive values:

- `SERVER_PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `EUREKA_URL`
- `AUTH_INTROSPECT_URL`
- `API_GATEWAY_URL`
- `SEED_ADMIN_ENABLED`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_STAFF_ID`

Use Secret for sensitive values:

- `SIGNED_KEY`
- `DB_USERNAME`
- `DB_PASSWORD`
- database root/admin passwords
- `SEED_ADMIN_PASSWORD`
- E2E credentials in test namespaces

## Verification

- No tracked `.env`, key, pem, p12, or jks files were found via `git ls-files`.
- The previously committed JWT key and `admin123` credential were removed/redacted from runtime configs and docs.
