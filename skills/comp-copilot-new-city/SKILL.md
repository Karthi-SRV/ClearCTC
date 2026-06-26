# comp-copilot-new-city

Step-by-step guide to add a new Indian city to the comp-copilot expense system. Use this skill when the user wants to add a city to the city-expense database or COL index.

**Trigger:** `/comp-copilot-new-city`

---

## Where city data lives

| System | File/Collection | Purpose |
|--------|-----------------|---------|
| Seed list | `scripts/seed.ts` → `STANDARD_CITIES` | Cities seeded into `city-expenses` MongoDB collection on startup |
| MongoDB collection | `city-expenses` | One doc per city: 6 family-size breakdowns + `colIndex` field calculated relative to the base city (Chennai = 1.00 base) |
| Redis cache | Key = city name | TTL-based cache in front of MongoDB |

To add a city, it only needs to be added to the seed list. Its cost-of-living (COL) index will be derived automatically relative to the base city (Chennai).

---

## Step 1: Add to the seed list

File: `scripts/seed.ts` → `STANDARD_CITIES` array

```typescript
const STANDARD_CITIES = [
  // ... existing cities ...
  'New City',    // add here, under the appropriate regional group
];
```

The seed script runs at app startup via `onApplicationBootstrap` in `DataModule`. It is idempotent — re-running skips cities that already have a fresh document.

---

## Step 2: Dynamic COL index calculation

You do not need to manually configure the COL index anymore! When `CityExpenseService` fetches or updates the cost-of-living breakdowns for a city (via `CityExpenseFetchService` / AI Client), it automatically derives the `colIndex` as:
```typescript
colIndex = Math.round((result.family4.total / baseCity.family4.total) * 100) / 100;
```
where `baseCity` is the document in MongoDB marked with `isBase: true` (e.g. Chennai, which has a `colIndex` of `1.0`).

---

## Step 3: Regenerate expense data

After adding the city to the seed list, trigger the AI fetch:

**Option A — restart the backend** (seed runs automatically on boot):
```bash
# Backend restarts automatically in watch mode when you save the file
# Or: Ctrl+C → npm run start:dev
```

**Option B — admin refresh endpoint** (no restart needed):
```bash
curl -s -X POST http://localhost:3000/api/v1/city-expenses/refresh/NewCity \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```

The fetch calls `CITY_EXPENSE_AI_CLIENT` (follows `AI_PROVIDER` env) and asks for all 6 family-size breakdowns in a single prompt. Validates all 42 fields (6 breakdowns × 7 fields each) before upsert.

---

## Step 4: Verify

```bash
# Check city is in the city list
curl -s http://localhost:3000/api/v1/cities | python3 -m json.tool | grep "New City"

# Check expense data was generated
curl -s "http://localhost:3000/api/v1/city-expenses?cities=NewCity" | python3 -m json.tool
```

MongoDB direct check:
```bash
docker exec comp-copilot-mongo-1 mongosh comp-copilot \
  --eval 'db["city-expenses"].findOne({ city: "New City" }, { city:1, generatedAt:1, "individual.total":1 })'
```

---

## Step 5: Update frontend city list (if needed)

The frontend fetches the city list dynamically from `GET /api/v1/cities` — no hardcoded list in the React code. No frontend changes needed.

---

## Failure modes

| Failure | What happens |
|---------|-------------|
| AI returns incomplete breakdown | `CityExpenseFetchService` throws `AiParseError`; city stays in DB with old data |
| Gemini quota exhausted | Logs `[GEMINI_QUOTA_EXHAUSTED]`; use admin refresh endpoint tomorrow |
| City not in MongoDB | Phase 1 salary comparison skips the city (no multiplier) |
| Stale data (>90 days) | Background refresh triggered on next request; stale data returned immediately |

---

## Removing a city

1. Remove from `STANDARD_CITIES` in `scripts/seed.ts`
2. Delete the MongoDB document:
   ```bash
   docker exec comp-copilot-mongo-1 mongosh comp-copilot \
     --eval 'db["city-expenses"].deleteOne({ city: "Old City" })'
   ```
3. Clear Redis cache entry:
   ```bash
   curl -s -X DELETE http://localhost:3000/api/v1/city-expenses/cache/OldCity \
     -H "X-Admin-Token: $ADMIN_TOKEN"
   ```