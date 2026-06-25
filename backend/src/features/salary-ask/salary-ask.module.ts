import { Module } from '@nestjs/common';
import { CompensationModule } from '../../core/compensation/compensation.module.js';
import { DataModule } from '../../core/data/data.module.js';
import { CityExpenseModule } from '../../core/city-expense/city-expense.module.js';
import { SalaryAskController } from './salary-ask.controller.js';
import { SalaryAskService } from './salary-ask.service.js';

@Module({
  imports: [CompensationModule, DataModule, CityExpenseModule],
  controllers: [SalaryAskController],
  providers: [SalaryAskService],
})
export class SalaryAskModule {}
