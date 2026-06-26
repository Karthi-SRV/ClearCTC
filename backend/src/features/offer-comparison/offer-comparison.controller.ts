import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateOfferComparisonDto } from '../../shared/dtos/offer-input.dto.js';
import { OfferComparisonService } from './offer-comparison.service.js';
import { CurrentUser } from '../../shared/decorators/current-user.decorator.js';
import { AiThrottlerGuard } from '../../shared/guards/ai-throttler.guard.js';
import type { AuthPayload } from '../auth/auth.service.js';

@Controller('api/v1/offer-comparisons')
export class OfferComparisonController {
  private readonly logger = new Logger(OfferComparisonController.name);

  constructor(private readonly offerComparison: OfferComparisonService) {}

  // 3 AI comparison requests per user per hour.
  @Post()
  @UseGuards(AiThrottlerGuard)
  @Throttle({ ai: { limit: 3, ttl: 60_000 } })
  createOfferComparison(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateOfferComparisonDto,
  ) {
    this.logger.log(
      `POST /api/v1/offer-comparisons | userId: ${user.sub} | offerCount: ${dto.offers?.length || 0}`,
    );
    return this.offerComparison.execute(user.sub, dto);
  }
}
