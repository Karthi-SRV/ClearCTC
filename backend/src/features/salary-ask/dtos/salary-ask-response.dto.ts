export class ExpenseBreakdownDto {
  rent: number;
  groceries: number;
  utilities: number;
  transport: number;
  foodDining: number;
  personalLifestyle: number;
  miscellaneous: number;
  total: number;
  disclaimer: string;
  generatedAt: string;
}

export type BadgeType =
  | 'cheaper'
  | 'your-base'
  | 'similar'
  | 'moderate'
  | 'premium'
  | 'high-cost';

export class CityComparisonDto {
  city: string;
  badge: BadgeType;
  colIndex: number;
  equivCtcLpa: number;
  equivCtcRangeLow: number;
  equivCtcRangeHigh: number;
  monthlyInHand: number;
  monthlyExpenses: number;
  monthlySavings: number;
  expenseBreakdown: ExpenseBreakdownDto | null;
}

export class SalaryAskResponseDto {
  currentCity: string;
  currentCtcLpa: number;
  expectedIncrementPct: number;
  familyType: 'individual' | 'family';
  memberCount: number;
  hikedCtcLpa: number;
  colIndices: Record<string, number>;
  cityComparisons: CityComparisonDto[];
  expensesDisclaimer: string;
  expenseGeneratedAt: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceReason?: string;
  dataAsOf: string;
}
