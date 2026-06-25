import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalaryComparisonService } from './salary-comparison.service.js';
import { SalaryComparisonController } from './salary-comparison.controller.js';
import { User, UserSchema } from '../../shared/schemas/user.schema.js';
import { CompensationModule } from '../../core/compensation/compensation.module.js';
import { DataModule } from '../../core/data/data.module.js';
import { CityExpenseModule } from '../../core/city-expense/city-expense.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    CompensationModule,
    DataModule,
    CityExpenseModule,
  ],
  controllers: [SalaryComparisonController],
  providers: [SalaryComparisonService],
})
export class SalaryComparisonModule {}
