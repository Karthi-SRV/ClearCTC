import type { ExpenseBreakdownItem } from '../../../core/compensation/compensation.service.js';

export class ExpenseBreakdownDto implements ExpenseBreakdownItem {
  rent: number;
  groceries: number;
  utilities: number;
  transport: number;
  foodDining: number;
  personalLifestyle: number;
  miscellaneous: number;
  total: number;
}

export class EmployeeRatingDto {
  overall: number;
  wlb: number;
  culture: number;
  growth: number;
  jobSecurity: number;
  source: string;
  disagreementFlag: string | null;
}

export class RiskAssessmentDto {
  level: 'low' | 'medium' | 'high';
  factors: string[];
  benefitForRisk: string;
}

export class ScoreBreakdownDto {
  financial: number; // 0–40
  qualitative: number; // 0–40
  risk: number; // 0–20
}

export class OfferResultDto {
  // ── deterministic (from OfferSnapshot) ──────────────────────────────────
  companyName: string;
  totalCtcLpa: number;
  variablePct: number;
  variableGuaranteed: boolean;
  joiningBonusLpa: number;
  employerPf: 'statutory' | 'none';
  targetCity: string;
  isWfh: boolean;
  variableAnnual: number;
  fixedPayAnnual: number;
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
  expenseBreakdown: ExpenseBreakdownDto;

  // ── AI-reasoned (from Claude) ────────────────────────────────────────────
  companySize: string;
  basicInsurance: string;
  otherBenefits: string[];
  employeeRating: EmployeeRatingDto;
  pros: string[];
  cons: string[];
  riskAssessment: RiskAssessmentDto;
  score: number;
  scoreBreakdown: ScoreBreakdownDto;
}

export class RecommendationDto {
  bestOffer: string;
  suggestion: string;
  whyBest: string;
  whyNotOthers: Record<string, string>;
  confidence: 'high' | 'medium' | 'low';
  caveat: string;
}

export class OfferComparisonResponseDto {
  userId: string;
  comparedAt: string;
  offers: OfferResultDto[];
  recommendation: RecommendationDto;
  dataDisclaimer: string;
}
