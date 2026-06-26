import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Logger,
} from '@nestjs/common';
import { InterviewService } from './interview.service.js';
import { CreateInterviewDto } from './dtos/create-interview.dto.js';
import { UpdateInterviewDto } from './dtos/update-interview.dto.js';
import { MongoIdParamDto } from './dtos/mongo-id-param.dto.js';
import { CurrentUser } from '../../shared/decorators/current-user.decorator.js';
import type { AuthPayload } from '../auth/auth.service.js';

@Controller('api/v1/interviews')
export class InterviewController {
  private readonly logger = new Logger(InterviewController.name);

  constructor(private readonly interviewService: InterviewService) {}

  @Get()
  async getInterviews(@CurrentUser() user: AuthPayload): Promise<unknown> {
    this.logger.log(`GET /api/v1/interviews | userId: ${user.sub}`);
    return this.interviewService.findAll(user.sub);
  }

  @Get(':id')
  async getInterview(
    @Param() { id }: MongoIdParamDto,
    @CurrentUser() user: AuthPayload,
  ): Promise<unknown> {
    this.logger.log(`GET /api/v1/interviews/${id.toString()} | userId: ${user.sub}`);
    return this.interviewService.findOne(id.toString(), user.sub);
  }

  @Get(':id/questions')
  async getInterviewQuestions(
    @Param() { id }: MongoIdParamDto,
    @CurrentUser() user: AuthPayload,
  ): Promise<unknown> {
    this.logger.log(
      `GET /api/v1/interviews/${id.toString()}/questions | userId: ${user.sub}`,
    );
    return this.interviewService.findQuestions(id.toString(), user.sub);
  }

  @Post()
  async createInterview(
    @Body() dto: CreateInterviewDto,
    @CurrentUser() user: AuthPayload,
  ): Promise<unknown> {
    this.logger.log(
      `POST /api/v1/interviews | userId: ${user.sub} | company: ${dto.companyId}`,
    );
    return this.interviewService.create(user.sub, dto);
  }

  @Put(':id')
  async updateInterview(
    @Param() { id }: MongoIdParamDto,
    @Body() dto: UpdateInterviewDto,
    @CurrentUser() user: AuthPayload,
  ): Promise<unknown> {
    this.logger.log(`PUT /api/v1/interviews/${id.toString()} | userId: ${user.sub}`);
    return this.interviewService.update(id.toString(), user.sub, dto);
  }

  @Delete(':id')
  async deleteInterview(
    @Param() { id }: MongoIdParamDto,
    @CurrentUser() user: AuthPayload,
  ): Promise<unknown> {
    this.logger.log(`DELETE /api/v1/interviews/${id.toString()} | userId: ${user.sub}`);
    return this.interviewService.delete(id.toString(), user.sub);
  }
}
