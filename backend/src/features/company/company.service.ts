import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Company,
  CompanyDocument,
} from '../../shared/schemas/company.schema.js';
import { CompanyAiProfileService } from '../../core/data/company-ai-profile.service.js';
import { escapeRegex } from '../../shared/utils/regex.util.js';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly companyAiProfileService: CompanyAiProfileService,
  ) {}

  async findAll(): Promise<CompanyDocument[]> {
    return this.companyModel
      .find({}, { name: 1 })
      .sort({ name: 1 })
      .lean()
      .exec() as any;
  }

  async findOrCreate(name: string): Promise<CompanyDocument> {
    const pattern = new RegExp(`^${escapeRegex(name)}$`, 'i');
    const existing = await this.companyModel.findOne({ name: pattern }).exec();
    if (existing) {
      return existing;
    }

    // Create shell company with default values immediately
    const newCompany = new this.companyModel({
      name,
      aliases: [],
      roles: [],
      ratings: [],
      reviews: [],
      dataAsOf: new Date(),
      aiProfile: null,
    });
    const saved = await newCompany.save();

    // Trigger Gemini fetching and profiling in the background
    void this.companyAiProfileService
      .addCompanyAndGenerateProfile(name)
      .catch((err: Error) => {
        this.logger.error(
          `Background company AI seeding failed for ${name}: ${err.message}`,
        );
      });

    return saved;
  }
}
