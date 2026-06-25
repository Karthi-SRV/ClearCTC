import { Module } from '@nestjs/common';
import { CityExpenseModule } from '../../core/city-expense/city-expense.module.js';
import { AdminGuard } from '../../shared/guards/admin.guard.js';
import { CityExpenseAdminController } from './city-expense-admin.controller.js';
import { CityExpenseController } from './city-expense.controller.js';

@Module({
  imports: [CityExpenseModule],
  controllers: [CityExpenseAdminController, CityExpenseController],
  providers: [AdminGuard],
})
export class CityExpenseAdminModule {}
