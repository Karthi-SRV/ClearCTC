# clearctc-devstack

Local development quick-start for the clearctc monorepo. Use this skill when the user asks how to run the app, restart services, run tests, or seed data.

**Trigger:** `/clearctc-devstack`

---

## Repository layout

```
clearctc/
├── backend/          NestJS API — port 3000
├── web/              React (Vite) frontend — port 5173
├── scripts/          seed.ts (companies + cities), infra.sh
├── infra/            docker-compose, Prometheus, Grafana configs
└── docs/             requirements, design, architecture, tasks
```

Working directory for all backend commands: `backend/`
Working directory for all frontend commands: `web/`

---

## Prerequisites

- Node 24 (local runtime confirmed v24.14.0)
- Docker Desktop running
- `.env` in `backend/` — copy from `backend/.env.example` and fill secrets

Minimum required env vars:
```
MONGODB_URI=mongodb://localhost:27017/clearctc
REDIS_URL=redis://localhost:6379
JWT_SECRET=<any-long-random-string>
GEMINI_API_KEY=<from-aistudio.google.com>
AI_PROVIDER=gemini
```

---

## Start the full stack

### 1. Infrastructure (MongoDB + Redis + Grafana + Loki + Prometheus)
```bash
docker compose up -d
```
Confirm healthy:
```bash
curl -s http://localhost:3000/health  # → { "status": "ok", "db": "connected", "cache": "ok" }
```

### 2. Backend
```bash
cd backend
npm install          # first time only
npm run start:dev    # watch mode — reloads on save
```

### 3. Frontend
```bash
cd web
npm install          # first time only
npm run dev          # Vite dev server → http://localhost:5173
```

### 4. Seed companies (optional — runs automatically on backend startup)
The backend seeds Gemini-generated company profiles via `onApplicationBootstrap` in `DataModule`. To run manually:
```bash
cd ..   # project root
NODE_PATH=./backend/node_modules ./backend/node_modules/.bin/ts-node \
  --project scripts/tsconfig.json scripts/seed.ts
```
Seed is idempotent. Re-running never duplicates documents.

**Gemini rate limit:** 15 RPM. Seed calls are sequential with 15-second gaps. If `[GEMINI_QUOTA_EXHAUSTED]` appears in logs, the seed loop aborts — run again tomorrow.

---

## Run tests

```bash
cd backend
npm test                    # all tests
npm run test:cov            # with coverage (target: 80%+)
npx jest --testPathPattern="city-expense"   # filter by pattern
```

Frontend (Vitest):
```bash
cd web
npm test
```

Type-check both:
```bash
cd backend && npx tsc --noEmit
cd web && npx tsc --noEmit
```

---

## Stop everything

```bash
docker compose down          # stop infra (keeps volumes)
docker compose down -v       # stop + wipe data volumes
```

Kill backend/frontend: Ctrl+C in their terminal windows.

---

## Verify the full flow

1. `GET /health` → `{ status: "ok" }`
2. `POST /api/auth/signup` → JWT in response (not in any browser storage)
3. `GET /api/phase1/cities` → list of 35+ cities
4. `POST /api/phase1/salary-ask` → COL-adjusted salary table
5. `POST /api/phase2/quick-compare` → deterministic offer comparison (no AI)
6. `POST /api/phase2/compare` → Gemini-ranked offer comparison

---

## Common issues

| Symptom | Fix |
|---------|-----|
| MongoDB connection refused | `docker compose up -d mongo` |
| Redis PING fails | `docker compose up -d redis` |
| Gemini 429 on seed | Wait 1 min; seed auto-retries with backoff |
| `[GEMINI_QUOTA_EXHAUSTED]` in logs | Daily quota hit; switch `AI_PROVIDER=ollama` for local dev |
| Port 3000 already in use | `pkill -f "nest start"` |
| `tsc --noEmit` errors on DTOs | Expected if `strictPropertyInitialization: true` — it is intentionally `false` in backend |
