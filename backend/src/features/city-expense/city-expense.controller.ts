import { Controller, Get, Query } from '@nestjs/common';
import { CityExpenseService } from '../../core/city-expense/city-expense.service.js';
import { Public } from '../../shared/decorators/public.decorator.js';

@Controller('api/v1')
export class CityExpenseController {
  constructor(private readonly service: CityExpenseService) {}

  /**
   * GET /api/v1/cities
   * Returns a sorted list of city names available in the database.
   * Response: { cities: string[] }
   */
  @Public()
  @Get('cities')
  async getCities(): Promise<{ cities: string[] }> {
    const cities = await this.service.getCityNames();
    return { cities };
  }

  /**
   * GET /api/v1/city-expenses
   *   → all cities
   *
   * GET /api/v1/city-expenses?city=Bangalore
   *   → single city
   *
   * GET /api/v1/city-expenses?city=Bangalore&city=Pune
   *   → multiple cities (repeated param)
   *
   * GET /api/v1/city-expenses?city=Bangalore,Pune
   *   → multiple cities (comma-separated)
   */
  @Get('city-expenses')
  async getAll(@Query('city') cityParam?: string | string[]) {
    const rawList = cityParam
      ? (Array.isArray(cityParam) ? cityParam : [cityParam])
      : [];

    const cities = rawList.flatMap((c) => c.split(','));

    const docs = await this.service.getExpensesByFilter(cities);

    return docs.map((d) => ({
      city: d.city,
      generatedAt: d.generatedAt,
      disclaimer: d.disclaimer,
      individual: d.individual,
      family: d.family,
      family3: d.family3,
      family4: d.family4,
      family5: d.family5,
      family6: d.family6,
    }));
  }
}
