// ── Phase 1 ─────────────────────────────────────────────────────────────────

export interface ExpenseBreakdownDto {
  rent: number;
  groceries: number;
  utilities: number;
  transport: number;
  foodDining: number;
  personalLifestyle: number;
  kidsEducation: number;
  insurance: number;
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

export interface CityComparisonDto {
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

export interface Phase1Response {
  profileId: string;
  currentCity: string;
  currentCtcLpa: number;
  expectedIncrementPct: number;
  hikedCtcLpa: number;
  colIndices: Record<string, number>;
  cityComparisons: CityComparisonDto[];
  expensesDisclaimer: string;
  expenseGeneratedAt: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceReason?: string;
  dataAsOf: string;
}

// ── Phase 2 ─────────────────────────────────────────────────────────────────

export interface OfferExpenseBreakdown {
  rent: number;
  groceries: number;
  utilities: number;
  transport: number;
  foodDining: number;
  personalLifestyle: number;
  kidsEducation: number;
  insurance: number;
  miscellaneous: number;
  total: number;
}

export interface EmployeeRating {
  overall: number;
  wlb: number;
  culture: number;
  growth: number;
  jobSecurity: number;
  source: string;
  disagreementFlag: string | null;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  factors: string[];
  benefitForRisk: string;
}

export interface ScoreBreakdown {
  financial: number;   // 0–40
  qualitative: number; // 0–40
  risk: number;        // 0–20
}

export interface OfferResult {
  // ── deterministic ──────────────────────────────────────────────────────────
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
  expenseBreakdown: OfferExpenseBreakdown;

  // ── AI-reasoned ────────────────────────────────────────────────────────────
  companySize: string;
  basicInsurance: string;
  otherBenefits: string[];
  employeeRating: EmployeeRating;
  pros: string[];
  cons: string[];
  riskAssessment: RiskAssessment;
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface Recommendation {
  bestOffer: string;
  suggestion: string;
  whyBest: string;
  whyNotOthers: Record<string, string>;
  confidence: 'high' | 'medium' | 'low';
  caveat: string;
}

export interface Phase2Response {
  userId: string;
  comparedAt: string;
  offers: OfferResult[];
  recommendation: Recommendation;
  dataDisclaimer: string;
}

// ── Quick Salary Comparison ─────────────────────────────────────────────────

export interface SalaryComparisonOfferDto {
  companyName: string;
  totalCtcLpa: number;
  variablePct: number;
  variableGuaranteed: boolean;
  joiningBonusLpa: number;
  employerPf: 'statutory' | 'none';
  targetCity: string;
  isWfh: boolean;
}

export interface QuickOfferSnapshotDto {
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
  expenseBreakdown: OfferExpenseBreakdown;
}

export interface CompanyDetailsDto {
  companyName: string;
  size: string;
  basicInsurance: string;
  otherBenefits: string[];
  employeeRating: {
    overall: number;
    wlb: number;
    culture: number;
    growth: number;
    jobSecurity: number;
    source: string;
  };
  reviews: Array<{
    snippet: string;
    source: string;
  }>;
}

export interface QuickSalaryComparisonResponseDto {
  userId: string;
  comparedAt: string;
  offers: QuickOfferSnapshotDto[];
  companyDetails: CompanyDetailsDto[];
  disclaimer: string;
}
