# comp-copilot-debug-ai

Debugging guide for AI pipeline issues in comp-copilot: validation failures, quota exhaustion, provider switching, and the trust-boundary contract. Use this skill when an AI-related bug surfaces in development or production.

**Trigger:** `/comp-copilot-debug-ai`

---

## Architecture overview (read before debugging)

There are **three separate AI DI tokens**, each with its own provider:

| Token | Default provider | Used by |
|-------|-----------------|---------|
| `AI_CLIENT` | `AI_PROVIDER` env | General use |
| `CITY_EXPENSE_AI_CLIENT` | `AI_PROVIDER` env | City living-cost fetches |
| `COMPANY_AI_CLIENT` | Always Gemini | Company AI profile generation |

Switching `AI_PROVIDER=ollama` switches `AI_CLIENT` and `CITY_EXPENSE_AI_CLIENT` but **never** `COMPANY_AI_CLIENT`.

---

## Trust boundary (the invariant that must never break)

`CompensationService` owns **all** financial math. It runs synchronously before any AI call. The AI receives an already-computed `OfferSnapshot` and may only:
- Rank/compare offers using the numbers given to it
- Summarise supplied review text
- Echo the confidence level computed by `CompensationService`

If the AI response fails validation the API returns **502** — it never merges invalid AI output with deterministic data.

---

## Validation gates (where to look first)

### Offer comparison (`AiResponseParser`)
File: `backend/src/core/ai/ai-response-parser.ts`

The parser:
1. Strips markdown code fences (` ```json ... ``` `)
2. Calls `JSON.parse`
3. Throws `AiParseError` for non-object responses

After parsing, `OfferComparisonService` validates:
- `scores` entries: all values 0–100
- `breakdown` field sums: ±1 of 100
- `bestOffer` value: must match one of the supplied company names exactly

Any failure → `AiExceptionFilter` returns 502 to client.

### City expense fetch (`CityExpenseFetchService`)
File: `backend/src/core/city-expense/city-expense-fetch.service.ts`

Validates all 6 family-size breakdowns exist and all 7 fields within each are non-null numbers and that `total` equals the sum of all fields.

---

## Debugging by symptom

### 502 on `/api/phase2/compare`

1. Check backend logs for `[AiParseError]` or `[validation]` prefix
2. Enable raw response logging temporarily:
   ```typescript
   // In gemini-ai-client.ts, before return:
   this.logger.debug({ rawResponse: raw });
   ```
3. Common causes:
   - Model returned explanation text before/after the JSON → code-fence stripping handles ` ``` ` but not bare prose preamble
   - `bestOffer` name has different capitalisation than the offer input
   - Score breakdown doesn't sum to 100 (model arithmetic error)

### Gemini 429 (rate limit)

Gemini free tier: 15 RPM. The retry loop in `GeminiAiClient` handles soft 429s with 15 s → 30 s → 60 s backoff (3 attempts).

Check:
```bash
grep "Retrying Gemini" backend/logs/app.log   # or Winston console output
```

### `[GEMINI_QUOTA_EXHAUSTED]` in logs

This is a **hard** daily quota hit, not a soft rate limit. The seed loop aborts immediately when it sees this prefix (see `company-ai-profile.service.ts`). Do **not** retry.

Fix for dev: switch to Ollama for non-company AI tasks:
```
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```
Company profiles (`COMPANY_AI_CLIENT`) always use Gemini regardless.

### City expense returns stale data

Lookup chain: Redis → MongoDB → AI. A stale document (older than `STALE_DATA_THRESHOLD_DAYS`, default 90) triggers a background AI refresh — the stale document is returned immediately to the caller, then replaced when AI responds.

To force a refresh:
```bash
curl -s -X POST http://localhost:3000/api/v1/city-expenses/refresh/Mumbai \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

Or refresh all cities:
```bash
curl -s -X POST http://localhost:3000/api/v1/city-expenses/refresh \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

### Provider not switching

Environment variable is read at module initialisation. After changing `AI_PROVIDER`:
1. Restart the NestJS process (Ctrl+C → `npm run start:dev`)
2. Confirm: check logs for `[AiModule] AI provider: ollama` (or whichever provider)

---

## Switching AI providers

| Provider | Env vars needed | Notes |
|----------|----------------|-------|
| `gemini` | `GEMINI_API_KEY`, `GEMINI_MODEL` | Default; free 15 RPM |
| `ollama` | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Pull model first: `docker compose exec ollama ollama pull llama3.2` |
| `claude` | `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Has 429 retry logic matching Gemini's |
| `google` (Vertex AI) | `VERTEX_PROJECT`, `VERTEX_LOCATION`, `VERTEX_MODEL` | Needs `gcloud auth application-default login` |

---

## Adding a new AI provider

1. Create `backend/src/core/ai/<name>-ai-client.ts` implementing `AiClient` interface
2. Add to `AiModule` switch in `backend/src/core/ai/ai.module.ts`
3. Import retry util: `import { MAX_RETRIES, retryDelay, sleep } from './ai-retry.util.js'`
4. Write spec file: `<name>-ai-client.spec.ts` — mock the HTTP call, test 429 retry, test 500 error
5. Add `AI_PROVIDER=<name>` to `.env.example`

The `COMPANY_AI_CLIENT` token is always Gemini — do not add it to the provider switch.
