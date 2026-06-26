# ClearCTC

ClearCTC is a full-stack compensation evaluation tool designed specifically for Indian software engineers switching jobs. It helps candidates make informed decisions across two distinct phases of their career transition: before HR conversations begin (estimating city-adjusted salaries) and after offers arrive (comparing actual take-home pay, benefits, market benchmarks, and company reviews).

---

## Key Features & Phases

### 🔄 Phase 1: Before HR Talks (Salary Ask Evaluator)
- **Objective:** Evaluate equivalent salaries across 35+ Indian cities.
- **Workflow:** Enter current city, current CTC, and expected hike percentage.
- **Output:** View real cost-of-living adjustments and equivalent CTC values tailored to family size (from individuals to families of 6).
- **Execution:** Pure deterministic math and database lookup. **No AI calls** are executed for this phase, ensuring maximum speed and consistency.

### ⚖️ Phase 2: After Offers Arrive (Offer Comparison)
Compare 2–3 actual job offers on real take-home pay (factoring in the new-regime income tax slabs, PF deductions, gratuity, and city cost of living).
1. **Quick Comparison (Phase 2 Lite):**
   - A fully deterministic snapshot of offers showing cash component, retirals, standard tax deductions, and take-home pay. **No AI calls** are made.
2. **AI Comparison (Phase 2 Full):**
   - Utilizes a secure, server-side LLM (Gemini) to score and rank offers, benchmark them against market roles, and summarize employee ratings/reviews.
   - Every claim made by the AI is strictly cited from the underlying deterministic numbers or seeded database profiles.

---

## 🛡️ The Trust Boundary (Core Philosophy)

To prevent AI hallucination of critical details, ClearCTC implements a strict **Trust Boundary** between deterministic calculations and AI reasoning:

> [!IMPORTANT]
> **The AI reasons and explains, but it NEVER originates a financial fact or modifies money calculations.**

| What the AI CAN Do | What the AI CANNOT Do |
| :--- | :--- |
| Rank and compare offers using numbers supplied to it | Compute take-home salaries or tax figures itself |
| Reason over provided market salary benchmarks | Invent a salary benchmark or compensation figure |
| Summarize supplied reviews and rating dimensions | Invent reviews, ratings, or company details |
| Echo calculated confidence levels and highlight risk flags | Originate or modify numerical confidence scores |

All financial math (CTC breakdown to in-hand, tax slabs, PF, gratuity, and COL adjustments) is written as pure, synchronously testable TypeScript functions in `CompensationService`. The backend computes these numbers and sends the final, structured JSON to the AI for analysis. AI responses are strictly validated against schema boundaries, score ranges, and name matches before being merged and served to the client (returning a `502 Bad Gateway` on validation failure).

---

## 💻 Tech Stack

### Frontend (`/web`)
* **Framework:** React 19 + TypeScript (built with Vite 8)
* **Routing:** React Router DOM 7
* **Styling:** Custom CSS (no UI component libraries or Tailwind CSS)
* **State Management:** React Memory (no `localStorage`, `sessionStorage`, or `IndexedDB` is used to ensure privacy/security)
* **Testing:** Vitest

### Backend (`/backend`)
* **Framework:** NestJS 11 (Express, TypeScript)
* **Database:** MongoDB 7 (via Mongoose)
* **Caching:** Redis 7 (via `ioredis`) for caching city expenses
* **AI Engine:**
  - `COMPANY_AI_CLIENT`: Always Gemini (free tier) for profiling and comparing companies.
  - `CITY_EXPENSE_AI_CLIENT` & `AI_CLIENT`: Selectable via env (`gemini` · `claude` · `ollama` · `google`). Defaults to Ollama/Gemini.
* **Observability:** Prometheus metrics (`prom-client`), Winston logger (`nest-winston`), Loki transport, Grafana dashboards.
* **Documentation:** Swagger UI at `/api-docs`

---

## 📂 Directory Structure

```
clearctc/
├── backend/                  # NestJS backend application
│   ├── src/
│   │   ├── core/             # Shared business logic, database wrappers, financial math (no controllers)
│   │   ├── features/         # Features owning HTTP routes (auth, offer comparison, etc.)
│   │   └── shared/           # Schemas, decorators, guards, filters, interceptors
│   ├── test/                 # Integration and E2E tests
│   └── scripts/              # Seeding and utility scripts
├── web/                      # React frontend application
│   ├── src/
│   │   ├── components/       # Shared UI components (Forms, Result display tables)
│   │   ├── context/          # Auth, Cities, and Companies state
│   │   ├── hooks/            # useApi and useApiFetch hooks
│   │   ├── pages/            # View components linked to routes
│   │   └── utils/            # Client formatting utilities
├── docs/                     # Design specs, requirements, and architecture docs
├── infra/                    # Observability config (Prometheus & Grafana provisioning)
└── docker-compose.yml        # Multi-container local infra (Mongo, Redis, Grafana, Loki, Ollama)
```

---

## 🚀 Setup & Local Running

### Prerequisites
* Node.js 20+
* Docker Desktop

### 1. Spin Up Infrastructure
Start the database, cache, and monitoring tools from the root directory:
```bash
docker compose up -d
```
This boots up:
* **MongoDB** on `mongodb://localhost:28090`
* **Redis** on `redis://localhost:6379`
* **Prometheus** on `http://localhost:9090`
* **Grafana** on `http://localhost:3001`
* **Loki** on `http://localhost:3100`
* **Ollama** on `http://localhost:11434`

### 2. Configure Backend
Copy `.env.example` to `.env` in the `backend` folder and populate the required keys:
```bash
cd backend
cp .env.example .env
```
Key configuration items:
* `GEMINI_API_KEY`: Obtain a free key from [Google AI Studio](https://aistudio.google.com/apikey).
* `JWT_SECRET`: Generate a secure key (e.g., `openssl rand -hex 32`).
* `ADMIN_TOKEN`: A private key for admin endpoints (passed as `X-Admin-Token` header).
* `AI_PROVIDER`: Choose your preferred runtime LLM (`gemini`, `claude`, `ollama`, or `google`).

Install backend dependencies and run the seed script to populate initial cities and companies:
```bash
npm install
npm run seed     # Seeds companies & cities (idempotent)
```

### 3. Configure Frontend
Navigate to the `web` directory, copy the example environment file, install dependencies, and start the development server:
```bash
cd ../web
cp .env.example .env   # configured with default port and API proxy target
npm install
npm run dev
```

* The frontend development server will launch on `http://localhost:5173` (or the `VITE_PORT` specified in `.env`).
* The server proxies `/api/*` requests to the NestJS backend (configured via `VITE_API_URL` in `.env`) automatically.

---

## 🏃 Run Commands

### Backend Commands
From the `backend/` folder:
```bash
# Start watch mode
npm run start:dev

# Run unit tests
npm test

# Run e2e tests
npm run test:e2e

# Code formatting & linting
npm run format
npm run lint
```

### Frontend Commands
From the `web/` folder:
```bash
# Start Vite dev server
npm run dev

# Run Vitest test runner
npm test

# Build production app
npm run build
```

---

## 📊 Observability & Metrics

ClearCTC has pre-configured Grafana dashboards to monitor your application:
1. Open Grafana at `http://localhost:3001` (login credentials are defined in your root `.env` / default variables).
2. The dashboard shows API request metrics, latency percentiles, error rates, and system resources from `/metrics`.
3. View logs in real-time aggregated through Loki via Winston transports.

## 📄 License

This project is licensed under the ISC License.
