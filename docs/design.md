# design.md

All decisions here are consistent with `requirements.md` and `CLAUDE.md`. This file reflects the as-built implementation.

---

## 1. Module Layout

Three-layer architecture enforced by NestJS DI.

```
┌──────────────────────────────────────────────────────────────────┐
│  web (React)                                                     │
│  Auth · Phase1 · Phase2 (full) · Phase2 (quick)                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │ HTTP/JSON  (JWT on all but public routes)
┌──────────────────────▼───────────────────────────────────────────┐
│  features/  — own ≥1 HTTP route, have a controller              │
│  auth/  salary-ask/  offer-comparison/  salary-comparison/       │
│  city-expense/  health/                                          │
└───────────┬──────────────────────┬───────────────────────────────┘
            │                      │
┌───────────▼──────────────────────▼───────────────────────────────┐
│  core/  — @Module(), exports providers via DI, no controller     │
│  ai/         compensation/   data/   city-expense/   logger/     │
│   ↓               ↓            ↓          ↓             ↓        │
│  AiModule   CompensationMod  DataMod  CityExpenseMod  @Global()  │
│  3 tokens   pure math        DI token  Redis+Mongo+AI  Winston   │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  shared/  — plain TypeScript only, no @Module() anywhere        │
│  schemas/  dtos/  guards/  decorators/  filters/  interceptors/  │
└──────────────────────────────────────────────────────────────────┘
```

**Layer rules (hard):**
- `features/`: owns at least one HTTP route + `@Controller`. Imports core modules; never imports another feature's service directly.
- `core/`: `@Module()` that exports providers. No `@Controller`. Concrete implementations are invisible to consumers — they inject tokens.
- `shared/`: plain TypeScript exports. No `@Module()` anywhere.

---

## 2. NestJS Module Detail

### 2.1 CompensationModule

Exports one provider: `CompensationService`. Zero AI, zero DB, zero async.

**Derivation chain for `computeOfferSnapshot` (all amounts annual INR unless noted):**

```
totalCtcAnnual    = totalCtcLpa × 100_000
joiningBonusAnn   = joiningBonusLpa × 100_000
variableAnnual    = totalCtcAnnual × variablePct / 100

basicAnnual       = (totalCtcAnnual − joiningBonusAnn − variableAnnual) × 0.5
basicMonthly      = basicAnnual / 12

employeePfMonthly = 12% × min(basicMonthly, ₹15,000)
employeePfAnnual  = employeePfMonthly × 12
employerPfAnnual  = employeePfAnnual  if employerPf='statutory', else 0

gratuityAccrual   = (15 × basicMonthly × 1) / 26   ← per-year estimate

fixedPayAnnual    = totalCtcAnnual − variableAnnual − employerPfAnnual
                    − gratuityAccrual − joiningBonusAnn   ← residual; never entered

effectiveCtcAnn   = fixedPayAnnual + variableAnnual   if variableGuaranteed
                  = fixedPayAnnual                     otherwise

taxableIncome     = max(effectiveCtcAnn − 75_000, 0)
incomeTaxAnnual   = applySlabs(taxableIncome)         ← see §2.1.1

monthlyInHand     = (effectiveCtcAnn − employeePfAnnual − incomeTaxAnnual) / 12
monthlyExpenses   = expenseBreakdown.total
monthlySavings    = monthlyInHand − monthlyExpenses
```

**Reconciliation invariant (tested):**
`fixedPayAnnual + variableAnnual + employerPfAnnual + gratuityAccrual + joiningBonusAnnual === totalCtcAnnual` (±1 INR)

#### 2.1.1 Tax slabs (new regime, FY 2025-26)

| Taxable income | Rate |
|---|---|
| ₹0 – ₹4 L | 0% |
| ₹4 L – ₹8 L | 5% |
| ₹8 L – ₹12 L | 10% |
| ₹12 L – ₹16 L | 15% |
| ₹16 L – ₹20 L | 20% |
| ₹20 L – ₹24 L | 25% |
| Above ₹24 L | 30% |

Section 87A rebate: ₹60,000 rebate when taxableIncome ≤ ₹12 L (effective zero-tax gross: ₹12.75 L).
4% health-and-education cess on tax after rebate.

