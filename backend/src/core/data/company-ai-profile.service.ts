import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../../shared/schemas/company.schema.js';
import type { AiClient } from '../ai/ai-client.interface.js';
import { COMPANY_AI_CLIENT } from '../ai/ai-client.interface.js';
import { AiParseError } from '../ai/ai-parse.error.js';
import { GEMINI_QUOTA_EXHAUSTED_PREFIX } from '../ai/gemini-ai-client.js';
import type { AiProfile } from './data-source.interface.js';
import { CompanyFetchService } from './company-fetch.service.js';

interface AiProfileRaw {
  companySize: string;
  basicInsurance: string;
  otherBenefits: string[];
  pros: string[];
  cons: string[];
  riskLevel: string;
  riskFactors: string[];
  benefitForRisk: string;
}

const PROFILE_SYSTEM_PROMPT =
  'You are a workplace analyst. Summarize the company profile from the ' +
  'supplied ratings and reviews only. Never invent facts not present in the data. ' +
  'All claims must cite the review source or rating dimension that drove them. ' +
  'Return only valid JSON. Start with { and end with }.';

const STALE_DAYS = 90;
// Gemini free tier: 15 RPM. Sequential calls with a 15-second gap stay safely under.
const GEMINI_REQUEST_GAP_MS = 15_000;

function isQuotaExhausted(err: unknown): boolean {
  return (err as Error)?.message?.startsWith(GEMINI_QUOTA_EXHAUSTED_PREFIX) ?? false;
}

@Injectable()
export class CompanyAiProfileService implements OnModuleDestroy {
  private readonly logger = new Logger(CompanyAiProfileService.name);
  private readonly activeTimeouts = new Set<NodeJS.Timeout>();
  private isShuttingDown = false;

  constructor(
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
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
    const unique =  await this.companyModel
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

    const missing = unique.filter((data) => !existingNames.has(data.name.toLowerCase()));
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
      } catch (err: any) {
        if (isQuotaExhausted(err)) {
          this.logger.error(
            `Gemini account quota exhausted after ${fetched} companies. ` +
            `Restart the app tomorrow or set a new GEMINI_API_KEY to resume. ` +
            `${missing.length - i - 1} companies skipped.`,
          );
          break;
        }
        failed++;
        this.logger.warn(`Company seed failed for ${data.name}: ${err?.message}`);
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
        } catch (err: any) {
          if (isQuotaExhausted(err)) {
            this.logger.error(
              `Gemini account quota exhausted after ${generated} aiProfiles. ` +
              `Restart the app tomorrow or set a new GEMINI_API_KEY to resume. ` +
              `${needsProfile.length - i - 1} profiles skipped.`,
            );
            break;
          }
          this.logger.warn(
            `aiProfile generation failed for ${company.name}: ${err?.message}`,
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
    const userPrompt = `Company: "${company.name}"

SEEDED RATINGS (per source):
${JSON.stringify(company.ratings ?? [])}

SEEDED REVIEWS (snippets):
${JSON.stringify(company.reviews ?? [])}

Return exactly this JSON object (no extra fields):
{
  "companySize": "<headcount band, e.g. Large (50,000+) or Mid-size (1,000–10,000)>",
  "basicInsurance": "<mediclaim/health insurance typical for this company type>",
  "otherBenefits": ["<max 3 benefits derived from review text or company reputation>"],
  "pros": ["<max 4 items — each must cite which review text or rating dimension drove it>"],
  "cons": ["<max 4 items — each must cite which review text or rating dimension drove it>"],
  "riskLevel": "<low|medium|high — low if jobSecurity > 4.0 across sources, high if < 3.2, else medium>",
  "riskFactors": ["<max 3 factors citing jobSecurity rating or specific review text>"],
  "benefitForRisk": "<one sentence weighing what the company offers against its risk level>"
}

RULES: Pros and cons must be grounded in the supplied reviews or ratings only. If a field cannot be determined, output "Not available in data". Output only the JSON object.`;

    const raw = await this.ai.call(PROFILE_SYSTEM_PROMPT, userPrompt);
    return this.validateProfileResponse(raw, company.name);
  }

  private validateProfileResponse(
    raw: object,
    companyName: string,
  ): Omit<AiProfile, 'generatedAt'> {
    const r = raw as AiProfileRaw;

    if (typeof r.companySize !== 'string' || !r.companySize) {
      throw new AiParseError(`Missing companySize for ${companyName}`);
    }
    if (typeof r.basicInsurance !== 'string' || !r.basicInsurance) {
      throw new AiParseError(`Missing basicInsurance for ${companyName}`);
    }
    if (!Array.isArray(r.otherBenefits) || r.otherBenefits.length > 3) {
      throw new AiParseError(`Invalid otherBenefits for ${companyName}`);
    }
    if (!Array.isArray(r.pros) || r.pros.length > 4) {
      throw new AiParseError(`Invalid pros for ${companyName}`);
    }
    if (!Array.isArray(r.cons) || r.cons.length > 4) {
      throw new AiParseError(`Invalid cons for ${companyName}`);
    }
    if (!['low', 'medium', 'high'].includes(r.riskLevel)) {
      throw new AiParseError(`Invalid riskLevel for ${companyName}`);
    }
    if (!Array.isArray(r.riskFactors) || r.riskFactors.length > 3) {
      throw new AiParseError(`Invalid riskFactors for ${companyName}`);
    }
    if (typeof r.benefitForRisk !== 'string' || !r.benefitForRisk) {
      throw new AiParseError(`Missing benefitForRisk for ${companyName}`);
    }

    return {
      companySize: r.companySize,
      basicInsurance: r.basicInsurance,
      otherBenefits: r.otherBenefits,
      pros: r.pros,
      cons: r.cons,
      riskLevel: r.riskLevel as 'low' | 'medium' | 'high',
      riskFactors: r.riskFactors,
      benefitForRisk: r.benefitForRisk,
    };
  }
}
