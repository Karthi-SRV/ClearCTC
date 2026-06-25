import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CityExpenseService } from '../../core/city-expense/city-expense.service.js';
import { AdminGuard } from '../../shared/guards/admin.guard.js';

const STANDARD_CITIES = [
  'Kolkata',
  'Chennai',
  'Hyderabad',
  'Pune',
  'Bangalore',
  'Mumbai',
];

@Controller('api/v1/city-expenses')
@UseGuards(AdminGuard)
export class CityExpenseAdminController {
  constructor(private readonly cityExpense: CityExpenseService) {}

  @Post('refresh')
  async refresh(
    @Body() body: { city?: string },
  ): Promise<object> {
    const cities = body.city ? [body.city] : STANDARD_CITIES;
    const results = await Promise.allSettled(
      cities.map((c) => this.cityExpense.forceRefresh(c)),
    );
    return {
      cities,
      results: cities.map((city, i) => ({
        city,
        status: results[i].status,
        ...(results[i].status === 'rejected' && {
          error: (results[i] as PromiseRejectedResult).reason?.message,
        }),
      })),
    };
  }
}
