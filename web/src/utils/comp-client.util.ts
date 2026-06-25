// Mirrors backend CompensationService (FY 2025-26 new-regime).
// Update both when tax rules change.

const SLABS: Array<{ limit: number; rate: number }> = [
  { limit: 400_000,   rate: 0 },
  { limit: 800_000,   rate: 0.05 },
  { limit: 1_200_000, rate: 0.10 },
  { limit: 1_600_000, rate: 0.15 },
  { limit: 2_000_000, rate: 0.20 },
  { limit: 2_400_000, rate: 0.25 },
  { limit: Infinity,  rate: 0.30 },
];

const STANDARD_DEDUCTION = 75_000;
const REBATE_87A = 60_000;
const REBATE_THRESHOLD = 1_200_000;
const PF_CEILING_MONTHLY = 15_000;
const PF_RATE = 0.12;

function applyTaxSlabs(taxableIncome: number): number {
  let tax = 0;
  let prev = 0;
  for (const { limit, rate } of SLABS) {
    if (taxableIncome <= prev) break;
    tax += (Math.min(taxableIncome, limit) - prev) * rate;
    prev = limit;
  }
  if (taxableIncome <= REBATE_THRESHOLD) tax = Math.max(0, tax - REBATE_87A);
  return Math.round(tax * 1.04);
}

/** Annual income tax (new regime, FY 2025-26) for a given CTC in LPA. */
export function computeAnnualTax(annualCtcLpa: number): number {
  const annualCtc = annualCtcLpa * 100_000;
  const taxable   = Math.max(annualCtc - STANDARD_DEDUCTION, 0);
  return applyTaxSlabs(taxable);
}

export function computeMonthlyInHand(annualCtcLpa: number): number {
  const annualCtc    = annualCtcLpa * 100_000;
  const monthlyBasic = (annualCtc * 0.5) / 12;
  const annualPF     = Math.round(Math.min(monthlyBasic, PF_CEILING_MONTHLY) * PF_RATE * 12);
  const taxable      = Math.max(annualCtc - STANDARD_DEDUCTION, 0);
  const tax          = applyTaxSlabs(taxable);
  return Math.round((annualCtc - annualPF - tax) / 12);
}

export interface LivePreview {
  variableAnnual: number;
  fixedPayAnnual: number;
  effectiveCtcLpa: number;
  monthlyInHand: number;  // approximate
}

/**
 * Live preview for the offer comparison form — approximate, no expense data.
 * Mirrors the Phase 2 derivation chain steps 1–11 but skips Steps 5–7
 * employer contributions (they reduce fixedPay but not in-hand directly).
 * Label output as "approximate — full calculation after submit."
 */
export function computeOfferLivePreview(
  totalCtcLpa: number,
  variablePct: number,
  variableGuaranteed: boolean,
  joiningBonusLpa: number,
  employerPf: 'statutory' | 'none',
): LivePreview {
  const totalCtcAnnual     = totalCtcLpa * 100_000;
  const joiningBonusAnnual = joiningBonusLpa * 100_000;
  const variableAnnual     = Math.round(totalCtcAnnual * variablePct / 100);
  const basicAnnual        = Math.round((totalCtcAnnual - joiningBonusAnnual - variableAnnual) * 0.5);
  const basicMonthly       = Math.round(basicAnnual / 12);
  const empPfMonthly       = Math.round(Math.min(basicMonthly, PF_CEILING_MONTHLY) * PF_RATE);
  const empPfAnnual        = empPfMonthly * 12;
  const emplPfAnnual       = employerPf === 'statutory' ? empPfAnnual : 0;
  const gratuity           = Math.round((15 * basicMonthly) / 26);
  const fixedPayAnnual     = totalCtcAnnual - variableAnnual - emplPfAnnual - gratuity - joiningBonusAnnual;
  const effectiveCtcAnnual = variableGuaranteed ? fixedPayAnnual + variableAnnual : fixedPayAnnual;
  const taxable            = Math.max(effectiveCtcAnnual - STANDARD_DEDUCTION, 0);
  const tax                = applyTaxSlabs(taxable);
  const monthlyInHand      = Math.round((effectiveCtcAnnual - empPfAnnual - tax) / 12);

  return {
    variableAnnual,
    fixedPayAnnual,
    effectiveCtcLpa: Math.round(effectiveCtcAnnual / 10_000) / 10,
    monthlyInHand,
  };
}
