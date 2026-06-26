import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Company,
  CompanyDocument,
} from '../../shared/schemas/company.schema.js';
import type { AiClient } from '../ai/ai-client.interface.js';
import {
  COMPANY_AI_CLIENT,
  GEMINI_QUOTA_EXHAUSTED_PREFIX,
} from '../ai/ai-client.interface.js';
import { AiParseError } from '../ai/ai-parse.error.js';
import type { AiProfile } from './data-source.interface.js';
import { CompanyFetchService } from './company-fetch.service.js';
import { escapeRegex } from '../../shared/utils/regex.util.js';

import { CompanyAiProfileSchema } from '../../shared/schemas/ai-validation.schemas.js';
import {
  COMPANY_PROFILE_SYSTEM_PROMPT,
  buildCompanyProfileUserPrompt,
} from '../../shared/prompts/prompt-registry.js';

const STALE_DAYS = 90;
// Gemini free tier: 15 RPM. Sequential calls with a 15-second gap stay safely under.
const GEMINI_REQUEST_GAP_MS = 15_000;

function isQuotaExhausted(err: unknown): boolean {
  return (
    (err as Error)?.message?.startsWith(GEMINI_QUOTA_EXHAUSTED_PREFIX) ?? false
  );
}

@Injectable()
export class CompanyAiProfileService implements OnModuleDestroy {
  private readonly logger = new Logger(CompanyAiProfileService.name);
  private readonly activeTimeouts = new Set<NodeJS.Timeout>();
  private isShuttingDown = false;

  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @Inject(COMPANY_AI_CLIENT) private readonly ai: AiClient,
    private readonly companyFetch: CompanyFetchService,
  ) {}

  private sleep(ms: number): Promise<void> {
    if (this.isShuttingDown) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.activeTimeouts.delete(timeout);
        resolve();
      }, ms);
      this.activeTimeouts.add(timeout);
    });
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    for (const timeout of this.activeTimeouts) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();
    this.logger.log('Cleanup: stopped company ai profile background seed');
  }

  // Called explicitly from main.ts after app.listen() — guaranteed to run
  // after MongoDB is connected and the app is fully initialized.
  async seedOnStartup(): Promise<void> {
    this.logger.log('Company bootstrap: seeding base data from Gemini...');
    await this.seedMissingCompanies();
    this.logger.log('Company bootstrap: generating aiProfiles...');
    await this.seedMissingProfiles();
    this.logger.log('Company bootstrap: complete');
  }

  // ── Phase 1: seed base company data (roles, ratings, reviews) via Ollama ──
  // Public so it can also be triggered manually (e.g. admin endpoint).

  async seedMissingCompanies(): Promise<void> {
    const unique = await this.companyModel
      .find({})
      .select('name')
      .lean()
      .exec();
    let fetched = 0;
    let skipped = 0;
    let failed = 0;

    // Check which companies are already in MongoDB and have non-empty roles in one query
    const existing = await this.companyModel
      .find({ roles: { $exists: true, $ne: [] } })
      .select('name')
      .lean()
      .exec();
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

    const missing = unique.filter(
      (data) => !existingNames.has(data.name.toLowerCase()),
    );
    skipped = unique.length - missing.length;

    this.logger.log(
      `Company seed: ${skipped} already in DB, ${missing.length} to fetch from Gemini`,
    );

    // Sequential with a gap — Gemini free tier is 15 RPM; 15s between calls ≈ 4 RPM
    for (let i = 0; i < missing.length; i++) {
      if (this.isShuttingDown) {
        this.logger.log('Company seed aborted: application shutting down');
        break;
      }
      const data = missing[i];
      try {
        await this.fetchAndInsertCompany(data.name);
        fetched++;
        this.logger.log(`Company seeded: ${data.name}`);
      } catch (err: unknown) {
        if (isQuotaExhausted(err)) {
          this.logger.error(
            `Gemini account quota exhausted after ${fetched} companies. ` +
              `Restart the app tomorrow or set a new GEMINI_API_KEY to resume. ` +
              `${missing.length - i - 1} companies skipped.`,
          );
          break;
        }
        failed++;
        this.logger.warn(
          `Company seed failed for ${data.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (i < missing.length - 1) {
        await this.sleep(GEMINI_REQUEST_GAP_MS);
      }
    }

    this.logger.log(
      `Company seed done | fetched: ${fetched} | skipped: ${skipped} | failed: ${failed}`,
    );
  }

  private async fetchAndInsertCompany(name: string): Promise<void> {
    const data = await this.companyFetch.fetchCompany(name);
    await this.companyModel.updateOne(
      { name },
      {
        $set: {
          aliases: data.aliases,
          roles: data.roles,
          ratings: data.ratings,
          reviews: data.reviews,
          dataAsOf: new Date(),
        },
      },
      { upsert: true },
    );
  }

  // ── Phase 2: generate aiProfile (qualitative summary) for each company ────

  async seedMissingProfiles(): Promise<void> {
    let generated = 0;
    let skipped = 0;
    try {
      const companies = await this.companyModel
        .find({})
        .select('name ratings reviews aiProfile')
        .lean()
        .exec();

      const needsProfile = companies.filter((company) => {
        const profileAge = company.aiProfile?.generatedAt
          ? Date.now() - new Date(company.aiProfile.generatedAt).getTime()
          : Infinity;
        return !company.aiProfile || profileAge > STALE_DAYS * 86_400_000;
      });

      skipped = companies.length - needsProfile.length;

      // Sequential with a gap — Gemini free tier is 15 RPM; 15s between calls ≈ 4 RPM
      for (let i = 0; i < needsProfile.length; i++) {
        if (this.isShuttingDown) {
          this.logger.log('aiProfile seed aborted: application shutting down');
          break;
        }
        const company = needsProfile[i];
        try {
          const profile = await this.generateProfile(company);
          await this.companyModel.updateOne(
            { _id: company._id },
            { $set: { aiProfile: { ...profile, generatedAt: new Date() } } },
          );
          generated++;
          this.logger.log(`aiProfile generated for ${company.name}`);
        } catch (err: unknown) {
          if (isQuotaExhausted(err)) {
            this.logger.error(
              `Gemini account quota exhausted after ${generated} aiProfiles. ` +
                `Restart the app tomorrow or set a new GEMINI_API_KEY to resume. ` +
                `${needsProfile.length - i - 1} profiles skipped.`,
            );
            break;
          }
          this.logger.warn(
            `aiProfile generation failed for ${company.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        if (i < needsProfile.length - 1) {
          await this.sleep(GEMINI_REQUEST_GAP_MS);
        }
      }

      this.logger.log(
        `aiProfile seed complete | generated: ${generated} | skipped: ${skipped}`,
      );
    } catch (err) {
      this.logger.error(`Failed to seed aiProfiles: ${(err as Error).message}`);
    }
  }

  private async generateProfile(
    company: Pick<CompanyDocument, 'name' | 'ratings' | 'reviews'>,
  ): Promise<Omit<AiProfile, 'generatedAt'>> {
    const userPrompt = buildCompanyProfileUserPrompt(
      company.name,
      company.ratings,
      company.reviews,
    );

    const raw = await this.ai.call(COMPANY_PROFILE_SYSTEM_PROMPT, userPrompt);
    return this.validateProfileResponse(raw, company.name);
  }

  private validateProfileResponse(
    raw: object,
    companyName: string,
  ): Omit<AiProfile, 'generatedAt'> {
    try {
      return CompanyAiProfileSchema.parse(raw);
    } catch (err: any) {
      throw new AiParseError(
        `aiProfile validation failed for ${companyName}: ${err.message ?? err}`,
      );
    }
  }

  async addCompanyAndGenerateProfile(name: string): Promise<CompanyDocument> {
    const data = await this.companyFetch.fetchCompany(name);

    const company = await this.companyModel
      .findOneAndUpdate(
        { name: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        {
          $set: {
            name, // exact casing
            aliases: data.aliases,
            roles: data.roles,
            ratings: data.ratings,
            reviews: data.reviews,
            dataAsOf: new Date(),
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    if (!company) {
      throw new Error(`Failed to upsert company: ${name}`);
    }

    try {
      const profile = await this.generateProfile(company);
      company.aiProfile = { ...profile, generatedAt: new Date() };
      await company.save();
    } catch (err) {
      this.logger.warn(
        `Failed to generate profile for newly added company ${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return company;
  }
}
