# Skill: nestjs-three-layer-cache

## When to load this skill

Load this skill whenever any task involves:
- Caching AI-generated data in Redis + MongoDB
- Implementing a read-through cache pattern in NestJS
- Adding a TTL-based freshness check
- Designing a fallback when Redis or AI is unavailable
- Building a prefetch / warm strategy

---

## The pattern

Three layers, checked in order:
```
Request → Redis (fast) → MongoDB (durable) → AI fetch (slow) → store both → return
```

Each layer is a fallback for the one above. The user always gets data — from the fastest
available source. The AI is only called when both caches miss or data is stale.

---

## Cache key convention

All keys go through a typed utility — never raw string literals.

```typescript
// shared/utils/cache-key.util.ts
export const CacheKey = {
  cityExpense: (city: string) =>
    `city-expense:${city.toLowerCase()}`,
  colIndex: (city: string) =>
    `col-index:${city.toLowerCase()}`,
  company: (name: string) =>
    `company:${name.toLowerCase().replace(/\s+/g, '-')}`,
  warmStatus: (target: string) =>
    `warm-status:${target}`,
} as const;
```

Grep for raw string literals matching these patterns — any result is a bug.

---

## TTL reference

| Data | Redis TTL | MongoDB freshness | Why |
|---|---|---|---|
| City expense breakdown | 7 days | 30 days | AI-generated; changes slowly |
| Company profile | 7 days | 30 days | AI-generated; changes slowly |
| COL index | 30 days | Never re-fetch | Seeded data; rarely changes |
| Warm status | No TTL | N/A | Operational record |

---

## Cache service pattern

```typescript
// core/city-expense/city-expense-cache.service.ts
@Injectable()
export class CityExpenseCacheService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async get(city: string): Promise<CityExpenseDocument | null> {
    try {
      const raw = await this.redis.get(CacheKey.cityExpense(city));
      return raw ? (JSON.parse(raw) as CityExpenseDocument) : null;
    } catch {
      return null;   // Redis failure → fall through to MongoDB
    }
  }

  async set(city: string, doc: CityExpenseDocument): Promise<void> {
    try {
      await this.redis.setex(
        CacheKey.cityExpense(city),
        7 * 24 * 60 * 60,   // 7 days in seconds
        JSON.stringify(doc),
      );
    } catch {
      // Redis write failure is not fatal — MongoDB is the durable store
    }
  }

  async invalidate(city: string): Promise<void> {
    try {
      await this.redis.del(CacheKey.cityExpense(city));
    } catch { /* non-fatal */ }
  }
}
```

Rules:
- Every Redis operation is wrapped in try-catch.
- Redis failure is never fatal — always falls through to MongoDB.
- Every `set` operation specifies an explicit TTL (`setex` not `set`).
- `invalidate` is non-fatal — a failed invalidation is not a crash.

---

## Main service pattern (three-layer read)

```typescript
// core/city-expense/city-expense.service.ts
@Injectable()
export class CityExpenseService {
  constructor(
    private readonly cache: CityExpenseCacheService,
    @InjectModel(CityExpenseDocument.name)
    private readonly model: Model<CityExpenseDocument>,
    private readonly fetchService: CityExpenseFetchService,
    private readonly logger: AppLogger,
  ) {}

  async getExpenseBreakdown(city: string): Promise<CityExpenseDocument> {

    // Layer 1 — Redis
    const cached = await this.cache.get(city);
    if (cached) return cached;

    // Layer 2 — MongoDB
    const stored = await this.model.findOne({ city }).exec();
    if (stored && this.isFresh(stored.generatedAt, 30)) {
      await this.cache.set(city, stored.toObject());   // backfill Redis
      return stored.toObject();
    }

    // Layer 3 — AI fetch
    try {
      const fresh = await this.fetchService.fetchFromAi(city);
      await this.model.findOneAndUpdate(
        { city },
        { $set: fresh },
        { upsert: true, new: true }
      );
      await this.cache.set(city, fresh);
      return fresh;
    } catch (err) {
      this.logger.warn(`AI fetch failed for ${city}`, err);
      if (stored) {
        // Stale fallback — better than nothing
        const stale = stored.toObject();
        stale.disclaimer += ' (Note: data may be outdated — refresh failed)';
        return stale;
      }
      throw new CityExpenseUnavailableError(city);
    }
  }

  private isFresh(date: Date, maxAgeDays: number): boolean {
    const ageMs = Date.now() - new Date(date).getTime();
    return ageMs < maxAgeDays * 24 * 60 * 60 * 1000;
  }
}
```

