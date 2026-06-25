# Architecture

Compensation Copilot — backend architecture reference.  
Stack: NestJS (TypeScript) · MongoDB (Mongoose) · Redis · AI (Ollama / Gemini)

---

## What the app does

Two-phase compensation tool for Indian software engineers switching jobs.

**Phase 1 — before HR talks:** given your current city + CTC + expected hike, compare equivalent salary across 35+ Indian cities, accounting for cost-of-living differences and actual monthly living expenses by family size.

**Phase 2 — after offers arrive:** compare 2–3 real offers on actual take-home (new-regime tax, PF, gratuity, COL), benchmark against market data, and layer in employer-review sentiment — all with sources cited and AI-originated facts explicitly forbidden.

---

## The core rule: trust boundary

The AI reasons and explains. It never originates a number.

| AI may | AI may not |
|--------|------------|
| Rank/compare offers using numbers supplied to it | Compute take-home itself |
| Reason over salary benchmarks supplied to it | Invent a benchmark or salary figure |
| Summarize supplied review text | Invent reviews or ratings |
| Explain reasoning, echo confidence level, flag risk | Originate or modify any numeric confidence figure |

All money math lives in `CompensationService` as deterministic pure functions with unit tests. The AI receives already-computed numbers and reasons over them.

---

## Directory layout

```
backend/src/
├── app.module.ts               root module, global guards and interceptors
├── main.ts                     bootstrap, CORS, shutdown, company seed trigger
├── core/                       reusable providers — no controllers
│   ├── ai/                     AI client abstraction + concrete clients
│   ├── city-expense/           city cost-of-living: DB + Redis + AI fetch
│   ├── compensation/           deterministic financial engine (pure, no AI)
│   ├── data/                   company data: DataSource interface + implementation
│   └── logger/                 global Winston logger module
├── features/                   HTTP-facing features — one controller each
│   ├── auth/                   signup / login (JWT)
│   ├── city-expense/           public city list + expense query + admin refresh
│   ├── health/                 GET /health
│   ├── offer-comparison/       Phase 2 — AI-augmented offer comparison
│   ├── salary-ask/             Phase 1 — city salary equivalence map
│   └── salary-comparison/      Phase 2 lite — deterministic-only offer snapshot
└── shared/                     plain TypeScript — schemas, DTOs, guards, filters
    ├── decorators/
    ├── dtos/
    ├── filters/
    ├── guards/
    ├── interceptors/
    ├── interfaces/
    └── schemas/
```

---

## Module dependency graph

```
AppModule
├── LoggerModule (@Global)       Winston logger, available everywhere
├── AuthModule                   JWT signup/login; owns UserModel
├── SalaryAskModule              Phase 1
│   ├── CompensationModule
│   ├── DataModule (DATA_SOURCE)
│   └── CityExpenseModule
├── OfferComparisonModule        Phase 2 — full AI comparison
│   ├── CompensationModule
│   ├── DataModule
│   ├── CityExpenseModule
│   ├── AiModule (COMPANY_AI_CLIENT)
│   └── UserModel, OfferModel
├── SalaryComparisonModule       Phase 2 lite — deterministic snapshots only
│   ├── CompensationModule
│   ├── DataModule
│   ├── CityExpenseModule
│   └── UserModel
├── CityExpenseAdminModule       Admin refresh endpoint (protected)
│   └── CityExpenseModule
└── HealthModule                 GET /health — DB ready-state check
```

---

## Core modules

### CompensationModule

Pure math — zero AI, zero DB, zero async. All functions are synchronous and independently unit-testable.

**Key formulas (new-regime FY2025-26):**

| Step | Formula |
|------|---------|
| Variable | `totalCTC × variablePct / 100` |
| Basic | `50% × (totalCTC − joiningBonus − variable)` |
| Employee PF | `12% × min(monthlyBasic, ₹15,000) × 12` |
| Employer PF | `employeePfAnnual` when statutory; 0 when none |
| Gratuity accrual | `(15 × monthlyBasic × 1) / 26` (per-year estimate) |
| Fixed pay | `totalCTC − variable − employerPF − gratuity − joiningBonus` (residual) |
| Effective CTC | `fixedPay + variable` (if guaranteed) or just `fixedPay` |
| Taxable income | `effectiveCTC − ₹75,000 standard deduction` |
| Tax | New-regime slabs; 87A rebate (₹60,000) when taxable ≤ ₹12 L; 4% cess |
| Monthly in-hand | `(effectiveCTC − employeePF − tax) / 12` |

