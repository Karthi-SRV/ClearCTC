# requirements.md

## Problem Statement

Indian software engineers switching jobs have no reliable tool that combines three things in one place: a clear picture of what their salary is worth across Indian cities before they talk to HR; a real post-tax offer comparison (not CTC-to-CTC); and employer reputation signals with sources cited rather than a single averaged score.

Existing tools fail on at least one: generic market ranges with no personalisation, raw CTC comparisons with no tax or PF math, or AI responses that invent numbers without grounding. This tool is purpose-built to close all three gaps — with the AI reasoning over supplied numbers only, never originating them.

---

## The Two Phases

**Phase 1 — Salary Ask** (used before the HR conversation)
The user enters their current city, current CTC, and expected increment. The system compares equivalent salary and real living costs across 35+ Indian cities, adjusted for cost-of-living and personalised to the user's family size. No AI call. No target company required at this stage.

**Phase 2 — Offer Comparison** (used after receiving offers)
The user has 2–3 concrete offers. Two flows are available:

- **Full comparison (AI-augmented):** Computes real take-home for each offer (new-regime tax, statutory PF, gratuity accrual, COL adjustment), benchmarks against seeded market data, surfaces employer review signals with sources, and produces an AI-reasoned comparison that cites every claim and flags every uncertainty.
- **Quick comparison (deterministic only):** Same financial engine, same company data from DB — no AI call. Returns offer snapshots and company details immediately.

---

## User Stories and Acceptance Criteria

### Auth

---

**US-0** As a returning user, I want to create an account and log back in, so that my compensation profile is available across sessions.

Acceptance criteria:
- AC-0.1: Signup accepts: email, password (min 8 chars), currentCity, basicPayLpa, variablePayLpa, isFixed flag, expectedHikePct, currentRole, preferredCities (optional).
- AC-0.2: Total CTC is derived as `basicPayLpa + variablePayLpa`; when isFixed=true, variablePayLpa is treated as 0.
- AC-0.3: Email is unique; duplicate signup returns 409 Conflict.
- AC-0.4: Login returns a signed JWT and the user profile.
- AC-0.5: All authenticated endpoints require a valid `Authorization: Bearer <token>` header and return 401 without one.

---

### Phase 1 — Salary Ask

---

**US-1** As a job switcher, I want to enter my current city, CTC, and expected increment to see how my salary compares across cities, so I know what to ask for when targeting a new location.

Acceptance criteria:
- AC-1.1: Input accepts: currentCity (string), currentCtcLpa (number, min 1), expectedIncrementPct (integer, 0–200), familyType (individual/family, default family), memberCount (2–6, required when familyType=family, default 4).
- AC-1.2: Submitting with currentCity, currentCtcLpa, or expectedIncrementPct empty is blocked with an inline validation error.
- AC-1.3: Auth is not required for this endpoint. It is publicly accessible.

---

**US-2** As a job switcher, I want to see equivalent salaries across 35+ Indian cities adjusted for cost-of-living, so I can anchor my ask to the target city's real purchasing power.

Acceptance criteria:
- AC-2.1: The response includes one entry per standard city. Each entry shows: city name, cost-of-living badge (your-base / cheaper / similar / moderate / premium / high-cost), COL index, equivalent CTC (low–high range), monthly in-hand (deterministic, from CompensationService), monthly expenses, monthly savings.
- AC-2.2: Equivalent CTC = `currentCtcLpa × targetColIndex / currentColIndex`.
- AC-2.3: Monthly in-hand is computed by `computeMonthlyInHandFromLpa` — no AI.
- AC-2.4: The full response is cached in memory for 10 minutes keyed by (city, ctc, increment, familyType, memberCount).

---

**US-3** As a job switcher, I want to see realistic monthly living expenses per city personalised to my family size, so I understand what I'll actually spend, not just what I'll earn.

Acceptance criteria:
- AC-3.1: Expense breakdowns are shown for the selected familyType and memberCount.
- AC-3.2: Breakdown fields: rent, groceries, utilities, transport, foodDining, personalLifestyle, miscellaneous, total.
- AC-3.3: When city expense data is unavailable (AI down, cold start), a hardcoded family-4 fallback is used and scaled by a predefined multiplier map (`{1:0.40, 2:0.60, 3:0.78, 4:1.00, 5:1.18, 6:1.33}`).
- AC-3.4: Expense data carries a disclaimer string and generatedAt timestamp; both are returned to the client.

---

**US-4** As a job switcher, I want to know how confident the system is in the city comparison, so I can weigh the output appropriately.

Acceptance criteria:
- AC-4.1: Response includes `confidence` (high/medium/low) and optional `confidenceReason`.
- AC-4.2: Confidence is `low` when the current city is not found in the COL index.
- AC-4.3: Confidence is `medium` when any city expense data failed to load or is older than 30 days.
- AC-4.4: Confidence is `high` only when all city expense data loaded fresh and the current city COL index resolved.

---

### Phase 2 — Offer Comparison

---

**US-5** As a job switcher, I want to enter 2–3 concrete offers with their full components, so the system can compute accurate take-home for each.

