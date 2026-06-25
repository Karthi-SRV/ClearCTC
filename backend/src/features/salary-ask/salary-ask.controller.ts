import { Body, Controller, Get, Post } from '@nestjs/common';
import { SalaryAskRequestDto } from './dtos/salary-ask-request.dto.js';
import { SalaryAskResponseDto } from './dtos/salary-ask-response.dto.js';
import { SalaryAskService } from './salary-ask.service.js';
import { Public } from '../../shared/decorators/public.decorator.js';

@Controller('api/v1/salary-asks')
export class SalaryAskController {
  constructor(private readonly salaryAsk: SalaryAskService) {}

  @Public()
  @Get('cities')
  getCities(): { cities: string[] } {
    return { cities: this.salaryAsk.getSupportedCities() };
  }

  @Post()
  createSalaryAsk(
    @Body() dto: SalaryAskRequestDto,
  ): Promise<SalaryAskResponseDto> {
    return this.salaryAsk.execute(dto);
  }
}
