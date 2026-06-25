import { Inject, Injectable } from '@nestjs/common';
import { CompensationService } from '../../core/compensation/compensation.service.js';
import type { DataSource } from '../../core/data/data-source.interface.js';
import { DATA_SOURCE } from '../../core/data/data-source.interface.js';
import { CityExpenseService } from '../../core/city-expense/city-expense.service.js';
import type { FamilyType } from '../../shared/schemas/city-expense.schema.js';
import { SalaryAskRequestDto } from './dtos/salary-ask-request.dto.js';
import {
  CityComparisonDto,
  ExpenseBreakdownDto,
  SalaryAskResponseDto,
} from './dtos/salary-ask-response.dto.js';

const STANDARD_CITIES = [
  // Metro
  'Kolkata', 'Chennai', 'Hyderabad', 'Pune', 'Bangalore', 'Mumbai',
  'Delhi NCR', 'Noida', 'Gurgaon',
  // South
  'Coimbatore', 'Madurai', 'Kochi', 'Thiruvananthapuram', 'Mysore',
  'Mangalore', 'Visakhapatnam', 'Trichy',
  // West & Central
  'Ahmedabad', 'Surat', 'Vadodara', 'Nashik', 'Nagpur', 'Indore',
  // North
  'Jaipur', 'Lucknow', 'Chandigarh', 'Mohali', 'Amritsar', 'Ludhiana',
  'Dehradun',
  // East
  'Bhubaneswar', 'Patna', 'Ranchi', 'Guwahati',
];

const FRESH_THRESHOLD_MS = 30 * 24 * 3600 * 1000;
const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000;
const CHENNAI_COL_FALLBACK = 87;

// Fallback monthly totals (INR) represent a family-of-4 baseline.
// Used when CityExpenseService is unavailable.
const FALLBACK_EXPENSES_FAMILY4: Record<string, number> = {
  kolkata: 46_500, chennai: 58_000, hyderabad: 60_000, pune: 72_000,
  bangalore: 82_000, mumbai: 105_000, 'delhi ncr': 78_000,
  noida: 72_000, gurgaon: 76_000,
  coimbatore: 52_000, madurai: 48_000, kochi: 62_000,
  thiruvananthapuram: 56_000, mysore: 54_000, mangalore: 52_000,
  visakhapatnam: 54_000, trichy: 46_000,
  ahmedabad: 56_000, surat: 52_000, vadodara: 50_000,
  nashik: 52_000, nagpur: 52_000, indore: 50_000,
  jaipur: 52_000, lucknow: 50_000, chandigarh: 60_000,
  mohali: 58_000, amritsar: 50_000, ludhiana: 52_000, dehradun: 52_000,
  bhubaneswar: 52_000, patna: 48_000, ranchi: 46_000, guwahati: 48_000,
};

// Scale a family-4 base amount for other family sizes / individual
const FAMILY_SCALE: Record<number, number> = { 1: 0.40, 2: 0.60, 3: 0.78, 4: 1.00, 5: 1.18, 6: 1.33 };

function scaleFallback(base: number, familyType: FamilyType, memberCount: number): number {
  const effectiveMember = familyType === 'individual' ? 1 : memberCount;
  return Math.round(base * (FAMILY_SCALE[effectiveMember] ?? 1.00));
}

interface CachedResponse {
  data: SalaryAskResponseDto;
  expiresAt: number;
}

function assignBadge(
  equivCtcLpa: number,
  currentCtcLpa: number,
  city: string,
  currentCity: string,
): CityComparisonDto['badge'] {
  if (city.toLowerCase() === currentCity.toLowerCase()) return 'your-base';
  const ratio = equivCtcLpa / currentCtcLpa;
  if (ratio < 0.95) return 'cheaper';
  if (ratio <= 1.07) return 'similar';
  if (ratio <= 1.20) return 'moderate';
  if (ratio <= 1.35) return 'premium';
  return 'high-cost';
}

@Injectable()
export class SalaryAskService {
  private readonly responseCache = new Map<string, CachedResponse>();

  constructor(
    private readonly comp: CompensationService,
    @Inject(DATA_SOURCE) private readonly data: DataSource,
    private readonly cityExpense: CityExpenseService,
  ) {}

  getSupportedCities(): string[] {
    return [...STANDARD_CITIES].sort((a, b) => a.localeCompare(b));
  }

  private cacheKey(dto: SalaryAskRequestDto): string {
    const familyType = dto.familyType ?? 'family';
    const memberCount = familyType === 'individual' ? 1 : (dto.memberCount ?? 4);
    return `${dto.currentCity.trim().toLowerCase()}|${dto.currentCtcLpa}|${dto.expectedIncrementPct}|${familyType}|${memberCount}`;
  }

  async execute(dto: SalaryAskRequestDto): Promise<SalaryAskResponseDto> {
    const familyType: FamilyType = dto.familyType ?? 'family';
    const memberCount = familyType === 'individual' ? 1 : (dto.memberCount ?? 4);

    const key = this.cacheKey(dto);
    const hit = this.responseCache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.data;
    }

