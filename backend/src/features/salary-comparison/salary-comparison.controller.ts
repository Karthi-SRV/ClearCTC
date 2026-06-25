import { Body, Controller, Get, Post, Inject } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { SalaryComparisonService } from './salary-comparison.service.js';
import { QuickSalaryComparisonDto } from './dtos/salary-comparison-request.dto.js';
import { CurrentUser } from '../../shared/decorators/current-user.decorator.js';
import type { AuthPayload } from '../auth/auth.service.js';
import { Public } from '../../shared/decorators/public.decorator.js';
import { DATA_SOURCE } from '../../core/data/data-source.interface.js';
import type { DataSource } from '../../core/data/data-source.interface.js';

@Controller('api/v1/salary-comparisons')
export class SalaryComparisonController {
  private readonly logger = new Logger(SalaryComparisonController.name);

  constructor(
    private readonly salaryComparison: SalaryComparisonService,
    @Inject(DATA_SOURCE) private readonly dataSource: DataSource,
  ) {}

  @Public()
  @Get('companies')
  async getCompanies(): Promise<{ companies: string[] }> {
    this.logger.log(`GET /api/v1/salary-comparisons/companies`);
    const companies = await this.dataSource.getCompanyNames();
    return { companies };
  }

  @Post('')
  quickComparison(
    @CurrentUser() user: AuthPayload,
    @Body() dto: QuickSalaryComparisonDto,
  ) {
    this.logger.log(`POST /api/v1/salary-comparisons | userId: ${user.sub} | offerCount: ${dto.offers?.length || 0}`);
    return this.salaryComparison.execute(user.sub, dto);
  }
}
