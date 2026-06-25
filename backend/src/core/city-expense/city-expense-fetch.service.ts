import { Inject, Injectable } from '@nestjs/common';
import { CITY_EXPENSE_AI_CLIENT, COMPANY_AI_CLIENT } from '../ai/ai-client.interface.js';
import type { AiClient } from '../ai/ai-client.interface.js';
import { AiParseError } from '../ai/ai-parse.error.js';
import type { CityExpense, ExpenseBreakdown } from '../../shared/schemas/city-expense.schema.js';

const BREAKDOWN_FIELDS: Array<keyof ExpenseBreakdown> = [
  'rent', 'groceries', 'utilities', 'transport', 'foodDining',
  'personalLifestyle', 'miscellaneous',
];

const SYSTEM = `You are a cost-of-living research assistant for Indian cities. Return ONLY valid JSON — no markdown, no extra text.
The JSON must have exactly these keys: individual, family, family3, family4, family5, family6.
Each key's value must be an expense breakdown object with these integer fields (positive INR per month):
rent, groceries, utilities, transport, foodDining, personalLifestyle, miscellaneous, total.
For each breakdown, the total field MUST equal the exact arithmetic sum of all other fields.
Include a top-level non-empty disclaimer string.`;

@Injectable()
export class CityExpenseFetchService {
  constructor(@Inject(CITY_EXPENSE_AI_CLIENT) private readonly ai: AiClient) {}

  async fetchExpense(city: string): Promise<CityExpense> {
    const userPrompt = `Provide a realistic, data-driven monthly expense estimate in INR for a middle-class lifestyle specifically in ${city}, India. 

Because the cost of living varies heavily across Indian metros, do NOT use generic or static averages. Use your real-world knowledge of ${city}'s localized real estate market, typical middle-class neighborhoods, and local consumer pricing to generate these numbers.

Strictly adhere to these parameters:
1. Dynamic Real Estate: Estimate the "rent" field based entirely on current middle-class standards in ${city}. Specifically, assume the following accommodation sizes:
   - individual (1 member): 1BHK or shared accommodation
   - family (2 members): 1BHK
   - family3 (3 members): 1-2BHK
   - family4 (4 members): 1-2BHK
   - family5 (5 members): 2-3BHK
   - family6 (6 members): 2-3BHK
   Ensure the rent reflects these standards in standard residential areas of ${city}.
2. Natural Scaling: Ensure that all non-rent fields (groceries, utilities, transport, foodDining, personalLifestyle, miscellaneous) reflect the actual local costs of ${city} and scale up incrementally and logically with each added family member.
3. Strict Integers: Every single expense field must be a realistic, non-zero positive integer.
4. ABSOLUTE MATHEMATICAL CONSTRAINT: For every family size block, the "total" field MUST exactly equal the arithmetic sum of the other fields: rent + groceries + utilities + transport + foodDining + personalLifestyle + miscellaneous. Double-check the math before outputting.

Return ONLY the JSON structure matching the system template. Do not include markdown formatting or conversational text.`;

    const raw = await this.ai.call(SYSTEM, userPrompt) as Record<string, any>;

    if (!raw || typeof raw !== 'object') {
      throw new AiParseError(`Invalid AI response format: expected object, got ${typeof raw}`);
    }

    const breakdownKeys = ['individual', 'family', 'family3', 'family4', 'family5', 'family6'];

    for (const key of breakdownKeys) {
      const rawB = raw[key];
      if (!rawB || typeof rawB !== 'object') {
        throw new AiParseError(`Missing or invalid key '${key}' in AI response`);
      }

      for (const field of BREAKDOWN_FIELDS) {
        const v = rawB[field];
        if (v === undefined || v === null) {
          throw new AiParseError(`Missing field '${field}' under key '${key}' for ${city}`);
        }
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
          throw new AiParseError(`Invalid field '${field}' under key '${key}' for ${city}: ${JSON.stringify(v)}`);
        }
      }

      if (rawB.total !== undefined && (typeof rawB.total !== 'number' || !Number.isInteger(rawB.total) || rawB.total < 0)) {
        throw new AiParseError(`Invalid total under key '${key}' for ${city}: ${JSON.stringify(rawB.total)}`);
      }
    }

    const disclaimer =
      typeof raw.disclaimer === 'string' && raw.disclaimer.trim()
        ? raw.disclaimer.trim()
        : 'Expense estimates are illustrative. Actual costs vary by lifestyle, family size, and neighbourhood. Not financial advice.';

    const resultBreakdowns: any = {};
    for (const key of breakdownKeys) {
      const rawB = raw[key];
      const expectedTotal = BREAKDOWN_FIELDS.reduce((s, f) => s + (rawB[f] as number), 0);
      const resolvedTotal = rawB.total === expectedTotal ? (rawB.total as number) : expectedTotal;

      resultBreakdowns[key] = {
        rent: rawB.rent as number,
        groceries: rawB.groceries as number,
        utilities: rawB.utilities as number,
        transport: rawB.transport as number,
        foodDining: rawB.foodDining as number,
        personalLifestyle: rawB.personalLifestyle as number,
        miscellaneous: rawB.miscellaneous as number,
        total: resolvedTotal,
      };
    }

    return {
      city,
      individual: resultBreakdowns.individual,
      family: resultBreakdowns.family,
      family3: resultBreakdowns.family3,
      family4: resultBreakdowns.family4,
      family5: resultBreakdowns.family5,
      family6: resultBreakdowns.family6,
      generatedBy: 'ai',
      generatedAt: new Date(),
      modelUsed: 'ai-generated',
      disclaimer,
    };
  }
}
