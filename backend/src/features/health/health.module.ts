import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CityExpenseModule } from '../../core/city-expense/city-expense.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [MongooseModule, CityExpenseModule],
  controllers: [HealthController],
})
export class HealthModule {}