**Other exported functions:**
- `computeTax(annualGrossIncome)` — standard deduction + slabs + rebate + cess
- `computeEmployeePF(annualCTC)` — wage-ceiling capped PF
- `computeGratuityAccrual(annualCTC, yearsOfService)` — `(15 × monthlyBasic × years) / 26`
- `computeMonthlyInHandFromLpa(totalCtcLpa)` — quick estimate; assumes pure-fixed statutory PF, no variable/bonus
- `computeSalaryRange(input)` — conservative / target / stretch from benchmark + experience premium + COL delta
- `computeConfidence(input)` — high / medium / low; authoritative; AI echoes it, never re-derives it

**`computeSalaryRange` formula:**
```
experiencePremium = clamp((experienceYears / benchmarkMidpoint) − 1, −0.3, 0.5)
target            = benchmarkCTC × (1 + experiencePremium) × (colIndexTarget / colIndexCurrent)
conservative      = target × 0.88
stretch           = target × 1.18
```

**`computeConfidence` rules:**
- Company not in dataset → low
- Role not matched → medium
- Experience out of benchmark band → medium
- Data older than 90 days → downgraded one level
- All checks pass, fresh data → high

---

### 2.2 AiModule

Three injection tokens — consumers inject a token, never a concrete class.

| Token | Wired to | Fixed? |
|-------|----------|--------|
| `AI_CLIENT` | Selected by `AI_PROVIDER` env (ollama/gemini/claude/google) | dynamic |
| `CITY_EXPENSE_AI_CLIENT` | Same as `AI_CLIENT` | follows `AI_PROVIDER` |
| `COMPANY_AI_CLIENT` | Always `GeminiAiClient` | hard-wired |

**Concrete clients:**

- **`OllamaAiClient`** — `POST {OLLAMA_BASE_URL}/api/chat`, `format: 'json'`. Default model: `llama3.2`.
- **`GeminiAiClient`** — Google AI Studio free tier (15 RPM). Raw `fetch` to `generativelanguage.googleapis.com/v1beta`. `GEMINI_API_KEY` + `GEMINI_MODEL` (default `gemini-2.0-flash`). 429 handling: detect body for "billing"/"check your plan" → throw with `[GEMINI_QUOTA_EXHAUSTED]` prefix (no retry); otherwise retry with backoff (15 s → 30 s → 60 s, max 3 attempts).
- **`ClaudeAiClient`** — Anthropic API via `CLAUDE_API_KEY`.
- **`GoogleAiClient`** — alternative Google client.

All extend `AiResponseParser` which strips ` ```json ``` ` fences before `JSON.parse`.

---

### 2.3 DataModule

Binds `DATA_SOURCE` token to `CachedDataSource`.

**`CachedDataSource`** (active):
- `getCOLIndex(city)` — queries MongoDB `city-expenses` collection (schema field `colIndex`) for the city's cost-of-living index, calculated relative to Chennai = 1.00 base. WFH/remote → null.
- `getCompany(name)` — case-insensitive regex match on `name` or `aliases[]`.
- `getBenchmark(company, role, experienceYears)` — role title match + experience range lookup.
- `getCompanyNames()` — sorted list from DB.

**`LiveDataSource`** (stub): every method throws "not enabled for demo". The seam exists for future live scraping without touching any other module.

**Company seeding on startup** (`CompanyAiProfileService.seedOnStartup()`, called from `main.ts` after `app.listen`):
1. Phase 1 — for any company already in MongoDB that has no roles, generate aliases, role benchmarks, ratings, reviews via `COMPANY_AI_CLIENT` (Gemini). Company names are pre-seeded into MongoDB by `scripts/seed.ts` (~200 names, hardcoded list).
2. Phase 2 — generate `aiProfile` (companySize, basicInsurance, otherBenefits, pros, cons, riskLevel, riskFactors, benefitForRisk) for companies that have base data but no stored profile.
- Both phases: sequential calls with `GEMINI_REQUEST_GAP_MS = 15_000` to stay under 15 RPM free tier.
- On `[GEMINI_QUOTA_EXHAUSTED]` prefix: log ERROR and `break` immediately.
- On other errors: log WARN and continue to next company.

