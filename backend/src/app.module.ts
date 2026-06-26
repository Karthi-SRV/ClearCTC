import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard.js';
import { SalaryAskModule } from './features/salary-ask/salary-ask.module.js';
import { OfferComparisonModule } from './features/offer-comparison/offer-comparison.module.js';
import { SalaryComparisonModule } from './features/salary-comparison/salary-comparison.module.js';
import { HealthModule } from './features/health/health.module.js';
import { CityExpenseAdminModule } from './features/city-expense/city-expense-admin.module.js';
import { AuthModule } from './features/auth/auth.module.js';
import { CompanyModule } from './features/company/company.module.js';
import { PositionModule } from './features/position/position.module.js';
import { InterviewModule } from './features/interview/interview.module.js';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor.js';
import { LoggerModule } from './core/logger/logger.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    // Named throttler for AI endpoints. Limit enforced per userId via AiThrottlerGuard.
    ThrottlerModule.forRoot([{ name: 'ai', ttl: 60_000, limit: 3 }]),
    LoggerModule,
    AuthModule,
    SalaryAskModule,
    OfferComparisonModule,
    SalaryComparisonModule,
    HealthModule,
    CityExpenseAdminModule,
    CompanyModule,
    PositionModule,
    InterviewModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
