# Claude Code Skills & MCP Servers — clearctc

This document explains two productivity mechanisms used in this project during development: **Claude Code Skills** (reusable prompt libraries that load exact context on demand) and **MCP Servers** (protocol-based live data connections). Both exist for the same reason: reduce the tokens spent re-explaining project context so Claude spends those tokens doing actual work.

---

## Part 1 — Claude Code Skills

### What a skill is

A Claude Code skill is a Markdown file that Claude loads as a self-contained context module when triggered by a `/command`. Instead of re-pasting background knowledge into every prompt, you invoke the skill and Claude instantly has the exact context needed — no explanation, no copy-paste, no wasted tokens.

Skills live in `~/.claude/skills/<skill-name>/SKILL.md` and are registered in `~/.claude/CLAUDE.md`. When the user types `/skill-name`, Claude loads that file before responding.

For this project, all skill files are also checked in under `skills/` at the repo root so they travel with the codebase. To install them locally, copy each subfolder to `~/.claude/skills/` (or symlink it) and register the trigger in `~/.claude/CLAUDE.md`.

### Why we use skills instead of just writing longer prompts

| Without skills | With skills |
|----------------|-------------|
| Every session starts cold — you re-explain the dev stack, the trust boundary, the AI DI token pattern | One trigger word loads hundreds of tokens of accurate, project-specific context |
| Claude guesses at formulas it learned in training (may be outdated or wrong) | Skill file encodes the exact formula with no ambiguity |
| Debugging a 502 AI error: 600 tokens explaining what `AiResponseParser` does before getting to the bug | `/clearctc-debug-ai` → Claude already knows the validation gates |
| "How do I add a city?" → 400-token explanation of COL index + seed list + admin endpoint | `/clearctc-new-city` → step-by-step in one shot |

**The key insight:** a skill is not a macro. It is a knowledge module. The skill file contains the WHY (design decisions, invariants, failure modes) alongside the HOW (commands, file paths, schemas). Claude reads it as a peer reading a technical brief, not as a script to execute.

---

### Skills used in this project

#### 1. `/indian-payroll-math` — Deterministic compensation calculator

**File:** `skills/indian-payroll-math/SKILL.md`
**Purpose:** Applies exact statutory formulas for Indian compensation — new-regime tax, PF, gratuity, COL adjustment, salary range, confidence level. Every formula is specified with no room for improvisation.

**Why it exists here:** `CompensationService` is the financial engine of clearctc. The trust boundary rule says the AI never originates financial figures — but the AI *can* help verify, explain, and test those formulas. This skill ensures that when we discuss the compensation math (debugging a test, adding a new formula, or reviewing edge cases), Claude uses the exact same statutory rules as the codebase. Prevents drift between the skill's mental model and the actual implementation.

**What it covers:**
- Employee and employer PF (₹15,000/month wage ceiling)
- New-regime tax (FY 2025-26 slabs, 87A rebate up to ₹12L taxable, 4% cess)
- Gratuity accrual formula `(15 × monthly basic × N) / 26`
- COL adjustment across 6 reference cities (Chennai = 1.00 baseline)
- Salary range: `conservative = target × 0.88`, `stretch = target × 1.18`
- Confidence level with downgrade rules (data age, role match, company in dataset)

**When to invoke:** any time you're reviewing, testing, or extending `CompensationService`, or verifying that a snapshot value was computed correctly.

---

#### 2. `/clearctc-devstack` — Local dev quick-start

**File:** `skills/clearctc-devstack/SKILL.md`
**Purpose:** Everything needed to get the local development environment running from scratch: env setup, Docker Compose commands, backend and frontend start commands, seed script, test commands, and a common-failures table.

**Why it exists:** The stack has six services (NestJS, React, MongoDB, Redis, Grafana, Loki/Prometheus) plus an optional Ollama container. Without a skill, every new session that involves running the app requires re-explaining port numbers, env var names, Docker network names, and the seed script invocation. The skill removes this overhead entirely.

**What it covers:** Docker Compose commands, `npm run start:dev`, frontend Vite server, seed script syntax (idempotent, Gemini quota handling), full test suite, type-check commands for both packages, golden path verification (`/health` → signup → Phase 1 → Phase 2), and a failures table covering MongoDB/Redis connection issues, quota exhaustion, and port conflicts.

---

#### 3. `/clearctc-debug-ai` — AI pipeline debugging guide

