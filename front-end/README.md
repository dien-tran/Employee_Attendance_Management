# Front-end

Next.js 15+ web application for Employee Attendance Management.

## Tech Stack
- Next.js 15 (output: export for static)
- TypeScript
- TailwindCSS
- shadcn/ui (@radix-ui primitives)
- Zustand (state management with persist)
- React Hook Form + Zod (validation)

## Features
- Admin Portal: Dashboard, Employee CRUD, Attendance records, Face data management
- User Portal: Profile, Attendance history, Check-in station
- AI Chatbot widget
- HttpOnly Cookie authentication (no JWT in localStorage)

## API Client
- Fetch API based with credentials: 'include'
- Calls same-origin /api via nginx proxy
- Services: auth.service.ts, staff.service.ts, profile.service.ts

## Docker
- Static export served by Nginx
- Proxy /api requests to api-gateway:8080
- Port 3000 on host

## Dev
```bash
cd frontend && npm run dev
```

## E2E
Run via Docker: `docker compose run --rm e2e-runner`
- Playwright tests
- Uses storageState for auth
- API helpers call same origin as browser (PLAYWRIGHT_BASE_URL)
