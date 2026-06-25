import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import Redis from 'ioredis';
import { AiModule } from '../ai/ai.module.js';
import {
  CityExpense,
  CityExpenseSchema,
} from '../../shared/schemas/city-expense.schema.js';
import {
  CityExpenseCacheService,
  REDIS_CLIENT,
} from './city-expense-cache.service.js';
import { CityExpenseFetchService } from './city-expense-fetch.service.js';
import { CityExpenseService } from './city-expense.service.js';

@Module({
  imports: [
    AiModule,
    MongooseModule.forFeature([
      { name: CityExpense.name, schema: CityExpenseSchema },
    ]),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
        const client = new Redis(url);
        client.on('error', (err: Error) => {
          console.warn('[Redis] connection error:', err.message);
        });
        return client;
      },
      inject: [ConfigService],
    },
    CityExpenseCacheService,
    CityExpenseFetchService,
    CityExpenseService,
  ],
  exports: [CityExpenseService],
})
export class CityExpenseModule {}