    const hikedCtcLpa =
      Math.round(dto.currentCtcLpa * (1 + dto.expectedIncrementPct / 100) * 10) / 10;

    const colPromises = await Promise.all([
      this.data.getCOLIndex(dto.currentCity),
      ...STANDARD_CITIES.map((c) => this.data.getCOLIndex(c)),
    ]);
    const [currentCityCol, ...stdColResults] = colPromises;

    const colIndices: Record<string, number> = {};
    STANDARD_CITIES.forEach((city, i) => {
      const idx = stdColResults[i];
      if (idx !== null) colIndices[city] = idx;
    });

    const currentCityFound = currentCityCol !== null;
    const baseColIdx = currentCityCol ?? CHENNAI_COL_FALLBACK;

    const expenseResults = await Promise.allSettled(
      STANDARD_CITIES.map((c) => this.cityExpense.getExpenseBreakdown(c, familyType, memberCount)),
    );

    const cityComparisons: CityComparisonDto[] = STANDARD_CITIES.map((city, i) => {
      const colIdx = colIndices[city] ?? baseColIdx;
      const equivCtcLpa = Math.round((dto.currentCtcLpa * colIdx) / baseColIdx * 10) / 10;
      const monthlyInHandDerived = this.comp.computeMonthlyInHandFromLpa(equivCtcLpa);

      const expRes = expenseResults[i];
      const expDoc = expRes.status === 'fulfilled' ? expRes.value : null;
      const fallbackBase = FALLBACK_EXPENSES_FAMILY4[city.toLowerCase()] ?? 60_000;
      const monthlyExpenses = expDoc?.breakdown.total ?? scaleFallback(fallbackBase, familyType, memberCount);

      const expenseBreakdown: ExpenseBreakdownDto | null = expDoc
        ? {
            rent: expDoc.breakdown.rent,
            groceries: expDoc.breakdown.groceries,
            utilities: expDoc.breakdown.utilities,
            transport: expDoc.breakdown.transport,
            foodDining: expDoc.breakdown.foodDining,
            personalLifestyle: expDoc.breakdown.personalLifestyle,
            miscellaneous: expDoc.breakdown.miscellaneous,
            total: expDoc.breakdown.total,
            disclaimer: expDoc.disclaimer,
            generatedAt: expDoc.generatedAt.toISOString(),
          }
        : null;

      return {
        city,
        badge: assignBadge(equivCtcLpa, dto.currentCtcLpa, city, dto.currentCity),
        colIndex: colIdx,
        equivCtcLpa,
        equivCtcRangeLow: Math.round(equivCtcLpa * 0.95 * 10) / 10,
        equivCtcRangeHigh: Math.round(equivCtcLpa * 1.05 * 10) / 10,
        monthlyInHand: monthlyInHandDerived,
        monthlyExpenses,
        monthlySavings: monthlyInHandDerived - monthlyExpenses,
        expenseBreakdown,
      };
    });

    const anyExpenseFailed = expenseResults.some((r) => r.status === 'rejected');
    const anyExpenseStale = expenseResults.some((r) => {
      if (r.status !== 'fulfilled') return false;
      return Date.now() - r.value.generatedAt.getTime() > FRESH_THRESHOLD_MS;
    });

    let confidence: 'high' | 'medium' | 'low';
    let confidenceReason: string | undefined;
    if (!currentCityFound) {
      confidence = 'low';
      confidenceReason = `${dto.currentCity} not found in COL index; using Chennai as baseline.`;
    } else if (anyExpenseFailed || anyExpenseStale) {
      confidence = 'medium';
      confidenceReason = anyExpenseFailed
        ? 'Some city expense data could not be fetched.'
        : 'Some city expense data may be outdated.';
    } else {
      confidence = 'high';
    }

    const firstFulfilled = expenseResults.find((r) => r.status === 'fulfilled');
    const expensesDisclaimer =
      firstFulfilled?.status === 'fulfilled'
        ? firstFulfilled.value.disclaimer
        : 'Expense estimates are illustrative. Not financial advice.';
    const expenseGeneratedAt =
      firstFulfilled?.status === 'fulfilled'
        ? firstFulfilled.value.generatedAt.toISOString()
        : new Date().toISOString();

    const result: SalaryAskResponseDto = {
      currentCity: dto.currentCity,
      currentCtcLpa: dto.currentCtcLpa,
      expectedIncrementPct: dto.expectedIncrementPct,
      familyType,
      memberCount,
      hikedCtcLpa,
      colIndices,
      cityComparisons,
      expensesDisclaimer,
      expenseGeneratedAt,
      confidence,
      confidenceReason,
      dataAsOf: new Date().toISOString().slice(0, 10),
    };

    this.responseCache.set(key, { data: result, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS });
    return result;
  }
}
