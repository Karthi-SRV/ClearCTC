# Comp Copilot — Backend

NestJS API server for the Comp Copilot compensation tool. Handles salary math, offer comparison, city living-cost data, authentication, and all AI calls.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 11 (TypeScript, Express) |
| Database | MongoDB 7 via Mongoose |
| Cache | Redis 7 via ioredis |
| Auth | JWT + bcryptjs, global `JwtAuthGuard` |
| AI | Gemini (default) · Claude · Ollama · Google Vertex · AWS Bedrock |
| Observability | prom-client metrics · nest-winston logs · Loki transport · Grafana |
| Docs | Swagger at `/api-docs` |

## Prerequisites

- Node.js 20+
- MongoDB running locally (or via Docker)
- Redis running locally (or via Docker)
- An AI provider API key (Gemini free tier is the default — no credit card required)

Start all infrastructure services with Docker Compose (from the repo root):

```bash
docker compose up -d redis mongo
```

## Setup

```bash
cd backend
npm install
cp .env.example .env   # fill in at minimum: GEMINI_API_KEY and JWT_SECRET
```

### Required environment variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Long random string — use `openssl rand -hex 32` |
| `GEMINI_API_KEY` | Free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `ADMIN_TOKEN` | Random string — passed as `X-Admin-Token` header on admin routes |

See `.env.example` for the full list including alternate AI providers (Claude, OpenAI, Bedrock, Vertex, Ollama).

### AI provider selection

Set `AI_PROVIDER` to one of: `gemini` · `claude` · `ollama` · `google`

Company AI profiling always uses Gemini regardless of `AI_PROVIDER`.

## Running

```bash
# development (watch mode)
npm run start:dev

# production build
npm run build
npm run start:prod
```

The server starts on port `3000` by default (`PORT` env overrides this). Swagger UI is available at `http://localhost:3000/api-docs`.

## Testing

```bash
# unit tests
npm test

# watch mode
npm run test:watch

# coverage report
npm run test:cov

# e2e tests
npm run test:e2e
```

## Module Structure

```
src/
├── core/                        # Shared providers, no HTTP routes
│   ├── ai/                      # AI_CLIENT, CITY_EXPENSE_AI_CLIENT, COMPANY_AI_CLIENT tokens
│   ├── city-expense/            # Redis → MongoDB → AI lookup chain for living costs
│   ├── compensation/            # Pure synchronous financial math (CTC → in-hand, tax, PF, gratuity)
│   ├── data/                    # DATA_SOURCE token — CachedDataSource (active), LiveDataSource (stub)
│   └── logger/                  # Global Winston logger with optional Loki transport
│
├── features/                    # Modules that own HTTP routes
│   ├── auth/                    # POST /api/v1/auth/signup  POST /api/v1/auth/login
│   ├── salary-ask/              # POST /api/v1/salary-asks          (Phase 1 — no AI, public)
│   ├── salary-comparison/       # POST /api/v1/salary-comparisons   (Phase 2 lite — no AI, JWT)
│   ├── offer-comparison/        # POST /api/v1/offer-comparisons    (Phase 2 full — AI, JWT)
│   ├── city-expense/            # GET  /api/v1/city-expenses        GET /api/v1/cities
│   │   └── admin/               # POST /api/v1/city-expenses/refresh (admin token)
│   └── health/                  # GET  /health
│
└── shared/
    ├── decorators/              # @Public(), @CurrentUser(), custom validators
    ├── filters/                 # AiExceptionFilter → 502 on AI parse failure
    ├── guards/                  # JwtAuthGuard (global), AdminGuard, AiThrottlerGuard
    ├── interceptors/            # LoggingInterceptor
    └── schemas/                 # Mongoose schemas: users, companies, city-expenses, offers
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/signup` | Public | Create account + compensation profile |
| `POST` | `/api/v1/auth/login` | Public | Returns JWT |
| `POST` | `/api/v1/salary-asks` | Public | Phase 1 — equivalent salary across cities |
| `GET` | `/api/v1/cities` | Public | List of supported cities |
| `GET` | `/api/v1/city-expenses` | Public | Living costs for a city + family size |
| `POST` | `/api/v1/salary-comparisons` | JWT | Phase 2 lite — deterministic offer snapshot |
| `GET` | `/api/v1/salary-comparisons/companies` | JWT | List of seeded companies |
| `POST` | `/api/v1/offer-comparisons` | JWT | Phase 2 full — AI-ranked offer comparison |
| `POST` | `/api/v1/city-expenses/refresh` | Admin token | Refresh cached city expense data |
| `GET` | `/health` | Public | Health check |
| `GET` | `/metrics` | Public | Prometheus metrics |
| `GET` | `/api-docs` | Public | Swagger UI |

## Trust Boundary

All money math lives in `CompensationService` as pure, tested functions. The AI receives already-computed numbers and reasons over them — it never originates a figure with financial consequence. AI responses are validated (score bounds, breakdown sum, offer name match) before merging with deterministic data. A validation failure returns `502`; no raw model text ever reaches the client.

## Linting & Formatting

```bash
npm run lint      # ESLint with auto-fix
npm run format    # Prettier
```
