# tasks-frontend.md

Ordered build checklist for the React frontend (`web/`). Work top-to-bottom. Each task has one clear completion signal.

---

## Group F0 — Scaffolding

*Foundation. Completion signal: `npm run dev` renders a page; `/api` proxy reaches the backend.*

- [x] **F0.1** Initialise Vite project (`react-ts` template); confirm `npm run dev` renders on port 5173.
- [x] **F0.2** Install runtime deps: `react-router-dom@7`.
- [x] **F0.3** Configure Vite proxy: `/api` → `http://localhost:3000` so no CORS handling is needed in dev.
- [x] **F0.4** Create `src/constants/api.ts` — centralise all API endpoint paths; no URLs hardcoded in components.
- [x] **F0.5** Create `src/types.ts` — shared TypeScript types for API request/response shapes.
- [x] **F0.6** Set up global CSS (`src/index.css`) with CSS custom properties for colours, spacing, and app shell layout.

---

## Group F1 — Auth

*JWT authentication. Completion signal: login returns token stored in React state; logout clears it; protected routes redirect.*

- [x] **F1.1** Implement `AuthContext` — holds JWT token and user profile in React state; exposes `login(token, user)`, `logout()`, `isAuthenticated`, `user`.
- [x] **F1.2** Implement `useApiFetch` hook — wraps `fetch`; injects `Authorization: Bearer <token>` header from `AuthContext` on every request; throws on non-2xx.
- [x] **F1.3** Implement `LoginPage` — email/password form; calls `POST /api/v1/auth/login`; stores JWT via `AuthContext.login`; redirects to `/` on success.
- [x] **F1.4** Implement `SignupPage` — extended form (email, password, current city, basic pay, variable pay, role, preferred cities); calls `POST /api/v1/auth/signup`; logs user in on success.
- [x] **F1.5** Implement `PrivateRoute` — renders children when authenticated, redirects to `/login` otherwise.
- [x] **F1.6** Redirect authenticated users away from `/login` and `/signup` to `/`.

---

## Group F2 — Phase 1: Salary Ask

*City-adjusted salary comparison. No auth required. Completion signal: form submit returns 35-city table.*

- [x] **F2.1** Implement `CitiesContext` — fetches city list once from `GET /api/v1/cities` on mount; provides `cities: string[]` to the tree.
- [x] **F2.2** Implement `CityCombobox` + `CitySelector` — searchable/filterable city picker backed by `CitiesContext`.
- [x] **F2.3** Implement `SalaryAskForm` — inputs: current city (combobox), current CTC (₹L), expected increment (%), family type (individual/family), member count (2–6 when family). Validates client-side before submit.
- [x] **F2.4** Implement `SalaryAskResult` — 35-city comparison table showing badge, equivalent CTC, monthly in-hand, monthly expenses, monthly savings, and collapsible expense breakdown per city.
- [x] **F2.5** Wire `SalaryAskPage`: form → `POST /api/v1/salary-asks` → result display. Public route (`/`).

---

## Group F3 — Phase 2 Lite: Quick Comparison

*Deterministic offer snapshots + company details. Completion signal: form returns side-by-side snapshot without AI delay.*

- [x] **F3.1** Implement `CompaniesContext` — fetches company list once from `GET /api/v1/salary-comparisons/companies`; provides `companies: string[]`.
- [x] **F3.2** Implement `CompanyCombobox` — searchable company picker backed by `CompaniesContext`.
- [x] **F3.3** Implement `SalaryComparisonForm` — 2–3 offer inputs each with: company (combobox), total CTC, variable %, target city, WFH toggle. Family type + member count shared across offers.
- [x] **F3.4** Implement `SalaryComparisonResult` — side-by-side offer cards showing deterministic snapshot (monthly in-hand, tax, PF, savings) and company details (ratings, benefits, review snippets).
- [x] **F3.5** Wire `SalaryComparisonPage` → `POST /api/v1/salary-comparisons`. Protected route (`/salary-comparison`).

