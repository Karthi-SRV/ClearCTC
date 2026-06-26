import type { ExpenseBreakdownItem } from '../../../core/compensation/compensation.service.js';

export class QuickOfferSnapshotDto {
  // ── Echo inputs ──────────────────────────────────────────────────────
  companyName: string;
  totalCtcLpa: number;
  variablePct: number;
  variableGuaranteed: boolean;
  joiningBonusLpa: number;
  employerPf: 'statutory' | 'none';
  targetCity: string;
  isWfh: boolean;

  // ── Computed figures (no AI) ─────────────────────────────────────────
  basicMonthly: number;
  employeePfMonthly: number;
  employeePfAnnual: number;
  employerPfAnnual: number;
  gratuityAccrualAnnual: number;
  effectiveCtcAnnual: number;
  taxableIncome: number;
  incomeTaxAnnual: number;
  monthlyInHand: number;
  annualInHand: number;
  colIndexUsed: number;
  monthlyExpenses: number;
  monthlySavings: number;
  annualSavings: number;
  expenseBreakdown: ExpenseBreakdownItem;
}

export class EmployeeRatingDto {
  overall: number;
  wlb: number;
  culture: number;
  growth: number;
  jobSecurity: number;
  source: string;
}

export class CompanyReviewDto {
  snippet: string;
  source: string;
}

export class CompanyDetailsDto {
  companyName: string;
  size: string;
  basicInsurance: string;
  otherBenefits: string[];
  employeeRating: EmployeeRatingDto;
  reviews: CompanyReviewDto[];
}

export class QuickSalaryComparisonResponseDto {
  userId: string;
  comparedAt: string;
  offers: QuickOfferSnapshotDto[];
  companyDetails: CompanyDetailsDto[];
  disclaimer: string;
}