---

### 2.4 CityExpenseModule

Provides city living-expense data for any (city, familyType, memberCount) tuple.

**Schema** (`city-expenses` collection) — one document per city. All 6 family-size breakdowns are stored in a single document:
```
city:        string (unique)
individual:  ExpenseBreakdown   # 1 person
family:      ExpenseBreakdown   # 2 members
family3:     ExpenseBreakdown   # 3 members
family4:     ExpenseBreakdown   # 4 members
family5:     ExpenseBreakdown   # 5 members
family6:     ExpenseBreakdown   # 6 members
generatedBy, generatedAt, modelUsed, disclaimer
```

`ExpenseBreakdown` fields: `rent + groceries + utilities + transport + foodDining + personalLifestyle + miscellaneous + total`

**Redis cache** (`CityExpenseCacheService`): 7-day TTL. Cache key: `city-expense:{city_lowercase}`. The entire document (all 6 family breakdowns) is cached. `resolveVirtualBreakdown` picks the right sub-object at query time.

**`CityExpenseFetchService`**: calls `CITY_EXPENSE_AI_CLIENT` (Ollama by default). Single AI prompt generates all 6 breakdowns for a city. Total field is auto-corrected to `sum(fields)` if AI arithmetic is off.

**`CityExpenseService` lookup order:**
1. Redis hit + `individual` populated → `resolveVirtualBreakdown(doc, familyType, memberCount)`
2. MongoDB doc with `individual` populated → cache it; if >30 days old, background-refresh; return
3. No doc → call AI, store, return
4. AI fails, no fallback → throw `CityExpenseUnavailableError`

**On startup** (`onApplicationBootstrap`): sync existing MongoDB docs to Redis, then start a 15 s polling loop to fetch AI data for any city document still missing its `individual` breakdown.

---

### 2.5 AuthModule

JWT authentication. `JwtAuthGuard` is registered as a global `APP_GUARD`; routes opt out with `@Public()`.

- `POST /api/v1/auth/signup` — hash password (bcrypt, 12 rounds); store User; return `{ accessToken, user }`.
- `POST /api/v1/auth/login` — compare password; return `{ accessToken, user }`.
- JWT payload: `{ sub: userId, email }`.
- `@CurrentUser()` decorator extracts the decoded JWT payload from the request.

---

## 3. MongoDB Schemas

### 3.1 `users`

```typescript
email:          string  // unique, lowercase, indexed
passwordHash:   string
currentCity:    string
currentCtcLpa:  number  // basicPayLpa + variablePayLpa
basicPayLpa:    number
variablePayLpa: number  // 0 when isFixed=true
isFixed:        boolean
expectedHikePct: number
currentRole:    string
preferredCities: string[]
```

### 3.2 `offers`

```typescript
userId:   ObjectId   // ref: User, indexed
inputs:   Mixed      // raw OfferInputDto(s)
snapshot: Mixed      // computed OfferSnapshot(s) — never recomputed by AI
```

### 3.3 `companies`

```typescript
name:      string          // unique
aliases:   string[]        // indexed
roles:     RoleBenchmark[] // { title, avgCTC (INR), experienceMin, experienceMax }
ratings:   RatingSet[]     // { source, wlb, culture, growth, jobSecurity }
reviews:   ReviewSnippet[] // { text, source, date (YYYY-MM), sentiment, dimension }
dataAsOf:  Date
aiProfile: AiProfile | null
  // { companySize, basicInsurance, otherBenefits[], pros[], cons[],
  //   riskLevel, riskFactors[], benefitForRisk, generatedAt }
```

### 3.4 `city-expenses`

See §2.4.

---

## 4. HTTP API Contracts

### Phase 1 — `POST /api/v1/salary-asks` (public)

**Request:**
```json
{
  "currentCity": "Bangalore",
  "currentCtcLpa": 18,
  "expectedIncrementPct": 30,
  "familyType": "family",    // optional, default "family"
  "memberCount": 4            // optional, default 4, only when familyType="family"
}
```