---

## Group F4 — Phase 2 Full: AI Comparison

*AI-ranked offer comparison. Completion signal: form returns scored results with recommendation.*

- [x] **F4.1** Implement `OfferComparisonForm` — extends quick comparison form with: variable guarantee toggle, joining bonus (₹L), employer PF type (statutory/none). Add/remove offer (2–3).
- [x] **F4.2** Implement `OfferComparisonResult` — AI-ranked cards showing score, score breakdown (financial/qualitative/risk), pros/cons, confidence level, and top recommendation with reasoning.
- [x] **F4.3** Wire `OfferComparisonPage` → `POST /api/v1/offer-comparisons`. Handle 502 (AI parse failure) with clear user message. Protected route (`/offer-comparison`).

---

## Group F5 — City Expenses

*Browse living costs by city and family size. Completion signal: city + family size selection shows expense breakdown.*

- [x] **F5.1** Implement `CityExpensePage` — city combobox + family type/size picker; calls `GET /api/v1/city-expenses?city=X`; displays itemised expense breakdown (rent, groceries, utilities, transport, food, lifestyle, misc, total) with generatedAt and AI disclaimer.

---

## Group F6 — Navigation

*App shell and routing. Completion signal: nav renders correct links for auth state; active link is highlighted.*

- [x] **F6.1** Implement `Nav` component (memoised) — authenticated: Salary Ask, Quick Comparison, AI Comparison, City Expenses, user email, Sign out. Unauthenticated: Sign in, Create account (CTA).
- [x] **F6.2** Route table wired in `App.tsx`:

  | Path | Guard | Page |
  |------|-------|------|
  | `/login` | Public (redirect if auth) | LoginPage |
  | `/signup` | Public (redirect if auth) | SignupPage |
  | `/` | PrivateRoute | SalaryAskPage |
  | `/salary-comparison` | PrivateRoute | SalaryComparisonPage |
  | `/offer-comparison` | PrivateRoute | OfferComparisonPage |
  | `/city-expenses` | PrivateRoute | CityExpensePage |

---

## Group F7 — Error Handling

*Global error surface. Completion signal: API errors show as toasts; render crashes show fallback UI.*

- [x] **F7.1** Implement `ErrorContext` — global error state; `setError(message)`, `clearError()`; consumed by `useApiFetch` to surface API errors automatically.
- [x] **F7.2** Implement `ErrorBoundary` (class component) — catches any render crash inside `AppRoutes`; shows a fallback message instead of a blank screen.
- [x] **F7.3** Implement `ErrorToastContainer` — renders toast notifications outside `BrowserRouter` so they survive route changes and navigation-triggered unmounts.
- [x] **F7.4** Wire `ErrorProvider` at the root of the tree; `ErrorToastContainer` placed outside `BrowserRouter` inside `ErrorProvider`.

---

## Group F8 — Utilities

- [x] **F8.1** Implement `useApi` hook — generic API call hook with `loading`, `data`, `error` state.
- [x] **F8.2** Implement `src/utils/comp-client.util.ts` — formatting helpers (currency, percentage, badge labels).

---

## Pending / Stretch

- [ ] **F9.1** Loading skeleton states on all result panels during API calls (replace raw `loading` boolean with skeleton UI).
- [ ] **F9.2** Inline field validation feedback — show per-field errors on the forms, not just API error toasts.
- [ ] **F9.3** Mobile responsive layout — CSS media queries for all pages and the nav.
- [ ] **F9.4** Empty-state UI — illustrated placeholder when no results have been fetched yet.
- [ ] **F9.5** Accessibility audit — keyboard navigation, ARIA labels on comboboxes, focus management after form submit.

---

## How to run

```bash
cd web
npm install
npm run dev      # http://localhost:5173

npm test         # Vitest unit tests
npm run build    # Production build
```

Backend must be running at `http://localhost:3000` for API calls to work.