---

## Startup warm pattern

```typescript
// core/data-warm/data-warm.service.ts
@Injectable()
export class DataWarmService implements OnApplicationBootstrap {

  async onApplicationBootstrap(): Promise<void> {
    // Fire and forget — never block startup
    this.warmAll().catch(err =>
      this.logger.error('Startup warm failed', err)
    );
  }

  async warmAll(): Promise<WarmResult> {
    const start = Date.now();
    const [expenses, companies, colIndices] = await Promise.allSettled([
      this.warmCityExpenses(),
      this.warmCompanyProfiles(),
      this.warmColIndices(),
    ]);
    return {
      startedAt: new Date(start).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      tasks: {
        cityExpenses:    this.toResult(expenses),
        companyProfiles: this.toResult(companies),
        colIndices:      this.toResult(colIndices),
      },
      overallStatus: this.deriveStatus(expenses, companies, colIndices),
    };
  }

  private async warmCityExpenses(): Promise<void> {
    const cities = ['Kolkata','Chennai','Hyderabad','Pune','Bangalore','Mumbai'];
    // Batch to respect Gemini free tier 15 RPM ceiling
    const batches = chunk(cities, 3);
    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(city =>
          this.cityExpenseService.getExpenseBreakdown(city)
            .catch(err => this.logger.warn(`Expense warm failed: ${city}`, err))
        )
      );
      if (batches.indexOf(batch) < batches.length - 1) {
        await sleep(4_000);   // stay under 15 RPM
      }
    }
  }
}
```

Rules:
- `onApplicationBootstrap` always fire-and-forget via `.catch()`.
- Never `await` the warm inside `onApplicationBootstrap`.
- Individual item failures never stop other items — use `Promise.allSettled`.
- Batch AI calls to respect rate limits — never fire all simultaneously.

---

## Cron refresh pattern

```typescript
@Injectable()
export class DataWarmCron {
  @Cron('30 20 * * *', { timeZone: 'Asia/Kolkata' })  // 02:00 IST
  async nightlyRefresh(): Promise<void> {
    if (process.env.CRON_ENABLED !== 'true') return;  // guard for test env
    try {
      await this.dataWarmService.warmAll();
    } catch (err) {
      this.logger.error('Nightly refresh failed', err);
      // never throw from cron — would crash the app
    }
  }
}
```

---

## Docker Compose: Redis with health check

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5

backend:
  depends_on:
    redis:
      condition: service_healthy
    mongo:
      condition: service_healthy
```

---

## WarmResult type

```typescript
export interface WarmResult {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  tasks: {
    cityExpenses:    { success: string[]; failed: string[] };
    companyProfiles: { success: string[]; failed: string[] };
    colIndices:      { success: string[]; failed: string[] };
  };
  overallStatus: 'full' | 'partial' | 'failed';
}
```

Store in Redis under `CacheKey.warmStatus('last-run')` after every warm run.

---

## Test coverage requirements

Every cache service must have tests for:
- Redis hit → MongoDB never called, AI never called
- Redis miss + MongoDB fresh hit → written to Redis, AI never called
- Redis miss + MongoDB stale → AI called, result stored in both
- Redis miss + MongoDB miss → AI called, result stored in both
- AI failure + stale MongoDB record → stale record returned with disclaimer amended
- AI failure + no MongoDB record → error thrown
- Redis failure → falls through to MongoDB (Redis error is non-fatal)