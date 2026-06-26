import {
  Body,
  Controller,
  Get,
  Post,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CompanyService } from './company.service.js';
import { AddCompanyDto } from './dtos/add-company.dto.js';
import { Public } from '../../shared/decorators/public.decorator.js';

@Controller('api/v1/companies')
export class CompanyController {
  private readonly logger = new Logger(CompanyController.name);

  constructor(private readonly companyService: CompanyService) {}

  @Get()
  async getCompanies() {
    this.logger.log('GET /api/v1/companies');
    const list = await this.companyService.findAll();
    return { companies: list };
  }

  @Post()
  async addCompany(@Body() dto: AddCompanyDto) {
    this.logger.log(`POST /api/v1/companies | name: ${dto.name}`);
    try {
      await this.companyService.findOrCreate(dto.name);
      const list = await this.companyService.findAll();
      return { companies: list };
    } catch (err: any) {
      this.logger.error(
        `Failed to add company ${dto.name} via AI: ${err.message}`,
      );
      throw new BadRequestException(
        `Failed to seed company details with AI: ${err.message}`,
      );
    }
  }
}