Acceptance criteria:
- AC-5.1: Each offer accepts: companyName, totalCtcLpa (1–500), variablePct (0–100), variableGuaranteed (bool), joiningBonusLpa, employerPf ('statutory' or 'none'), targetCity, isWfh (bool).
- AC-5.2: A minimum of 2 and a maximum of 3 offers can be submitted.
- AC-5.3: The request also accepts familyType (individual/family) and memberCount (2–6) to personalise the expense calculation.
- AC-5.4: When isWfh=true, the user's currentCity (from the user record) is used for expense lookup instead of targetCity.

---

**US-6** As a job switcher, I want to see real post-tax monthly and annual in-hand for each offer, so I can compare what I'll actually receive.

Acceptance criteria:
- AC-6.1: Monthly in-hand is computed using new-regime tax slabs, statutory employee PF deduction; no old-regime deductions.
- AC-6.2: Variable pay is included in effective CTC only when variableGuaranteed=true.
- AC-6.3: Joining bonus is excluded from fixedPayAnnual, effectiveCtcAnnual, and taxableIncome.
- AC-6.4: Reconciliation invariant: `fixedPayAnnual + variableAnnual + employerPfAnnual + gratuityAccrualAnnual + joiningBonusAnnual === totalCtcAnnual` (±1 INR rounding).
- AC-6.5: All computation runs in `CompensationService` on the server; no financial math executes client-side or in the AI layer.

---

**US-7** As a job switcher, I want each offer adjusted for cost-of-living, so I can compare offers across different cities on equal footing.

Acceptance criteria:
- AC-7.1: `colIndexUsed` is fetched from the `CachedDataSource` COL index table and echoed on every offer snapshot.
- AC-7.2: Monthly expenses use city expense data for targetCity (or currentCity when isWfh=true), personalised to the chosen familyType and memberCount.
- AC-7.3: Monthly savings = monthlyInHand − monthlyExpenses.

---

**US-8** As a job switcher, I want to see where each offer sits relative to market benchmarks, so I know whether I'm being offered above or below market.

Acceptance criteria:
- AC-8.1: Company records with role benchmarks are fetched from the `companies` collection via `DataSource`.
- AC-8.2: When no benchmark exists for a company, a "no data" indicator is shown; no figure is invented.

---

**US-9** As a job switcher, I want to see employer review signals with sources cited, so I can factor in company culture without trusting a single opaque score.

Acceptance criteria:
- AC-9.1: Rating dimensions shown: WLB, culture, growth, jobSecurity; each attributed to its source.
- AC-9.2: Review snippets (up to 2 per company in the quick comparison) are attributed to source and date.
- AC-9.3: Source disagreements are not silently averaged; when two sources diverge significantly the disagreement is surfaced.
- AC-9.4: When a company is not in the seeded dataset, a "no data" notice is shown; nothing is invented.

---

**US-10** As a job switcher, I want an AI-generated comparison summary that cites its reasoning (full comparison only), so I understand why one offer is ranked higher.

Acceptance criteria:
- AC-10.1: The AI summary assigns a score (0–100) and scoreBreakdown (financial 0–40, qualitative 0–40, risk 0–20) per offer; breakdown must sum to score (±1).
- AC-10.2: For companies with no stored aiProfile, the AI also returns qualitative fields (companySize, insurance, pros/cons, riskAssessment); for known companies, these come from the stored aiProfile.
- AC-10.3: The AI does not introduce any salary figure, benchmark, or rating not supplied to it in the prompt.
- AC-10.4: AI response is validated (score bounds, breakdown sum, bestOffer name match, risk level enum) before being merged with deterministic data; 502 is returned if validation fails.
- AC-10.5: The recommendation includes bestOffer, whyBest, whyNotOthers, confidence (high/medium/low), and caveat.

---

**US-11** As a job switcher, I want to be told when data behind a recommendation is stale, so I can weigh it appropriately.

Acceptance criteria:
- AC-11.1: Each company record carries a `dataAsOf` date.
- AC-11.2: Stale threshold: 90 days. `detectStale` returns true when `Date.now() − dataAsOf > 90 × 86_400_000`.
- AC-11.3: Stale status is passed into the AI prompt context so the AI may flag it in the caveat; the AI echoes it — it does not originate the staleness judgement.

---

## Constraints

- New tax regime only (FY 2025-26).
- INR / India only. No foreign offers, no currency conversion.
- 2–3 offers per comparison.
- City expense AI fetch: all 6 family-size breakdowns generated in a single prompt per city.
- Company names are seeded from a hardcoded list in `scripts/seed.ts` (~200 Indian tech companies). Roles, ratings, reviews, and aiProfile are generated on startup via Gemini AI for any company missing them. Live scraping not built (stub only).
- No browser storage APIs (`localStorage`, `sessionStorage`, `IndexedDB`).
- API key and DB connection string: server-side env only, never in the client bundle.
- Gemini free tier: 15 RPM. Company seed calls are sequential with 15 s gaps. Hard quota exhaustion aborts the seed loop immediately.
