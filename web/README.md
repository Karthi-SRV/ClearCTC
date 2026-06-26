# ClearCTC — Frontend

React SPA for the ClearCTC compensation tool. Helps Indian software engineers evaluate city-adjusted salaries before HR conversations and compare real job offers on actual take-home pay.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Routing | React Router DOM 7 |
| Tests | Vitest |

No UI component library — plain CSS. No `localStorage`, `sessionStorage`, or `IndexedDB` anywhere; all state lives in React memory.

## Prerequisites

- Node.js 20+
- Backend API running on `http://localhost:3000` (see `backend/README.md`)

## Setup

```bash
cd web
npm install
```

The Vite dev server proxies `/api/*` to `http://localhost:3000` so no CORS configuration is needed in development.

## Running

```bash
# development server (http://localhost:5173)
npm run dev

# production build
npm run build

# preview production build locally
npm run preview
```

## Testing

```bash
npm test
```

## Project Structure

```
src/
├── pages/                       # One file per route
│   ├── SalaryAskPage.tsx        # Phase 1 — city-adjusted salary (public)
│   ├── SalaryComparisonPage.tsx # Phase 2 lite — deterministic offer snapshot (JWT)
│   ├── OfferComparisonPage.tsx  # Phase 2 full — AI-ranked comparison (JWT)
│   ├── CityExpensePage.tsx      # Browse living costs by city + family size
│   ├── LoginPage.tsx            # Sign in
│   └── SignupPage.tsx           # Create account
│
├── components/                  # Shared UI pieces
│   ├── SalaryAskForm.tsx        # Phase 1 input form
│   ├── SalaryAskResult.tsx      # Phase 1 results table
│   ├── SalaryComparisonForm.tsx # Phase 2 lite input
│   ├── SalaryComparisonResult.tsx
│   ├── OfferComparisonForm.tsx  # Phase 2 full input (up to 3 offers)
│   ├── OfferComparisonResult.tsx
│   ├── CityCombobox.tsx         # Searchable city selector
│   ├── CitySelector.tsx
│   └── CompanyCombobox.tsx      # Searchable company selector
│
├── context/
│   ├── AuthContext.tsx          # JWT token, user state, login/logout
│   ├── CitiesContext.tsx        # City list fetched once at app load
│   └── CompaniesContext.tsx     # Company list fetched once at app load
│
├── hooks/
│   ├── useApi.ts                # Generic API call hook
│   └── useApiFetch.ts           # Fetch wrapper with JWT injection
│
├── constants/
│   └── api.ts                   # All API endpoint paths in one place
│
├── utils/
│   └── comp-client.util.ts      # Compensation formatting helpers
│
└── types.ts                     # Shared TypeScript types
```

## Routes

| Path | Auth | Page |
|------|------|------|
| `/login` | Public | Sign in |
| `/signup` | Public | Create account |
| `/` | JWT | Phase 1 — Salary Ask |
| `/salary-comparison` | JWT | Phase 2 lite — Quick Comparison |
| `/offer-comparison` | JWT | Phase 2 full — AI Comparison |
| `/city-expenses` | JWT | City Expenses browser |

Unauthenticated users are redirected to `/login`. Authenticated users are redirected away from `/login` and `/signup` to `/`.

## Key Design Decisions

- **No browser storage** — the JWT is kept in React state only. Refreshing the page requires signing in again; this is intentional.
- **Context providers at app root** — `AuthContext`, `CitiesContext`, and `CompaniesContext` wrap the entire tree so any component can consume them without prop drilling.
- **All AI calls are server-side** — the frontend never calls an AI API directly. It submits offer data to the backend and receives a fully-validated, deterministic+AI-merged result.
- **API constants centralised** — all endpoint paths live in `src/constants/api.ts`; nothing is hardcoded in components.
