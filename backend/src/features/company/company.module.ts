import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from '../../shared/schemas/company.schema.js';
import { DataModule } from '../../core/data/data.module.js';
import { CompanyController } from './company.controller.js';
import { CompanyService } from './company.service.js';

@Module({
  imports: [
    DataModule,
    MongooseModule.forFeature([{ name: Company.name, schema: CompanySchema }]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
