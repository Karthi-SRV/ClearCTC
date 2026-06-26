import { Injectable } from '@nestjs/common';

// FY 2025-26 new-regime tax slabs
const SLABS = [
  { limit: 400_000, rate: 0 },
  { limit: 800_000, rate: 0.05 },
  { limit: 1_200_000, rate: 0.1 },
  { limit: 1_600_000, rate: 0.15 },
  { limit: 2_000_000, rate: 0.2 },
  { limit: 2_400_000, rate: 0.25 },
  { limit: Infinity, rate: 0.3 },
] as const;

const STANDARD_DEDUCTION = 75_000;
const REBATE_87A = 60_000;
const REBATE_THRESHOLD = 1_200_000;
const CESS_RATE = 0.04;
const PF_WAGE_CEILING_MONTHLY = 15_000;
const PF_EMPLOYEE_RATE = 0.12;

export interface ExpenseBreakdownItem {
  rent: number;
  groceries: number;
  utilities: number;
  transport: number;
  foodDining: number;
  personalLifestyle: number;
  miscellaneous: number;
  total: number;
}

export interface OfferInput {
  companyName: string;
  totalCtcLpa: number;
  variablePct: number;
  variableGuaranteed: boolean;
  joiningBonusLpa: number;
  employerPf: 'statutory' | 'none';
  targetCity: string;
  isWfh: boolean;
}

export interface OfferSnapshot {
  companyName: string;
  // inputs echoed
  totalCtcLpa: number;
  variablePct: number;
  variableGuaranteed: boolean;
  joiningBonusLpa: number;
  employerPf: 'statutory' | 'none';
  targetCity: string;
  isWfh: boolean;
  // derived
  variableAnnual: number;
  fixedPayAnnual: number;
  basicAnnual: number;
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
  computedAt: string;
}

export interface SalaryRangeInput {
  benchmarkCTC: number;
  experienceYears: number;
  benchmarkExperienceMidpoint: number;
  colIndexCurrent: number;
  colIndexTarget: number;
}

export interface SalaryRange {
  conservative: number;
  target: number;
  stretch: number;
}

export interface ConfidenceInput {
  companyInDataset: boolean;
  roleMatchedBenchmark: boolean;
  experienceInRange: boolean;
  dataAgeInDays: number;
}

export interface ConfidenceResult {
  level: 'high' | 'medium' | 'low';
  reason: string | null;
}

@Injectable()
export class CompensationService {
  // Apply slabs + 87A rebate + cess to already-deducted taxable income
  private applyTaxSlabs(taxableIncome: number): number {
    let tax = 0;
    let remaining = taxableIncome;
    let prevLimit = 0;

    for (const slab of SLABS) {
      const band = Math.min(remaining, slab.limit - prevLimit);
      if (band <= 0) break;
      tax += band * slab.rate;
      remaining -= band;
      prevLimit = slab.limit;
      if (remaining <= 0) break;
    }

    if (taxableIncome <= REBATE_THRESHOLD) {
      tax = Math.max(0, tax - REBATE_87A);
    }

    return Math.round(tax * (1 + CESS_RATE));
  }

  computeTax(annualGrossIncome: number): number {
    const taxableIncome = Math.max(0, annualGrossIncome - STANDARD_DEDUCTION);
    return this.applyTaxSlabs(taxableIncome);
  }

  computeEmployeePF(annualCTC: number): number {
    const monthlyBasic = (annualCTC * 0.5) / 12;
    const contributionBase = Math.min(monthlyBasic, PF_WAGE_CEILING_MONTHLY);
    return Math.round(PF_EMPLOYEE_RATE * contributionBase * 12);
  }

  computeGratuityAccrual(annualCTC: number, yearsOfService: number): number {
    const monthlyBasic = (annualCTC * 0.5) / 12;
    return Math.round((15 * monthlyBasic * yearsOfService) / 26);
  }