**Response:**
```json
{
  "currentCity": "Bangalore",
  "currentCtcLpa": 18,
  "expectedIncrementPct": 30,
  "familyType": "family",
  "memberCount": 4,
  "hikedCtcLpa": 23.4,
  "colIndices": { "Mumbai": 1.31, "Pune": 1.07, "..." : "..." },
  "cityComparisons": [
    {
      "city": "Mumbai",
      "badge": "premium",
      "colIndex": 1.31,
      "equivCtcLpa": 20.7,
      "equivCtcRangeLow": 19.7,
      "equivCtcRangeHigh": 21.7,
      "monthlyInHand": 138500,
      "monthlyExpenses": 105000,
      "monthlySavings": 33500,
      "expenseBreakdown": {
        "rent": 35000, "groceries": 15000, "utilities": 5000,
        "transport": 8000, "foodDining": 15000,
        "personalLifestyle": 12000, "miscellaneous": 15000,
        "total": 105000,
        "disclaimer": "Illustrative estimates...",
        "generatedAt": "2026-06-01T00:00:00.000Z"
      }
    }
  ],
  "expensesDisclaimer": "...",
  "expenseGeneratedAt": "2026-06-01T00:00:00.000Z",
  "confidence": "high",
  "confidenceReason": null,
  "dataAsOf": "2026-06-25"
}
```

### Phase 2 — `POST /api/v1/offer-comparisons` (JWT)

**Request:**
```json
{
  "offers": [
    {
      "companyName": "Razorpay",
      "totalCtcLpa": 28,
      "variablePct": 20,
      "variableGuaranteed": false,
      "joiningBonusLpa": 1,
      "employerPf": "statutory",
      "targetCity": "Bangalore",
      "isWfh": false
    }
  ],
  "familyType": "family",
  "memberCount": 4
}
```

**Response (abbreviated):**
```json
{
  "userId": "...",
  "comparedAt": "2026-06-25T...",
  "offers": [
    {
      "companyName": "Razorpay",
      "totalCtcLpa": 28,
      "fixedPayAnnual": 2050000,
      "effectiveCtcAnnual": 2050000,
      "monthlyInHand": 138200,
      "monthlyExpenses": 82000,
      "monthlySavings": 56200,
      "expenseBreakdown": { "..." : "..." },
      "employeeRating": { "overall": 3.9, "wlb": 4.0, "..." : "..." },
      "pros": ["..."],
      "cons": ["..."],
      "riskAssessment": { "level": "low", "factors": ["..."], "benefitForRisk": "..." },
      "score": 78,
      "scoreBreakdown": { "financial": 32, "qualitative": 30, "risk": 16 }
    }
  ],
  "recommendation": {
    "bestOffer": "Razorpay",
    "suggestion": "...",
    "whyBest": "...",
    "whyNotOthers": {},
    "confidence": "high",
    "caveat": "..."
  },
  "dataDisclaimer": "Tax: new regime FY2025-26 · ..."
}
```

### Phase 2 lite — `POST /api/v1/salary-comparisons` (JWT)

Same request shape as offer-comparisons. Response returns deterministic snapshots + company details from DB; no AI score or recommendation.

---

## 5. AI Prompt Contracts

### 5.1 Offer Comparison System Prompt

> You are a senior compensation analyst helping an Indian software engineer make a job-switching decision. You reason over structured data supplied to you. You never invent salary figures, ratings, company facts, or benefits not present in the supplied data. Every claim must cite which data field drove it. Return only valid JSON. Start with { and end with }.

### 5.2 Offer Comparison User Prompt Structure

```
Candidate currentCity: "{city}", currentCtcLpa: {n} LPA.
DETERMINISTIC SNAPSHOTS (do not modify these figures):
[{ companyName, totalCtcLpa, targetCity, isWfh, fixedPayAnnual,
   effectiveCtcAnnual, monthlyInHand, monthlyExpenses, monthlySavings }]
COMPANY PROFILES:
[{ companyName, profileType: "stored"|"derive"|"unknown", ratings[], reviews[],
   aiProfile? (present only when profileType="stored") }]
TASK: ...
Return JSON matching: { offers: [...], recommendation: {...} }
RULES: ...
```

### 5.3 AI Response Schema (validated before use)

