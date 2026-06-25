# tasks-backend.md

Ordered build checklist for the NestJS backend. Work top-to-bottom. Each task has one clear completion signal. Groups are sequenced by dependency — a group only starts when all groups it imports are done.

---

## Group 0 — Project Scaffolding

*Foundation. No business logic yet. Completion signal: `npm run start:dev` boots, Docker Compose starts, `/health` responds.*

- [x] **0.1** Initialise NestJS backend (`nest new backend`); confirm `npm run start:dev` compiles and listens on port 3000.
- [x] **0.2** Add `backend/docker-compose.yml` with MongoDB (:28090→27017), Redis (:6379), Prometheus (:9090), Loki (:3100), Grafana (:3001), Ollama (:11434); named persistent volumes; `extra_hosts: host.docker.internal:host-gateway`. Volume mounts for infra config use `../infra/` paths.
- [x] **0.3** Install backend deps: `@nestjs/config`, `@nestjs/mongoose`, `mongoose`, `class-validator`, `class-transformer`, `ioredis`, `@nestjs/jwt`, `bcryptjs`, `prom-client`, `nest-winston`, `winston`, `winston-loki`.
- [x] **0.4** Wire `ConfigModule.forRoot({ isGlobal: true })` in `AppModule`; wire `MongooseModule.forRootAsync` reading `MONGODB_URI` from `ConfigService`.
- [x] **0.5** Create `backend/.env` from the template in `design.md §8`; create `backend/.env.example` with all keys and placeholder values; add `.env` to `.gitignore`. All env vars (including Grafana credentials) live in `backend/.env` — Docker Compose reads from the same file.
- [x] **0.6** Create `LoggerModule` (`@Global()`): Winston with console transport (always on, coloured + timestamped) and Loki transport (enabled only when `LOKI_URL` env present; `onConnectionError` logs and continues). Import once in `AppModule`.
- [x] **0.7** Register `LoggingInterceptor` as global `APP_INTERCEPTOR`; call `collectDefaultMetrics({ prefix: 'comp_copilot_' })` in `main.ts`; set `bufferLogs: true` and swap NestJS logger for Winston. Expose `GET /metrics` as raw Express middleware (bypasses `JwtAuthGuard`) so Prometheus can scrape unauthenticated.
- [x] **0.8** Create `infra/prometheus/prometheus.yml` — scrapes `host.docker.internal:3000/metrics` every 15 s. Create Grafana datasource provisioning YAML for Prometheus + Loki. Create Grafana dashboard provisioning JSON (`infra/grafana/provisioning/dashboards/comp-copilot.json`).
- [x] **0.9** Bootstrap hardening in `main.ts`: kill stale port listeners; port-free wait (exponential back-off, max 8 s); graceful shutdown on SIGTERM/SIGINT/SIGHUP via `closeAllConnections`; parent-process monitor exits child on `nest --watch` restart.
- [x] **0.10** Add global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` and `AiExceptionFilter` (logs + returns 502) in `main.ts`.
- [x] **0.11** Wire `HealthModule`: `GET /health` (public) returns `{ status: "ok" }`. Verify the endpoint responds.

---

## Group 1 — CompensationModule

*Pure math engine. Zero DB, zero HTTP, zero AI. Must be done before any feature that needs financial computation.*
*Completion signal: all unit tests pass.*

- [x] **1.1** Create `CompensationModule` + `CompensationService` skeleton; export from module; confirm app still compiles.
- [x] **1.2** Implement `computeTax(annualGrossIncome)` — ₹75,000 standard deduction; new-regime slabs FY2025-26 (0%/5%/10%/15%/20%/25%/30%); 87A rebate ₹60,000 when taxable ≤ ₹12 L; 4% cess on tax after rebate.
- [x] **1.3** Unit test `computeTax`: ₹9.75 L gross → ₹0; ₹12.75 L → ₹0 (zero-tax threshold); ₹13 L → ₹66,300 (one step above rebate cliff); ₹21.75 L → ₹2,34,000 (proves 25% slab exists).
- [x] **1.4** Implement `computeEmployeePF(annualCTC)` — basic = 50% CTC; employee PF = `12% × min(monthlyBasic, ₹15,000) × 12`.
- [x] **1.5** Unit test `computeEmployeePF`: CTC ₹2.4 L → ₹14,400; ₹3.6 L → ₹21,600 (at ceiling); ₹6 L → ₹21,600 (capped above ceiling).
- [x] **1.6** Implement `computeGratuityAccrual(annualCTC, yearsOfService)` — `(15 × monthlyBasic × years) / 26`.
- [x] **1.7** Unit test `computeGratuityAccrual`: CTC ₹12 L, 1 yr → ₹28,846; 5 yrs → ₹1,44,231.
- [x] **1.8** Implement `computeOfferSnapshot(input, expenseBreakdown, colIndexUsed)` — full derivation chain: variable → basic → employee PF → employer PF → gratuity → fixedPay (residual) → effectiveCTC → taxableIncome → tax → monthlyInHand → savings. See `design.md §2.1`.
- [x] **1.9** Unit test `computeOfferSnapshot` — 7 cases: pure fixed; at-risk variable; guaranteed variable; joining bonus; employerPf=none; WFH; reconciliation invariant (`fixedPay + variable + empPF + gratuity + joiningBonus === totalCTC ±1 INR`) on all 6 configurations; determinism (same input → identical output).
- [x] **1.10** Implement `computeMonthlyInHandFromLpa(totalCtcLpa)` — quick estimate for Phase 1; assumes pure-fixed, statutory PF, no variable/joining bonus.
- [x] **1.11** Implement `computeSalaryRange(input)` — `experiencePremium = clamp((years/midpoint)−1, −0.3, +0.5)`; `target = benchmarkCTC × (1+premium) × (colTarget/colCurrent)`; `conservative = target × 0.88`; `stretch = target × 1.18`.
- [x] **1.12** Unit test `computeSalaryRange`: `conservative ≤ target ≤ stretch` for 3 experience inputs (below/at/above midpoint); low experience clamps at −0.3; high experience clamps at +0.5; different COL indices apply delta.
- [x] **1.13** Implement `computeConfidence(input)` — company absent → low; role unmatched → medium; experience out of band → medium; data age > 90 days → downgrade one level; all pass → high. This is authoritative; the AI echoes it, never re-derives it.
- [x] **1.14** Unit test `computeConfidence`: all true + age 0 → high, null reason; company absent → low, non-empty reason; role unmatched → medium; age 91 days → downgraded vs age 0.

---

## Group 2 — DataModule

*Company benchmarks and COL indices. Must be done before SalaryAskModule, OfferComparisonModule, and SalaryComparisonModule.*
*Completion signal: unit tests pass; seed script runs idempotently.*

- [x] **2.1** Define `DataSource` interface + `DATA_SOURCE` token + supporting types (`BenchmarkResult`, `CompanyRecord`, `RatingSet`, `ReviewSnippet`, `AiProfile`) in `data-source.interface.ts`.
- [x] **2.2** Define `Company` Mongoose schema with sub-schemas: `RoleBenchmark`, `RatingSet`, `ReviewSnippet`, `AiProfile`.
- [x] **2.3** Implement `LiveDataSource` — all methods throw "not enabled for demo". Unit test: each method throws.
- [x] **2.4** Implement `CachedDataSource.getCOLIndex(city)` — static in-memory map, 70+ cities, Bangalore = 100; WFH/remote → null. Unit tests: Bangalore → 100, Mumbai → 115, unknown → null, WFH → null.
- [x] **2.5** Implement `CachedDataSource.getCompany(name)` — case-insensitive regex on `name` or `aliases[]`. Unit tests: exact name match, alias match, unknown → null.
- [x] **2.6** Implement `CachedDataSource.getBenchmark(company, role, experienceYears)` — role regex match + experience band containment. Unit tests: in-band → correct avgCTC; below all bands → null; above all bands → null; company not found → null.
- [x] **2.7** Implement `CachedDataSource.getCompanyNames()` — sorted list from DB.
- [x] **2.8** Wire `DataModule`: bind `CachedDataSource` to `DATA_SOURCE`; export the token.
- [x] **2.9** Write `scripts/seed.ts` — idempotent upsert of ~200 company names (name-only) into `companies` and 35 city names into `city-expenses`. Skips names already present. Exit non-zero on any error. Verify: run twice; counts stable on second run.

---

## Group 3 — AiModule

*AI client abstraction. Must be done before CityExpenseModule and any feature that uses AI.*
*Completion signal: app boots; `AiParseError` maps to 502.*

- [x] **3.1** Define `AiClient` interface + three DI tokens: `AI_CLIENT`, `CITY_EXPENSE_AI_CLIENT`, `COMPANY_AI_CLIENT` in `ai-client.interface.ts`.
- [x] **3.2** Implement `AiResponseParser` abstract class — `parseJson(text)` strips code fences, calls `JSON.parse`, throws `AiParseError` if result is not a plain object.
- [x] **3.3** Implement `OllamaAiClient` — `POST {OLLAMA_BASE_URL}/api/chat`, `format: 'json'`, default model `llama3.2`. Unit test: valid JSON response → object; code-fence response → stripped and parsed; non-JSON → `AiParseError`.
- [x] **3.4** Implement `GeminiAiClient` — raw `fetch` to Google AI Studio free tier (`generativelanguage.googleapis.com/v1beta`), default model `gemini-2.0-flash`. 429 handling: read body; if body contains "billing" or "check your plan" → throw with `[GEMINI_QUOTA_EXHAUSTED]` prefix (no retry); otherwise retry with 15 s → 30 s → 60 s backoff (max 3 attempts). Configured by `GEMINI_API_KEY`, `GEMINI_MODEL`.
- [x] **3.5** Implement `ClaudeAiClient` — Anthropic API via `ANTHROPIC_API_KEY`.
- [x] **3.6** Implement `GoogleAiClient` — Google Vertex AI client via Application Default Credentials.
- [x] **3.7** Wire `AiModule` providers: `AI_CLIENT` selected at runtime by `AI_PROVIDER` env (ollama/gemini/claude/google, default gemini); `CITY_EXPENSE_AI_CLIENT = useExisting AI_CLIENT`; `COMPANY_AI_CLIENT = useExisting GeminiAiClient`. Export all three tokens.
- [x] **3.8** Add `AiExceptionFilter` as global filter in `main.ts` — catches `AiParseError`, logs error, returns 502 with `{ error: "AI response could not be parsed. Please try again." }`; no stack trace, no raw model text.

---

## Group 4 — CityExpenseModule

*City living-expense data with Redis caching and AI-backed fetching.*
*Depends on: Group 3 (AiModule). Must be done before SalaryAskModule, OfferComparisonModule, SalaryComparisonModule.*
*Completion signal: unit tests pass; `GET /api/v1/cities` returns city list.*

- [x] **4.1** Define `CityExpense` Mongoose schema — one document per city; fields: `city` (unique), `individual`, `family`, `family3`, `family4`, `family5`, `family6` (each an `ExpenseBreakdown` object), `generatedBy`, `generatedAt`, `modelUsed`, `disclaimer`. `ExpenseBreakdown`: rent, groceries, utilities, transport, foodDining, personalLifestyle, miscellaneous, total.
- [x] **4.2** Implement `CityExpenseCacheService` — Redis via `REDIS_CLIENT` token; `get(city)` / `set(city, doc)` / `del(city)`; 7-day TTL; cache key `city-expense:{city_lowercase}`; `onModuleDestroy` disconnects Redis. Unit tests: null on miss; parsed doc on hit with Date restored; correct key format; 7-day TTL on set; del removes key.
- [x] **4.3** Implement `CityExpenseFetchService` — calls `CITY_EXPENSE_AI_CLIENT`; single prompt generates all 6 family-size breakdowns for the city; validates all fields (non-null, positive integer); auto-corrects total to `sum(fields)` if AI arithmetic is wrong; uses default disclaimer when AI omits one. Unit tests: valid response → CityExpense; off-by-one total → corrected; negative field → AiParseError; non-integer → AiParseError; missing disclaimer → default applied.
- [x] **4.4** Implement `CityExpenseService` with lookup order: (1) Redis hit → `resolveVirtualBreakdown`; (2) MongoDB doc with `individual` populated → cache it, background-refresh if >30 days old, return; (3) No doc → AI fetch → store → return; (4) AI fails → throw `CityExpenseUnavailableError`. `onApplicationBootstrap`: sync existing MongoDB docs to Redis + start 15 s polling loop to AI-fetch any city document missing its `individual` breakdown.
- [x] **4.5** Implement `resolveVirtualBreakdown(doc, familyType, memberCount)` — picks the right sub-object from the single city document (individual/family/family3/family4/family5/family6); returns virtual `{ city, familyType, memberCount, breakdown, generatedBy, generatedAt, modelUsed, disclaimer }`.
- [x] **4.6** Unit test `CityExpenseService`: Redis hit; MongoDB fresh; MongoDB stale (background refresh triggered); stale doc returned immediately when background refresh fails; not found + AI succeeds; not found + AI fails → `CityExpenseUnavailableError`; `forceRefresh` invalidates Redis.
- [x] **4.7** Implement `getCityNames()` — sorted list of all city names from DB. Implement `getExpensesByFilter(cities)` — fetches listed cities; triggers AI fetch for any missing. Implement `forceRefresh(city)` — invalidates Redis, re-fetches from AI, upserts MongoDB.

---

## Group 5 — AuthModule

*JWT authentication. Must be done before any endpoint that uses `@CurrentUser()`.*
*Depends on: Group 0 (Scaffolding). Completion signal: signup returns JWT; login returns JWT; protected endpoint returns 401 without token.*

- [x] **5.1** Define `User` Mongoose schema: `email` (unique, indexed, lowercase), `passwordHash`, `currentCity`, `currentCtcLpa`, `basicPayLpa`, `variablePayLpa`, `isFixed`, `expectedHikePct`, `currentRole`, `preferredCities`.
- [x] **5.2** Define `SignupDto` with `class-validator` decorators on all fields.
- [x] **5.3** Implement `AuthService.signup` — check email uniqueness (409 on duplicate); bcrypt hash password (12 rounds); derive `currentCtcLpa = basicPayLpa + (isFixed ? 0 : variablePayLpa)`; create User; return `{ accessToken, user }`.
- [x] **5.4** Implement `AuthService.login` — find by email; compare hash (401 on mismatch); return `{ accessToken, user }`.
- [x] **5.5** Register `JwtAuthGuard` as global `APP_GUARD`. Implement `@Public()` decorator to opt routes out. Implement `@CurrentUser()` decorator to extract `{ sub, email }` from JWT payload.
- [x] **5.6** Create `AuthController`: `POST /api/v1/auth/signup` (public), `POST /api/v1/auth/login` (public). Verify: signup with duplicate email → 409; login with wrong password → 401; protected endpoint without token → 401.

---

## Group 6 — DataModule — Company Seed + AI Profile Generation

*Depends on: Group 2 (DataModule schemas), Group 3 (AiModule). Must be done before any feature that reads company data.*
*Completion signal: `scripts/seed.ts` completes; on app start, Gemini generates roles/ratings for seeded companies.*

- [x] **6.1** Implement `CompanyFetchService` — calls `COMPANY_AI_CLIENT` (Gemini) to generate aliases, role benchmarks, ratings, reviews for a named company; validates all required fields and types.
- [x] **6.2** Implement `CompanyAiProfileService.seedOnStartup()`:
  - Phase 1 (`seedMissingCompanies`): find companies in MongoDB with empty `roles`; for each, call `CompanyFetchService.fetchCompany(name)` and upsert; wait `GEMINI_REQUEST_GAP_MS = 15_000` between calls; on `[GEMINI_QUOTA_EXHAUSTED]` → log error and break; on other errors → log warning and continue.
  - Phase 2 (`seedMissingProfiles`): find companies with `aiProfile === null`; for each, generate aiProfile via Gemini with same gap + error handling.
  - `onModuleDestroy`: clear all active sleep timeouts.
- [x] **6.3** Call `companySeed.seedOnStartup()` from `main.ts` after `app.listen()` returns (non-blocking, fire-and-forget).

---

## Group 7 — SalaryAskModule (Phase 1)

*City salary equivalence comparison. No AI in the main request path.*
*Depends on: Groups 1, 2, 4. Completion signal: `POST /api/v1/salary-asks` returns 35-city comparison.*

- [x] **7.1** Define `SalaryAskRequestDto`: `currentCity`, `currentCtcLpa` (min 1, max 1000), `expectedIncrementPct` (int, 0–200), `familyType` (optional enum, default 'family'), `memberCount` (optional int 2–6, only when familyType='family', default 4).
- [x] **7.2** Define `SalaryAskResponseDto` with `CityComparisonDto` (city, badge, colIndex, equivCtcLpa, range, monthlyInHand, monthlyExpenses, monthlySavings, expenseBreakdown) and `ExpenseBreakdownDto`.
- [x] **7.3** Implement `SalaryAskService.execute`:
  - Compute `hikedCtcLpa = currentCtcLpa × (1 + expectedIncrementPct/100)`.
  - Fetch COL indices for current city + all 35 standard cities in parallel.
  - Fetch expense breakdowns for all 35 cities in parallel (uses `familyType` + `memberCount`).
  - Per city: `equivCtcLpa = currentCtcLpa × targetColIndex / currentColIndex`; monthly in-hand via `computeMonthlyInHandFromLpa`; badge assignment (your-base/cheaper/similar/moderate/premium/high-cost).
  - Fallback when expense unavailable: scale hardcoded family-4 baseline by `FAMILY_SCALE = {1:0.40, 2:0.60, 3:0.78, 4:1.00, 5:1.18, 6:1.33}`.
  - Confidence: high (all resolved) / medium (any expense stale or failed) / low (current city not in COL index).
  - Cache full response in memory for 10 min keyed by `(city|ctc|increment|familyType|memberCount)`.
- [x] **7.4** Implement `SalaryAskService.getSupportedCities()` — returns sorted standard city list.
- [x] **7.5** Create `SalaryAskController`: `GET /api/v1/salary-asks/cities` (public); `POST /api/v1/salary-asks` (public). Verify: empty body → 400 with field errors; valid body → 200 with 35 city entries.

---

## Group 8 — OfferComparisonModule (Phase 2 — AI)

*Full offer comparison with Gemini-scored ranking.*
*Depends on: Groups 1, 2, 3, 4, 5. Completion signal: `POST /api/v1/offer-comparisons` returns scored offers + recommendation.*

- [x] **8.1** Define `OfferInputDto` (companyName, totalCtcLpa 1–500, variablePct 0–100, variableGuaranteed, joiningBonusLpa, employerPf 'statutory'|'none', targetCity, isWfh) and `CreateOfferComparisonDto` (2–3 offers, familyType, memberCount).
- [x] **8.2** Define response DTOs: `ExpenseBreakdownDto`, `EmployeeRatingDto`, `RiskAssessmentDto`, `ScoreBreakdownDto`, `OfferResultDto`, `RecommendationDto`, `OfferComparisonResponseDto`.
- [x] **8.3** Implement `OffersService.createMany` — bulk insert raw inputs + computed snapshots to `offers` collection.
- [x] **8.4** Implement `OfferComparisonService.execute`:
  1. Load user from DB (for `currentCity` when `isWfh=true`).
  2. For each offer: fetch `getExpenseBreakdown(expenseCity, familyType, memberCount)` + `getCOLIndex(expenseCity)` in parallel.
  3. Compute `OfferSnapshot` per offer via `CompensationService.computeOfferSnapshot`.
  4. Fetch company records from `DataSource`.
  5. Build AI prompt: lean snapshots (`fixedPayAnnual`, `effectiveCtcAnnual`, `monthlyInHand`, `monthlyExpenses`, `monthlySavings`) + company profiles (ratings, reviews, stored aiProfile when available; `profileType='stored'/'derive'/'unknown'`).
  6. Call `COMPANY_AI_CLIENT` (Gemini).
  7. Validate response via `validateAiResponse`: score bounds (0–100), breakdown bounds (financial 0–40, qualitative 0–40, risk 0–20), `sum === score ±1`, `bestOffer` matches an input name, confidence enum, pros/cons ≤ 4 items.
  8. Merge deterministic snapshot + AI output; persist to `offers` via `OffersService.createMany`.
- [x] **8.5** Implement `detectStale(dataAsOf, thresholdDays=90)` — pure boolean.
- [x] **8.6** Create `OfferComparisonController`: `POST /api/v1/offer-comparisons` (JWT, `@CurrentUser()` for userId). Verify: 1 offer → 400; missing token → 401; invalid AI response → 502; valid → 200 with scored offers.
- [x] **8.7** Unit tests: `detectStale` (91 days → true, 89 days → false); `validateAiResponse` all branches; AI prompt contains `effectiveCtcAnnual` + `fixedPayAnnual`; `NotFoundException` when user not found.

---

## Group 9 — SalaryComparisonModule (Phase 2 lite — deterministic)

*Offer snapshots + company details from DB, no AI call.*
*Depends on: Groups 1, 2, 4, 5. Completion signal: `POST /api/v1/salary-comparisons` returns snapshots without waiting for Gemini.*

- [x] **9.1** Define `SalaryComparisonOfferDto` and `QuickSalaryComparisonDto` (same structure as `CreateOfferComparisonDto`).
- [x] **9.2** Define response DTOs: `QuickOfferSnapshotDto`, `CompanyDetailsDto`, `QuickSalaryComparisonResponseDto`.
- [x] **9.3** Implement `SalaryComparisonService.execute`: load user; parallel expense + COL fetch per offer; compute `OfferSnapshot` per offer; fetch company records from `DataSource`; build `CompanyDetailsDto` (size, insurance, benefits, ratings, up to 2 review snippets from DB); no AI call.
- [x] **9.4** Create `SalaryComparisonController`: `GET /api/v1/salary-comparisons/companies` (public, returns sorted company names from `DataSource.getCompanyNames()`); `POST /api/v1/salary-comparisons` (JWT).

---

## Group 10 — CityExpense Admin + Public Endpoints

*Admin refresh and public query endpoints for city expense data.*
*Depends on: Group 4 (CityExpenseModule).*

- [x] **10.1** Create `CityExpenseController` (in `CityExpenseAdminModule`):
  - `GET /api/v1/cities` (public) — sorted city names from `CityExpenseService.getCityNames()`.
  - `GET /api/v1/city-expenses` (JWT) — all cities or filtered by `?city=X` (repeated param or comma-separated). Response includes all 6 family-size breakdowns per city document.
- [x] **10.2** Create `CityExpenseAdminController`:
  - `POST /api/v1/city-expenses/refresh` (admin guard) — accepts optional `{ city: string }` body; calls `forceRefresh` for the named city or for all 6 standard metros.

---

## Test Coverage

Current: `Tests: 4 todo, 151 passed, 155 total`

All unit-tested boundaries:
- CompensationService: all 7 formula functions with edge cases
- CityExpenseFetchService: AI response validation + auto-correction
- CityExpenseCacheService: Redis key format, TTL, Date restoration
- CityExpenseService: full lookup chain (Redis/Mongo/AI/error)
- OfferComparisonService: AI prompt content, response validation, stale detection

---

## How to run

```bash
# 1. Start infrastructure (Docker) + seed database
./scripts/infra.sh

# 2. Start backend in watch mode
cd backend && npm run start:dev

# Or start everything at once
./scripts/run.sh
```
