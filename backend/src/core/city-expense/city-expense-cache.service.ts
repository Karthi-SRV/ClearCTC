import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import type { CityExpense } from '../../shared/schemas/city-expense.schema.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';
const CACHE_KEY = (city: string) => `city-expense:${city.toLowerCase()}`;
const TTL_SECONDS = 604_800; // 7 days

@Injectable()
export class CityExpenseCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CityExpenseCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleDestroy() {
    this.logger.log('Closing Redis connection...');
    this.redis.disconnect();
  }

  async get(city: string): Promise<CityExpense | null> {
    try {
      const raw = await this.redis.get(CACHE_KEY(city));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CityExpense;
      parsed.generatedAt = new Date(parsed.generatedAt as unknown as string);
      return parsed;
    } catch (err) {
      this.logger.warn(
        `Redis GET failed for ${city}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async set(city: string, data: CityExpense): Promise<void> {
    try {
      await this.redis.set(
        CACHE_KEY(city),
        JSON.stringify(data),
        'EX',
        TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `Redis SET failed for ${city}: ${(err as Error).message}`,
      );
    }
  }

  async del(city: string): Promise<void> {
    try {
      await this.redis.del(CACHE_KEY(city));
    } catch (err) {
      this.logger.warn(
        `Redis DEL failed for ${city}: ${(err as Error).message}`,
      );
    }
  }
}