```json
{
  "offers": [
    {
      "companyName": "string",
      "companySize": "string (only for profileType=derive/unknown)",
      "basicInsurance": "string",
      "otherBenefits": ["string"],
      "pros": ["string"],
      "cons": ["string"],
      "riskAssessment": {
        "level": "low|medium|high",
        "factors": ["string"],
        "benefitForRisk": "string"
      },
      "score": 0,
      "scoreBreakdown": { "financial": 0, "qualitative": 0, "risk": 0 }
    }
  ],
  "recommendation": {
    "bestOffer": "string",
    "suggestion": "string",
    "whyBest": "string",
    "whyNotOthers": {},
    "confidence": "high|medium|low",
    "caveat": "string"
  }
}
```

**Validation rules:**
- `score` in [0, 100]
- `financial` in [0, 40], `qualitative` in [0, 40], `risk` in [0, 20]
- `financial + qualitative + risk === score` (±1)
- `bestOffer` must exactly match one submitted `companyName`
- `confidence` must be "high", "medium", or "low"
- `pros` and `cons` arrays max 4 items each

---

## 6. City Expense AI Prompt Contract

### 6.1 System Prompt

> You are a cost-of-living research assistant for Indian cities. Return ONLY valid JSON — no markdown, no extra text. The JSON must have exactly these keys: individual, family, family3, family4, family5, family6. Each key's value must be an expense breakdown object with these integer fields (positive INR per month): rent, groceries, utilities, transport, foodDining, personalLifestyle, miscellaneous, total. For each breakdown, the total field MUST equal the exact arithmetic sum of all other fields. Include a top-level non-empty disclaimer string.

### 6.2 Validated Response Shape

```json
{
  "individual": { "rent": 0, "groceries": 0, "utilities": 0, "transport": 0,
                  "foodDining": 0, "personalLifestyle": 0, "miscellaneous": 0, "total": 0 },
  "family":  { "..." },
  "family3": { "..." },
  "family4": { "..." },
  "family5": { "..." },
  "family6": { "..." },
  "disclaimer": "string"
}
```

All fields: non-null, positive integer. Total auto-corrected to sum if arithmetic is off.

---

## 7. Company Seed Flow

**Pre-requisite:** Run `ts-node scripts/seed.ts` once. This inserts ~200 company name-only documents into the `companies` collection (idempotent — skips names already present). It also inserts city name-only documents into `city-expenses` for the 35 standard cities.

**On app startup** (`main.ts` calls `companySeed.seedOnStartup()` after `app.listen()` returns):
1. Phase 1 — query MongoDB for companies with empty `roles`. For each, call `CompanyFetchService.fetchCompany(name)` via Gemini. On success, upsert roles/ratings/reviews. Wait `GEMINI_REQUEST_GAP_MS = 15_000` between calls.
2. Phase 2 — query MongoDB for companies with `aiProfile === null`. For each, call Gemini to generate aiProfile. Same 15 s gap.
3. On `[GEMINI_QUOTA_EXHAUSTED]`: log error and break immediately. On other errors: log warning and continue.
4. The entire seed is idempotent; re-running skips already-complete companies.

---

## 8. Environment Variables

```
# backend/.env
MONGODB_URI=mongodb://localhost:27017/clearctc
REDIS_URL=redis://localhost:6379
JWT_SECRET=<secret>
JWT_EXPIRES_IN=7d
AI_PROVIDER=gemini            # ollama | gemini | claude | google
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
GEMINI_API_KEY=<key>
GEMINI_MODEL=gemini-2.0-flash
CLAUDE_API_KEY=<key>
PORT=3000
ALLOWED_ORIGIN=http://localhost:5173
LOKI_URL=http://localhost:3100   # optional; Loki transport disabled when absent

# project root .env (Docker Compose)
GRAFANA_ADMIN_PASSWORD=<password>
```

---

## 9. Observability

- `prom-client` `collectDefaultMetrics` with prefix `clearctc_`.
- `LoggingInterceptor` as global `APP_INTERCEPTOR`.
- `nest-winston` with console + optional Loki transports.
- Grafana + Prometheus + Loki wired in Docker Compose. Prometheus scrapes `host.docker.internal:3000/metrics` every 15 s.