  /**
   * Deterministic Phase 2 derivation chain.
   *
   * Caller is responsible for fetching the correct expense breakdown
   * (profileCity when isWfh=true, targetCity otherwise) and the
   * appropriate COL index before calling this method.
   *
   * fixedPayAnnual is never entered by the user — it is the residual after
   * subtracting all other CTC components from totalCtcAnnual.
   *
   * Reconciliation invariant:
   *   fixedPayAnnual + variableAnnual + employerPfAnnual
   *   + gratuityAccrualAnnual + joiningBonusAnnual === totalCtcAnnual
   */
  computeOfferSnapshot(
    input: OfferInput,
    expenseBreakdown: ExpenseBreakdownItem,
    colIndexUsed: number,
  ): OfferSnapshot {
    // Step 1 — annual amounts from LPA inputs
    const totalCtcAnnual = input.totalCtcLpa * 100_000;
    const joiningBonusAnnual = input.joiningBonusLpa * 100_000;

    // Step 2 — variable
    const variableAnnual = Math.round(
      (totalCtcAnnual * input.variablePct) / 100,
    );

    // Step 3 — basic
    // Basic = 50% of (totalCTC − joiningBonus − variable)
    const basicAnnual = Math.round(
      (totalCtcAnnual - joiningBonusAnnual - variableAnnual) * 0.5,
    );
    const basicMonthly = Math.round(basicAnnual / 12);

    // Step 4 — employee PF
    const employeePfMonthly = Math.round(
      Math.min(basicMonthly, PF_WAGE_CEILING_MONTHLY) * PF_EMPLOYEE_RATE,
    );
    const employeePfAnnual = employeePfMonthly * 12;

    // Step 5 — employer PF
    const employerPfAnnual =
      input.employerPf === 'statutory' ? employeePfAnnual : 0;

    // Step 6 — gratuity accrual (first-year estimate: 15 × basicMonthly / 26)
    const gratuityAccrualAnnual = Math.round((15 * basicMonthly) / 26);

    // Step 7 — fixed pay (derived residual — never entered by user)
    const fixedPayAnnual =
      totalCtcAnnual -
      variableAnnual -
      employerPfAnnual -
      gratuityAccrualAnnual -
      joiningBonusAnnual;

    // Step 8 — effective CTC
    const effectiveCtcAnnual = input.variableGuaranteed
      ? fixedPayAnnual + variableAnnual
      : fixedPayAnnual;

    // Step 9 — taxable income (standard deduction applied exactly once)
    const taxableIncome = Math.max(effectiveCtcAnnual - STANDARD_DEDUCTION, 0);

    // Step 10 — income tax (new regime slabs + 87A rebate + 4% cess)
    const incomeTaxAnnual = this.applyTaxSlabs(taxableIncome);

    // Step 11 — monthly in-hand
    const monthlyInHand = Math.round(
      (effectiveCtcAnnual - employeePfAnnual - incomeTaxAnnual) / 12,
    );
    const annualInHand = monthlyInHand * 12;

    // Step 12 — city expenses and savings
    const monthlyExpenses = expenseBreakdown.total;
    const monthlySavings = monthlyInHand - monthlyExpenses;
    const annualSavings = monthlySavings * 12;

    return {
      companyName: input.companyName,
      totalCtcLpa: input.totalCtcLpa,
      variablePct: input.variablePct,
      variableGuaranteed: input.variableGuaranteed,
      joiningBonusLpa: input.joiningBonusLpa,
      employerPf: input.employerPf,
      targetCity: input.targetCity,
      isWfh: input.isWfh,
      variableAnnual,
      fixedPayAnnual,
      basicAnnual,
      basicMonthly,
      employeePfMonthly,
      employeePfAnnual,
      employerPfAnnual,
      gratuityAccrualAnnual,
      effectiveCtcAnnual,
      taxableIncome,
      incomeTaxAnnual,
      monthlyInHand,
      annualInHand,
      colIndexUsed,
      monthlyExpenses,
      monthlySavings,
      annualSavings,
      expenseBreakdown,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Quick monthly in-hand estimate for Phase 1 city comparison.
   * Assumes pure-fixed CTC, statutory PF, no variable/joining bonus.
   * Phase 2 uses computeOfferSnapshot for the full derivation.
   */
  computeMonthlyInHandFromLpa(totalCtcLpa: number): number {
    const totalCtcAnnual = totalCtcLpa * 100_000;
    const basicMonthly = Math.round((totalCtcAnnual * 0.5) / 12);
    const employeePfMonthly = Math.round(
      Math.min(basicMonthly, PF_WAGE_CEILING_MONTHLY) * PF_EMPLOYEE_RATE,
    );
    const employeePfAnnual = employeePfMonthly * 12;
    const employerPfAnnual = employeePfAnnual; // statutory
    const gratuityAccrualAnnual = Math.round((15 * basicMonthly) / 26);
    const fixedPayAnnual =
      totalCtcAnnual - employerPfAnnual - gratuityAccrualAnnual;
    const taxableIncome = Math.max(fixedPayAnnual - STANDARD_DEDUCTION, 0);
    const tax = this.applyTaxSlabs(taxableIncome);
    return Math.round((fixedPayAnnual - employeePfAnnual - tax) / 12);
  }

  computeSalaryRange(input: SalaryRangeInput): SalaryRange {
    const rawPremium =
      input.experienceYears / input.benchmarkExperienceMidpoint - 1;
    const experiencePremium = Math.min(0.5, Math.max(-0.3, rawPremium));

    let target = input.benchmarkCTC * (1 + experiencePremium);

    if (input.colIndexCurrent !== input.colIndexTarget) {
      target = target * (input.colIndexTarget / input.colIndexCurrent);
    }

    const conservative = Math.round(target * 0.88);
    const stretch = Math.round(target * 1.18);
    target = Math.round(target);

    return { conservative, target, stretch };
  }

  computeConfidence(input: ConfidenceInput): ConfidenceResult {
    const STALE_DAYS = 90;

    if (!input.companyInDataset) {
      return { level: 'low', reason: 'Target company is not in the dataset' };
    }

    if (!input.roleMatchedBenchmark) {
      return {
        level: 'medium',
        reason: 'Role did not match a known benchmark',
      };
    }

    if (!input.experienceInRange) {
      return {
        level: 'medium',
        reason: 'Experience is outside the benchmark band',
      };
    }

    if (input.dataAgeInDays > STALE_DAYS) {
      return {
        level: 'medium',
        reason: `Company data is ${input.dataAgeInDays} days old (threshold: ${STALE_DAYS} days)`,
      };
    }

    return { level: 'high', reason: null };
  }
}