**Exports:** `computeTax`, `computeEmployeePF`, `computeGratuityAccrual`, `computeOfferSnapshot`, `computeMonthlyInHandFromLpa`, `computeSalaryRange`, `computeConfidence`

**Reconciliation invariant** (tested):
`fixedPay + variable + employerPF + gratuity + joiningBonus === totalCTC` (±1 INR rounding)

---

### AiModule

Provides three injection tokens. Consumers inject a token — never a concrete client class.

| Token | Wired to | Used by |
|-------|----------|---------|
| `AI_CLIENT` | selected by `AI_PROVIDER` env (ollama / gemini / claude / google) | generic |
| `CITY_EXPENSE_AI_CLIENT` | same as `AI_CLIENT` (follows `AI_PROVIDER`) | CityExpenseFetchService |
| `COMPANY_AI_CLIENT` | always `GeminiAiClient` | CompanyFetchService, CompanyAiProfileService, OfferComparisonService |

**Concrete clients:**

- **`OllamaAiClient`** — local LLM via `POST /api/chat`. Default model: `llama3.2`. Configured by `OLLAMA_BASE_URL`, `OLLAMA_MODEL`.
- **`GeminiAiClient`** — Google AI Studio free tier (15 RPM). Uses raw `fetch` to `generativelanguage.googleapis.com`. Configured by `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.0-flash`). Detects hard quota exhaustion vs soft rate-limit 429s: hard quota → throws with `[GEMINI_QUOTA_EXHAUSTED]` prefix immediately; rate-limit → retries with backoff (15 s → 30 s → 60 s, max 3 attempts).
- **`ClaudeAiClient`** — Anthropic API. Configured by `CLAUDE_API_KEY`.
- **`GoogleAiClient`** — alternative Google client.

All clients extend `AiResponseParser`, which strips code fences before JSON parsing.

---

### DataModule

Binds `DATA_SOURCE` token to `CachedDataSource`.

**`CachedDataSource`** reads the `companies` MongoDB collection for:
- `getCompany(name)` — fuzzy case-insensitive match on name or aliases
- `getBenchmark(company, role, experienceYears)` — role title match + experience range lookup
- `getCOLIndex(city)` — in-memory lookup table, 70+ Indian cities, Bangalore = 100
- `getCompanyNames()` — sorted list for frontend dropdown

**`LiveDataSource`** is a stub that throws "not enabled for demo" on every method. It exists as the adapter slot for future live scraping; consumers never import it directly.

**`CompanyFetchService`** — calls `COMPANY_AI_CLIENT` (Gemini) to generate company data (aliases, role benchmarks, ratings, reviews) for companies not yet in MongoDB.

**`CompanyAiProfileService`** — called from `main.ts` after app start. For each company in MongoDB missing roles or aiProfile, calls Gemini in sequence with 15 s gaps (stays under free-tier 15 RPM). Aborts loop immediately on `[GEMINI_QUOTA_EXHAUSTED]` prefix; logs warning and continues on other errors.

**Seed script:** `scripts/seed.ts` — inserts ~200 Indian tech company names (name-only) into the `companies` collection and 35 city names into `city-expenses`. Run once before first launch. Idempotent.

---

### CityExpenseModule

Provides city living-expense data for any (city, familyType, memberCount) combination.

**Schema** (`city-expenses` collection) — one document per city:
```
city: string (unique)
individual: ExpenseBreakdown    # 1 person
family:     ExpenseBreakdown    # 2 members
family3:    ExpenseBreakdown    # 3 members
family4:    ExpenseBreakdown    # 4 members
family5:    ExpenseBreakdown    # 5 members
family6:    ExpenseBreakdown    # 6 members
generatedBy, generatedAt, modelUsed, disclaimer
```

