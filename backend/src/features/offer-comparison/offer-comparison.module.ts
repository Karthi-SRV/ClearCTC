import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../../core/ai/ai.module.js';
import { CityExpenseModule } from '../../core/city-expense/city-expense.module.js';
import { CompensationModule } from '../../core/compensation/compensation.module.js';
import { DataModule } from '../../core/data/data.module.js';
import { Offer, OfferSchema } from '../../shared/schemas/offer.schema.js';
import { User, UserSchema } from '../../shared/schemas/user.schema.js';
import { OfferComparisonController } from './offer-comparison.controller.js';
import { OfferComparisonService } from './offer-comparison.service.js';
import { OffersService } from './offers.service.js';

@Module({
  imports: [
    AiModule,
    CityExpenseModule,
    CompensationModule,
    DataModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Offer.name, schema: OfferSchema },
    ]),
  ],
  controllers: [OfferComparisonController],
  providers: [OfferComparisonService, OffersService],
})
export class OfferComparisonModule {}
