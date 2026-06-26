import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AiClient } from '../ai/ai-client.interface.js';
import { COMPANY_AI_CLIENT } from '../ai/ai-client.interface.js';
import { AiParseError } from '../ai/ai-parse.error.js';
import { CompanyFetchSchema } from '../../shared/schemas/ai-validation.schemas.js';
import {
  COMPANY_FETCH_SYSTEM_PROMPT,
  buildCompanyFetchUserPrompt,
} from '../../shared/prompts/prompt-registry.js';

export interface CompanyFetchResult {
  aliases: string[];
  roles: Array<{
    title: string;
    avgCTC: number;
    experienceMin: number;
    experienceMax: number;
  }>;
  ratings: Array<{
    source: string;
    wlb: number;
    culture: number;
    growth: number;
    jobSecurity: number;
  }>;
  reviews: Array<{
    text: string;
    source: string;
    date: string;
    sentiment: string;
    dimension: string;
  }>;
}

// Removed manual constants (SYSTEM, DIMENSIONS, SENTIMENTS) - migrated to prompt registry and Zod schema.

@Injectable()
export class CompanyFetchService {
  private readonly logger = new Logger(CompanyFetchService.name);

  constructor(@Inject(COMPANY_AI_CLIENT) private readonly ai: AiClient) {}

  async fetchCompany(name: string): Promise<CompanyFetchResult> {
    const userPrompt = buildCompanyFetchUserPrompt(name);

    const raw = (await this.ai.call(
      COMPANY_FETCH_SYSTEM_PROMPT,
      userPrompt,
    )) as Record<string, unknown>;
    return this.validate(raw, name);
  }

  private validate(
    raw: Record<string, unknown>,
    name: string,
  ): CompanyFetchResult {
    try {
      return CompanyFetchSchema.parse(raw);
    } catch (err: any) {
      throw new AiParseError(
        `Company data validation failed for ${name}: ${err.message ?? err}`,
      );
    }
  }
}