**File:** `skills/clearctc-debug-ai/SKILL.md`
**Purpose:** Diagnostic reference for AI pipeline failures — 502 errors, quota exhaustion, provider switching, and trust-boundary contract enforcement.

**Why it exists:** The AI pipeline has two distinct error categories that look similar on the surface: hard quota exhaustion (`[GEMINI_QUOTA_EXHAUSTED]` prefix → abort immediately, never retry) vs soft 429 rate-limit (retry with backoff). Getting this distinction wrong in a debugging session leads to either burning quota retrying a dead key, or stopping a retriable error too early. The skill encodes the exact distinction and the correct response to each.

**What it covers:**
- The three DI token architecture (`AI_CLIENT`, `CITY_EXPENSE_AI_CLIENT`, `COMPANY_AI_CLIENT`) and which follow `AI_PROVIDER`
- Trust boundary invariant — what breaks it and how to detect a violation
- Validation gates in `AiResponseParser` and `OfferComparisonService` (score bounds, sum invariant, name match)
- Symptom → fix table for 502s, 429s, quota exhaustion, stale city data
- Provider switching: which env vars each provider needs, how to confirm the switch took effect
- How to add a new AI provider following the established pattern

---

#### 4. `/clearctc-new-city` — Add a city to the expense system

**File:** `skills/clearctc-new-city/SKILL.md`
**Purpose:** Step-by-step procedure for adding an Indian city to the cost-of-living expense system: COL index entry, seed list, AI data generation, verification, and cleanup.

**Why it exists:** Adding a city touches three different places (COL index, seed list, MongoDB collection) plus an optional Redis cache invalidation. Missing any one of them causes a silent partial failure — the city appears in the UI but salary adjustments don't work, or it's in the DB but not indexed. The skill prevents this by making the multi-step procedure explicit and checkable.

**What it covers:** COL index placement with sourcing guidance (Numbeo/Mercer/NHB), seed list regional grouping, admin refresh endpoint syntax, MongoDB and Redis verification commands, failure modes table, and removal procedure.

---

#### 5. `/ai-provider-strategy` — Strategy + DI token pattern for AI clients

**File:** `skills/ai-provider-strategy/SKILL.md`
**Purpose:** Encodes the entire AI provider abstraction layer — the `AiClient` interface, `AI_CLIENT` DI token, module factory binding, and concrete implementations for Claude, Gemini, and Ollama. Includes fence-stripping utility, `AiResponseParser`, trust boundary rules, and Gemini free-tier rate-limit batching.

**Why it exists:** This is the most critical architectural pattern in the codebase. Every developer touching the AI layer needs to know: inject the token, never the class; strip fences before parsing; throw `AiParseError` on malformed responses; never let AI compute financial figures. Without the skill, these rules live only in `CLAUDE.md` and verbal agreement — easy to miss when adding a new provider or a new AI call site.

**What it covers:**
- `AiClient` interface definition (the contract all providers must implement)
- `AI_CLIENT` token, `AiModule` factory binding with `switch` on `AI_PROVIDER` env
- Complete working implementations for Claude, Gemini, and Ollama with correct request shapes, timeout (`AbortSignal.timeout(30_000)`), and `stripFences()`
- `AiResponseParser.parse<T>()` — the only allowed path from raw AI string to application data
- Trust boundary rules with grep check: `aiClient.complete` must appear in exactly 3 files
- Gemini free-tier batching pattern (chunks of 3, 4-second gaps to stay under 15 RPM)
- Demo swap sequence for video: one env var change, business logic untouched

**When to invoke:** adding a new AI provider, wiring a new AI call, reviewing the DI token pattern, debugging provider-not-switching issues.

---

#### 6. `/nestjs-three-layer-cache` — Redis → MongoDB → AI read-through cache

**File:** `skills/nestjs-three-layer-cache/SKILL.md`
**Purpose:** Captures the three-layer cache pattern used throughout the application: Redis (fast, 7-day TTL) → MongoDB (durable, 30-day freshness) → AI fetch (slow, only on miss/stale). Covers cache key conventions, startup warm strategy, nightly cron refresh, Docker Compose health checks, and test coverage requirements.

**Why it exists:** The cache pattern has several non-obvious rules that are easy to violate: Redis failures must never throw (always fall through to MongoDB), every `set` must use `setex` with an explicit TTL (never bare `set`), the warm must fire-and-forget from `onApplicationBootstrap` (never `await` it), and individual item failures must use `Promise.allSettled` to avoid stopping the whole warm. Without the skill, each of these must be re-explained from scratch whenever a new cached data type is added.