`ExpenseBreakdown`: `rent + groceries + utilities + transport + foodDining + personalLifestyle + miscellaneous + total`

**`CityExpenseCacheService`** — Redis cache with 7-day TTL. Cache key: `city-expense:{city_lowercase}`.

**`CityExpenseFetchService`** — calls `CITY_EXPENSE_AI_CLIENT` (Ollama by default) to generate all 6 family-size breakdowns in a single prompt. AI must return valid JSON with exact integer arithmetic; total is auto-corrected if AI arithmetic is off.

**`CityExpenseService`** — lookup order:
1. Redis → hit → `resolveVirtualBreakdown(doc, familyType, memberCount)` picks the right sub-object
2. MongoDB → fresh (< 30 days) → cache → return
3. MongoDB → stale → return stale immediately + trigger background refresh
4. Not found → call AI fetch → store → return
5. AI fails with no fallback → throw `CityExpenseUnavailableError`

On startup: syncs existing MongoDB docs to Redis, then starts a 15-second polling loop to fetch expenses for any city in DB that is missing its breakdown.

---

## Database collections

| Collection | Purpose | Key fields |
|------------|---------|------------|
| `users` | Auth + compensation profile | email (unique), passwordHash, currentCity, currentCtcLpa, basicPayLpa, variablePayLpa, isFixed, expectedHikePct, currentRole, preferredCities |
| `companies` | Cached company data | name (unique), aliases, roles[], ratings[], reviews[], dataAsOf, aiProfile |
| `city-expenses` | City living costs by family size | city (unique), individual, family, family3–6 (ExpenseBreakdown objects), generatedAt |
| `offers` | Persisted offer snapshots | userId (ref), inputs (raw DTO), snapshot (computed result) |

---

## HTTP API

