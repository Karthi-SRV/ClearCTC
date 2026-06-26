import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CachedDataSource } from './cached-data-source.js';
import { CompanyAiProfileService } from './company-ai-profile.service.js';
import { CompanyFetchService } from './company-fetch.service.js';
import { Company, CompanySchema } from '../../shared/schemas/company.schema.js';
import {
  CityExpense,
  CityExpenseSchema,
} from '../../shared/schemas/city-expense.schema.js';
import { DATA_SOURCE } from './data-source.interface.js';
import { LiveDataSource } from './live-data-source.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [
    AiModule,
    MongooseModule.forFeature([
      { name: Company.name, schema: CompanySchema },
      { name: CityExpense.name, schema: CityExpenseSchema },
    ]),
  ],
  providers: [
    CachedDataSource,
    CompanyFetchService,
    CompanyAiProfileService,
    {
      provide: DATA_SOURCE,
      useFactory: (config: ConfigService, cached: CachedDataSource) => {
        const mode = config.get<string>('DATA_SOURCE', 'cached');
        return mode === 'live' ? new LiveDataSource() : cached;
      },
      inject: [ConfigService, CachedDataSource],
    },
  ],
  exports: [DATA_SOURCE, CompanyAiProfileService, CompanyFetchService],
})
export class DataModule {}