**What it covers:**
- The three-layer read sequence with fallback logic and stale-data disclaimer injection
- `CacheKey` typed utility — grep for raw string literals as a bug detector
- TTL reference table: city expenses (7d Redis / 30d Mongo), company profiles (7d/30d), COL index (30d / never)
- `CityExpenseCacheService` with non-fatal try-catch on every Redis operation
- `DataWarmService` with fire-and-forget bootstrap, `Promise.allSettled` batching, 4-second gaps
- Nightly cron refresh with `CRON_ENABLED` guard (prevents firing in test environments)
- 7 required test scenarios for every cache service (Redis hit, MongoDB hit, stale, miss, AI failure variants)

**When to invoke:** adding any new cached data type, building a warm/prefetch flow, debugging stale-data issues.

---

#### 7. `/structured-ai-output` — Prompts that return JSON: construction to validation

**File:** `skills/structured-ai-output/SKILL.md`
**Purpose:** End-to-end reference for writing AI prompts that must return structured JSON and wiring their validation pipeline: prompt construction rules, the exact system/user prompt templates for all three AI calls in the application, `AiParseError`, `AiExceptionFilter` (502 response), and a common-mistakes table.

**Why it exists:** Structured AI output is the highest-risk integration point in the codebase. There are five distinct failure modes that silently corrupt data if not handled: arithmetic errors in totals (`total ≠ sum of fields`), out-of-range values (scores > 100, ratings > 5), constraint violations (`min > median` in benchmarks), wrong `bestOffer` name (case mismatch), and raw `JSON.parse` used instead of `AiResponseParser`. The skill encodes every validation gate so they are applied consistently across all three AI call sites.

**What it covers:**
- System prompt template: role, domain, year, "start with { end with }" instruction (critical for Ollama)
- User prompt structure: context → input data → exact JSON shape → constraint rules
- Temperature guidance: always 0.1–0.2 for structured output
- All three AI calls: city expense breakdown (sum validation), company profile (benchmark min ≤ median ≤ max, basicPct 30–60), offer comparison reasoning (scores 0–100, breakdown sum ≤ 100, bestOffer exact match)
- `AiResponseParser.parse<T>()` implementation — never use `JSON.parse` directly
- `AiExceptionFilter` — 502 with safe message, never expose raw AI output to client
- Common-mistakes table: 8 anti-patterns and their correct alternatives

**When to invoke:** writing any new AI prompt, adding a validation rule, debugging a 502 from an AI call, onboarding someone to the AI pipeline.

---

### Skills token savings summary

| Scenario | Tokens without skill | Tokens with skill |
|----------|---------------------|-------------------|
| "Run the dev stack" | ~800 (re-explaining env, ports, Docker) | ~50 (skill trigger + one clarifying question) |
| "Debug this 502 AI error" | ~600 (re-explaining trust boundary, validation gates) | ~80 (skill loads full context) |
| "Add Coimbatore to the city list" | ~400 (explaining COL index + seed + verify) | ~60 (skill loads full procedure) |
| "Verify the PF formula in CompensationService" | ~500 (explaining statutory PF rules, wage ceiling) | ~70 (skill has exact formula) |
| "Add a new AI provider" | ~700 (explaining DI token, interface, fence stripping, trust boundary) | ~90 (`/ai-provider-strategy` loads full pattern) |
| "Add a new cached data type" | ~500 (re-explaining three-layer pattern, TTL rules, warm strategy) | ~80 (`/nestjs-three-layer-cache` loads full pattern) |
| "Write a prompt that returns JSON" | ~600 (explaining prompt structure, validation gates, error filter) | ~90 (`/structured-ai-output` loads templates + mistakes table) |

| Scenario | Tokens without skill | Tokens with skill |
|----------|---------------------|-------------------|
| "Run the dev stack" | ~800 (re-explaining env, ports, Docker) | ~50 (skill trigger + one clarifying question) |
| "Debug this 502 AI error" | ~600 (re-explaining trust boundary, validation gates) | ~80 (skill loads full context) |
| "Add Coimbatore to the city list" | ~400 (explaining COL index + seed + verify) | ~60 (skill loads full procedure) |
| "Verify the PF formula in CompensationService" | ~500 (explaining statutory PF rules, wage ceiling) | ~70 (skill has exact formula) |