All endpoints under `/api/v1/` require JWT (`Authorization: Bearer <token>`) unless marked public.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/signup` | public | Register + return JWT + user |
| POST | `/api/v1/auth/login` | public | Login + return JWT + user |
| GET | `/api/v1/salary-asks/cities` | public | List of 35+ supported cities |
| POST | `/api/v1/salary-asks` | public | Phase 1 — city salary equivalence map |
| POST | `/api/v1/offer-comparisons` | JWT | Phase 2 — AI offer comparison |
| POST | `/api/v1/salary-comparisons` | JWT | Phase 2 lite — deterministic snapshots |
| GET | `/api/v1/salary-comparisons/companies` | public | List of seeded company names |
| GET | `/api/v1/cities` | public | City names available in expense DB |
| GET | `/api/v1/city-expenses` | JWT | Expense data (all or ?city=X filter) |
| POST | `/api/v1/city-expenses/refresh` | admin | Force-refresh city expense via AI |
| GET | `/health` | public | `{ status: "ok", db: "connected" }` |

---

## Feature flows

### POST /api/v1/salary-asks — Phase 1

Input: `currentCity`, `currentCtcLpa`, `expectedIncrementPct`, `familyType` (individual/family, default family), `memberCount` (2–6, default 4)

1. Compute hiked CTC after expected increment.
2. Fetch COL indices for current city + all 35 standard cities in parallel.
3. Fetch city expense breakdowns for all cities in parallel (`getExpenseBreakdown`).
4. For each city: derive equivalent CTC = `currentCtcLpa × targetColIndex / currentColIndex`, compute monthly in-hand via `computeMonthlyInHandFromLpa`.
5. Assign badge: `your-base` / `cheaper` / `similar` / `moderate` / `premium` / `high-cost`.
6. If city expense unavailable, fall back to hardcoded family-4 baseline scaled by `FAMILY_SCALE` (`{1: 0.40, 2: 0.60, 3: 0.78, 4: 1.00, 5: 1.18, 6: 1.33}`).
7. Compute confidence: high / medium / low based on whether current city was found in COL index and whether any expense data was stale or missing.
8. Cache full response in memory for 10 minutes (keyed by city+ctc+increment+familyType+memberCount).

No AI involved. No auth required.

---

### POST /api/v1/offer-comparisons — Phase 2 (AI)

Input: 2–3 offers (companyName, totalCtcLpa, variablePct, variableGuaranteed, joiningBonusLpa, employerPf, targetCity, isWfh), `familyType`, `memberCount`

1. Load user from DB (for currentCity, used when isWfh=true).
2. For each offer: fetch `getExpenseBreakdown(expenseCity, familyType, memberCount)` and `getCOLIndex(expenseCity)` in parallel.
3. Compute deterministic `OfferSnapshot` per offer via `CompensationService.computeOfferSnapshot`.
4. Fetch company records from `DataSource` (MongoDB).
5. Build AI user prompt: lean snapshot fields (`fixedPayAnnual`, `effectiveCtcAnnual`, `monthlyInHand`, `monthlyExpenses`, `monthlySavings`) + company profiles (ratings, reviews, pre-stored aiProfile if available).
6. Call `COMPANY_AI_CLIENT` (Gemini). AI returns: score (0–100), scoreBreakdown (financial 0–40, qualitative 0–40, risk 0–20), optional qualitative fields for unknown companies, recommendation.
7. Validate AI response: bounds, sum invariant, bestOffer must match an input name.
8. Merge deterministic snapshot + AI output into `OfferResultDto`. Persist inputs + snapshot to `offers` collection.
9. Return full `OfferComparisonResponseDto`.

---

### POST /api/v1/salary-comparisons — Phase 2 lite (no AI)

Same offer input shape as offer-comparisons. Produces `OfferSnapshot` per offer (identical `CompensationService.computeOfferSnapshot` call) plus company details (ratings, reviews, aiProfile) read directly from DB. No AI call. Used for fast, deterministic comparisons.

---

## AI client routing summary

```
City expense fetch   → CITY_EXPENSE_AI_CLIENT → follows AI_PROVIDER env (default: Ollama)
Company seed/profile → COMPANY_AI_CLIENT       → always GeminiAiClient
Offer comparison     → COMPANY_AI_CLIENT       → always GeminiAiClient
Generic              → AI_CLIENT               → follows AI_PROVIDER env
```

---

## Infrastructure (Docker Compose)

| Service | Port | Notes |
|---------|------|-------|
| backend | 3000 | NestJS app |
| mongo | 27017 | MongoDB — data persisted in `mongo_data` volume |
| redis | 6379 | City expense cache |
| grafana | 3001 | Metrics dashboard — reads Prometheus metrics from backend |

Backend exposes Prometheus metrics at the default `prom-client` endpoint. `collectDefaultMetrics` is called with prefix `comp_copilot_`.

---

## Environment variables

```
# backend/.env
MONGODB_URI=mongodb://localhost:27017/comp-copilot
REDIS_URL=redis://localhost:6379
JWT_SECRET=<secret>
JWT_EXPIRES_IN=7d

AI_PROVIDER=gemini           # ollama | gemini | claude | google

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

GEMINI_API_KEY=<key>         # free at aistudio.google.com
GEMINI_MODEL=gemini-2.0-flash

CLAUDE_API_KEY=<key>         # optional

PORT=3000
ALLOWED_ORIGIN=http://localhost:5173

# project root .env (Docker Compose reads this)
GRAFANA_ADMIN_PASSWORD=<password>
```

---

## Key invariants

- Financial figures always flow: user input → CompensationService → stored snapshot → AI prompt. AI never touches raw salary inputs.
- AI response is validated before merging: score bounds, breakdown sum, bestOffer name match.
- Stale company data (> 90 days) triggers confidence downgrade; AI echoes the supplied confidence level, never recomputes it.
- Gemini free tier: 15 RPM. Company seed calls are sequential with 15 s gaps. Hard quota exhaustion (billing error) aborts the seed loop immediately rather than retrying.
- City expense schema stores all 6 family sizes in one document per city — AI generates them in a single prompt. Virtual breakdown resolution picks the right sub-object at query time.
- No `localStorage` / `sessionStorage` anywhere. No secrets in client code.
