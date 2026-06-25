import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type Redis from 'ioredis';
import { Connection } from 'mongoose';
import { REDIS_CLIENT } from '../../core/city-expense/city-expense-cache.service.js';
import { Public } from '../../shared/decorators/public.decorator.js';

interface HealthStatus {
  status: 'ok' | 'degraded';
  db: 'connected' | 'disconnected';
  cache: 'ok' | 'error';
  uptime: number;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly db: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async getHealth(): Promise<HealthStatus> {
    const dbOk = this.db.readyState === 1;

    let cacheOk = false;
    try {
      await this.redis.ping();
      cacheOk = true;
    } catch {
      // Redis unreachable — degraded but not fatal
    }

    const result: HealthStatus = {
      status: dbOk && cacheOk ? 'ok' : 'degraded',
      db: dbOk ? 'connected' : 'disconnected',
      cache: cacheOk ? 'ok' : 'error',
      uptime: Math.floor(process.uptime()),
    };

    if (!dbOk || !cacheOk) {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
