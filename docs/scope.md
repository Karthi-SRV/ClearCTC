# scope.md

Every cut below is a deliberate decision, not an oversight. If any needs to be revisited, update this file first — don't add features without recording the decision here.

---

## IN — what is built

| Area | What's included |
|---|---|
| **Auth** | JWT signup/login. Email + password (bcrypt). User schema stores compensation profile: basicPayLpa, variablePayLpa, isFixed, currentCtcLpa, currentCity, currentRole, expectedHikePct, preferredCities. |
| **Phase 1 — salary ask** | Input: currentCity, currentCtcLpa, expectedIncrementPct, familyType (individual/family), memberCount (2–6). Output: 35+ city comparison table with COL index, equivalent CTC range, monthly in-hand, monthly expenses, monthly savings, badge. No AI call. Response cached in memory 10 min. |
| **Phase 2 — full offer comparison** | 2–3 concrete offers → deterministic OfferSnapshot (CompensationService) → company data from DB → AI (Gemini) reasoning → validated JSON response with score, scoreBreakdown, qualitative fields, and recommendation. |
| **Phase 2 — quick salary comparison** | Same 2–3 offer input → deterministic OfferSnapshot + company details from DB. No AI call. Instant response. |
| **Deterministic comp engine** | New-regime tax FY2025-26, statutory PF (employee + employer), gratuity accrual, COL adjustment. All in `CompensationService` as pure synchronous functions. 151 unit tests. |
| **City expense data** | One MongoDB document per city stores all 6 family-size breakdowns (individual, family 2–6). AI (Ollama by default) generates all 6 in a single prompt. Redis cache (7-day TTL). Background polling loop fetches missing city data every 15 s. |
| **Family-size expense personalisation** | Expense calculation accepts `familyType` (individual/family) and `memberCount` (2–6). Default: family of 4. Fallback when AI unavailable: hardcoded family-4 baseline scaled by `FAMILY_SCALE = {1:0.40, 2:0.60, 3:0.78, 4:1.00, 5:1.18, 6:1.33}`. |
| **Company data — seed + AI generation** | `scripts/seed.ts` seeds ~200 Indian tech company names into MongoDB (name-only, idempotent). On startup, `CompanyAiProfileService` uses Gemini to generate roles/ratings/reviews for any company missing them, then generates `aiProfile` for companies without one. Sequential with 15 s gaps (Gemini free tier 15 RPM). |
| **AI client abstraction** | Three DI tokens: `AI_CLIENT` (follows `AI_PROVIDER` env), `CITY_EXPENSE_AI_CLIENT` (same), `COMPANY_AI_CLIENT` (always Gemini). Four concrete clients: Ollama, Gemini, Claude, Google. All extend `AiResponseParser` for code-fence stripping. |
| **Gemini free tier resilience** | Hard quota exhaustion (429 + billing keywords): throw `[GEMINI_QUOTA_EXHAUSTED]` prefix, abort seed loop immediately. Soft rate-limit (429, other): retry with 15 s → 30 s → 60 s backoff (max 3). |
| **Mongo persistence** | Three collections: `users`, `companies`, `city-expenses`, `offers`. |
| **Redis caching** | City expense docs with 7-day TTL. Cache key: `city-expense:{city_lowercase}`. Full doc cached (all 6 family breakdowns). |
| **COL index** | Static in-memory lookup. 70+ Indian cities. Bangalore = 100. |
| **Confidence + staleness signals** | Confidence (high/medium/low) driven by COL index resolution and expense data freshness in Phase 1; by company data age (90-day threshold) in Phase 2. AI echoes the supplied confidence level — it never re-derives it. |
| **`LiveDataSource` adapter stub** | Interface implemented; every method throws. The seam exists so live scraping can be dropped in without touching any other module. |
| **Observability** | Prometheus metrics (`prom-client`), Winston logger, optional Loki transport, Grafana dashboard. |

---

## OUT — what is not built

### Live scraping of AmbitionBox / Glassdoor

**Decision:** Adapter stub only — `LiveDataSource` implements the `DataSource` interface and throws on every call.

**Rationale:** Scraping requires rate-limit handling, HTML parsing fragility, legal review, and rotating proxies. The `DataSource` abstraction means this can be added without touching any other module. Company data is AI-generated from training knowledge at startup; live scraping is a data-source swap, not a feature change.

---

### ESOP / RSU valuation

**Decision:** Not modelled. Equity components in offer inputs are not accepted.

**Rationale:** Vesting schedules, cliff dates, strike prices, and FMV require live market data and personalised tax modelling that would double the scope of `CompensationService` and introduce AI-invented numbers (FMV projections) that the trust boundary explicitly forbids.

---

### Foreign offers / foreign currency

**Decision:** INR only. No currency conversion, no foreign tax regime, no foreign PF equivalents.

**Rationale:** The compensation structure in the US, UK, Singapore differs fundamentally from the Indian CTC model. Supporting even one foreign jurisdiction correctly would require a parallel computation engine.

---

### Old tax regime

**Decision:** New regime only. No 80C/80D deductions, no HRA exemption, no old-regime slabs.

**Rationale:** New regime is the default for most salaried employees from FY 2024-25. Supporting both adds branching to `CompensationService`, a regime-selection field to every form, and a second result set to explain — reducing clarity without adding value for most users.

---

### More than ~4 seeded companies

**Decision:** `scripts/seed.ts` ships with ~200 company names hardcoded. Adding a company is an operational task (add it to the `COMPANY_LIST` in `seed.ts`, re-run the script, and the startup AI seed generates all data via Gemini).

**Rationale:** The 4 companies prove the full data contract (benchmarks, multi-source ratings, review snippets, aiProfile) end-to-end. The system degrades gracefully for unlisted companies (AI generates qualitative fields inline; no benchmark is shown). Coverage is a data-ops concern, not a scope one.

---

### Negotiation coaching / email drafting

**Decision:** Not in scope. The AI produces a reasoned comparison with cited signals; it does not generate negotiation scripts or draft emails.

**Rationale:** Negotiation coaching expands the AI's remit into open-ended advice — exactly the mode the trust boundary is designed to prevent. The output of this tool (ranked comparison, cited signals) is the input to a negotiation; the negotiation itself is out of scope.

---

## How to revisit a cut

1. Update this file first with the revised decision and a new rationale.
2. Check whether `requirements.md` and `design.md` need corresponding changes.
3. Get approval before touching application code.
