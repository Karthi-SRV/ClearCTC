import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AiClient } from '../ai/ai-client.interface.js';
import { COMPANY_AI_CLIENT } from '../ai/ai-client.interface.js';
import { AiParseError } from '../ai/ai-parse.error.js';

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

const SYSTEM = `You are a compensation research assistant for Indian tech companies.
Return ONLY valid JSON — no markdown, no extra text.
Data must reflect realistic Indian market conditions as of 2025.
All avgCTC values must be in INR (full number, not LPA shorthand).
All rating values must be floats between 1.0 and 5.0 with one decimal place.`;

const DIMENSIONS = ['wlb', 'culture', 'growth', 'jobSecurity', 'general'] as const;
const SENTIMENTS = ['positive', 'negative', 'mixed'] as const;

@Injectable()
export class CompanyFetchService {
  private readonly logger = new Logger(CompanyFetchService.name);

  constructor(@Inject(COMPANY_AI_CLIENT) private readonly ai: AiClient) {}

  async fetchCompany(name: string): Promise<CompanyFetchResult> {
    const userPrompt = `Provide realistic 2025 data for the Indian tech company "${name}".

Return exactly this JSON structure (no extra fields):
{
  "aliases": ["<common short names or alternate spellings, max 3>"],
  "roles": [
    {
      "title": "<standard engineering role title>",
      "avgCTC": <integer in INR — e.g. 1200000 for 12 LPA>,
      "experienceMin": <integer years>,
      "experienceMax": <integer years>
    }
  ],
  "ratings": [
    {
      "source": "ambitionbox",
      "wlb": <float 1.0-5.0>,
      "culture": <float 1.0-5.0>,
      "growth": <float 1.0-5.0>,
      "jobSecurity": <float 1.0-5.0>
    },
    {
      "source": "glassdoor",
      "wlb": <float 1.0-5.0>,
      "culture": <float 1.0-5.0>,
      "growth": <float 1.0-5.0>,
      "jobSecurity": <float 1.0-5.0>
    }
  ],
  "reviews": [
    {
      "text": "<realistic employee review snippet, 1-2 sentences>",
      "source": "<ambitionbox or glassdoor>",
      "date": "<YYYY-MM between 2024-01 and 2025-06>",
      "sentiment": "<positive, negative, or mixed>",
      "dimension": "<wlb, culture, growth, jobSecurity, or general>"
    }
  ]
}

RULES:
- Include exactly 3-4 role bands covering 0-15 years experience with no gaps or overlaps.
- avgCTC must be realistic for the company tier (IT services: 600000-3000000, Indian startups/unicorns: 1500000-10000000, FAANG/MNCs: 2500000-15000000, BFSI: 1500000-9000000).
- Ratings must reflect the company's known reputation in India — do not invent unrealistically high scores.
- Include exactly 2-3 review snippets grounded in the company's actual culture.
- Return only the JSON object.`;

    const raw = await this.ai.call(SYSTEM, userPrompt) as Record<string, unknown>;
    return this.validate(raw, name);
  }

  private validate(raw: Record<string, unknown>, name: string): CompanyFetchResult {
    // aliases
    if (!Array.isArray(raw.aliases)) {
      throw new AiParseError(`Missing aliases array for ${name}`);
    }

    // roles
    if (!Array.isArray(raw.roles) || raw.roles.length < 2 || raw.roles.length > 6) {
      throw new AiParseError(`Invalid roles array for ${name} (got ${Array.isArray(raw.roles) ? (raw.roles as unknown[]).length : 'none'})`);
    }
    for (const r of raw.roles as Record<string, unknown>[]) {
      if (typeof r.title !== 'string' || !r.title) {
        throw new AiParseError(`Invalid role title for ${name}`);
      }
      if (!Number.isFinite(r.avgCTC as number) || (r.avgCTC as number) < 100_000 || (r.avgCTC as number) > 100_000_000) {
        throw new AiParseError(`Invalid avgCTC for ${name}: ${r.avgCTC}`);
      }
      if (!Number.isInteger(r.experienceMin) || !Number.isInteger(r.experienceMax) || (r.experienceMin as number) >= (r.experienceMax as number)) {
        throw new AiParseError(`Invalid experience range for ${name}`);
      }
    }

    // ratings
    if (!Array.isArray(raw.ratings) || raw.ratings.length < 1) {
      throw new AiParseError(`Missing ratings for ${name}`);
    }
    for (const r of raw.ratings as Record<string, unknown>[]) {
      for (const dim of ['wlb', 'culture', 'growth', 'jobSecurity'] as const) {
        const v = r[dim] as number;
        if (!Number.isFinite(v) || v < 1 || v > 5) {
          throw new AiParseError(`Rating ${dim} out of range for ${name}: ${v}`);
        }
      }
    }

    // reviews
    if (!Array.isArray(raw.reviews) || raw.reviews.length < 1) {
      throw new AiParseError(`Missing reviews for ${name}`);
    }
    for (const rv of raw.reviews as Record<string, unknown>[]) {
      if (typeof rv.text !== 'string' || !rv.text) {
        throw new AiParseError(`Invalid review text for ${name}`);
      }
      if (!SENTIMENTS.includes(rv.sentiment as typeof SENTIMENTS[number])) {
        throw new AiParseError(`Invalid sentiment for ${name}: ${rv.sentiment}`);
      }
      if (!DIMENSIONS.includes(rv.dimension as typeof DIMENSIONS[number])) {
        throw new AiParseError(`Invalid dimension for ${name}: ${rv.dimension}`);
      }
      if (typeof rv.date !== 'string' || !/^\d{4}-\d{2}$/.test(rv.date as string)) {
        throw new AiParseError(`Invalid date for ${name}: ${rv.date}`);
      }
    }

    return {
      aliases: raw.aliases as string[],
      roles: raw.roles as CompanyFetchResult['roles'],
      ratings: raw.ratings as CompanyFetchResult['ratings'],
      reviews: raw.reviews as CompanyFetchResult['reviews'],
    };
  }
}
