import { Inject, Injectable } from '@nestjs/common';
import { CITY_EXPENSE_AI_CLIENT } from '../ai/ai-client.interface.js';
import type { AiClient } from '../ai/ai-client.interface.js';
import { AiParseError } from '../ai/ai-parse.error.js';
import type {
  CityExpense,
  ExpenseBreakdown,
} from '../../shared/schemas/city-expense.schema.js';
import {
  CITY_EXPENSE_SYSTEM_PROMPT,
  buildCityExpenseUserPrompt,
} from '../../shared/prompts/prompt-registry.js';

const BREAKDOWN_FIELDS: Array<keyof ExpenseBreakdown> = [
  'rent',
  'groceries',
  'utilities',
  'transport',
  'foodDining',
  'personalLifestyle',
  'miscellaneous',
];

@Injectable()
export class CityExpenseFetchService {
  constructor(@Inject(CITY_EXPENSE_AI_CLIENT) private readonly ai: AiClient) {}

  async fetchExpense(city: string): Promise<CityExpense> {
    const userPrompt = buildCityExpenseUserPrompt(city);

    const raw = (await this.ai.call(
      CITY_EXPENSE_SYSTEM_PROMPT,
      userPrompt,
    )) as Record<string, any>;

    if (!raw || typeof raw !== 'object') {
      throw new AiParseError(
        `Invalid AI response format: expected object, got ${typeof raw}`,
      );
    }

    const breakdownKeys = [
      'individual',
      'family',
      'family3',
      'family4',
      'family5',
      'family6',
    ];

    for (const key of breakdownKeys) {
      const rawB = raw[key];
      if (!rawB || typeof rawB !== 'object') {
        throw new AiParseError(
          `Missing or invalid key '${key}' in AI response`,
        );
      }

      for (const field of BREAKDOWN_FIELDS) {
        const v = rawB[field];
        if (v === undefined || v === null) {
          throw new AiParseError(
            `Missing field '${field}' under key '${key}' for ${city}`,
          );
        }
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
          throw new AiParseError(
            `Invalid field '${field}' under key '${key}' for ${city}: ${JSON.stringify(v)}`,
          );
        }
      }

      if (
        rawB.total !== undefined &&
        (typeof rawB.total !== 'number' ||
          !Number.isInteger(rawB.total) ||
          rawB.total < 0)
      ) {
        throw new AiParseError(
          `Invalid total under key '${key}' for ${city}: ${JSON.stringify(rawB.total)}`,
        );
      }
    }

    const disclaimer =
      typeof raw.disclaimer === 'string' && raw.disclaimer.trim()
        ? raw.disclaimer.trim()
        : 'Expense estimates are illustrative. Actual costs vary by lifestyle, family size, and neighbourhood. Not financial advice.';

    const resultBreakdowns: any = {};
    for (const key of breakdownKeys) {
      const rawB = raw[key];
      const expectedTotal = BREAKDOWN_FIELDS.reduce(
        (s, f) => s + (rawB[f] as number),
        0,
      );
      const resolvedTotal =
        rawB.total === expectedTotal ? (rawB.total as number) : expectedTotal;

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