---

## Part 2 — MCP Servers

### What MCP is

Model Context Protocol (MCP) is an open standard that lets Claude Code connect to external data sources as first-class tools. Unlike pasting output into a prompt, MCP tools are called by Claude mid-session — the result lands in context exactly where it's needed, without a round-trip through the user.

The difference from skills: **skills load static knowledge** (formulas, procedures, architecture decisions). **MCP servers provide live data** (current docs, live database state, running process output).

---

### Currently active: `context7` — Live library documentation

**What it does:** Resolves library names to documentation IDs, then fetches up-to-date API docs for any version. Claude's training data has a cutoff; `context7` ensures the code written against NestJS v11, Mongoose v9, or `class-transformer` v0.5 uses the current API — not an approximation from training data.

**When Claude uses it automatically (no user action needed):**
- Looking up `@Inject`, `@Module`, `@Global`, `@InjectConnection` signatures
- Checking `lean()` return type in Mongoose v9
- Verifying `@Transform` decorator signature in `class-transformer`
- Confirming `ThrottlerModule.forRoot()` option structure in `@nestjs/throttler` v6
- Looking up `ioredis` constructor options, pipeline API

**Tools:**
- `mcp__context7__resolve-library-id` — `"@nestjs/common"` → context7 doc ID
- `mcp__context7__query-docs` — fetches relevant section by topic

**Configuration:** Installed globally in `~/.claude/settings.json`. No project-level setup needed.

---

### Recommended: MongoDB MCP — Direct collection queries

**Why it's worth adding:** Debugging data issues (stale city-expense documents, missing company profiles, incorrectly stored offer snapshots) currently requires constructing a `mongosh` shell command through the Bash tool. A MongoDB MCP turns this into a direct tool call — faster, less error-prone, and the result stays in Claude's context without a separate terminal.

**Most useful queries for this project:**
```javascript
// Was a city-expense document generated and is it fresh?
db["city-expenses"].findOne({ city: "Mumbai" }, { generatedAt: 1, "individual.total": 1 })

// Which companies don't have aiProfile yet?
db.companies.find({ aiProfile: null }, { name: 1 })

// What did the offer snapshot store?
db.offers.findOne({ userId: "..." }, { snapshot: 1, createdAt: 1 })
```

**How to install** (project-level, not committed):

Add to `.claude/settings.local.json`:
```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": [
        "-y", "@mongodb-js/mongodb-mcp-server",
        "--connectionString", "mongodb://localhost:27017/clearctc"
      ]
    }
  }
}
```

> Local dev connection string only. Never configure a production URI in any file — not committed, not logged.

---

### MCP + Skills together

The two mechanisms complement each other:

```
User: "Why is the Mumbai salary comparison returning low confidence?"

Claude:
  1. Loads /clearctc-debug-ai skill → knows the confidence downgrade rules
  2. Calls MongoDB MCP → queries city-expenses for Mumbai's generatedAt date
  3. Calls MongoDB MCP → queries companies for missing Wipro/Infosys aiProfile
  4. Reads compensation.service.ts → finds the confidence formula
  → Answers with specific data, not guesses
```

Without either mechanism, step 1 would cost 600 tokens of explanation and steps 2–3 would be manual terminal work reported back to Claude via copy-paste.

---

## Configuration files

| File | Scope | Purpose |
|------|-------|---------|
| `skills/<name>/SKILL.md` | This repo | Canonical skill source — versioned with the codebase |
| `~/.claude/skills/<name>/SKILL.md` | Global (all projects) | Installed copy that Claude Code can load at runtime |
| `~/.claude/CLAUDE.md` | Global (all projects) | Registers skill triggers (`/skill-name` → SKILL.md path) |
| `~/.claude/settings.json` | Global | Global MCP server config (context7 lives here) |
| `.claude/settings.local.json` | This project | Project-scoped MCP config (MongoDB local dev) — not committed |

### Installing skills on a new machine

```bash
# From repo root — copy each skill into the global skills directory
for skill in skills/*/; do
  name=$(basename "$skill")
  mkdir -p ~/.claude/skills/$name
  cp "$skill/SKILL.md" ~/.claude/skills/$name/SKILL.md
done
```

Then register each trigger in `~/.claude/CLAUDE.md` following the pattern already in place for the existing skills.
