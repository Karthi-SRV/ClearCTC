# Skill: indian-payroll-math

## When to load this skill

Load whenever a task involves any of:
- Computing Indian income tax (new regime)
- Computing employee or employer PF contributions
- Computing gratuity accrual
- Deriving fixed pay, basic, HRA, or take-home from a CTC figure
- CTC breakdown, offer snapshot, salary range, COL adjustment
- Any mention of "take-home", "in-hand", "PF", "gratuity", "tax slab"

Do NOT load for old-regime tax, foreign compensation, ESOPs, or RSU valuation.

---

## Source of truth

All figures are verified for FY 2025-26 (AY 2026-27).
Budget 2026 proposed no changes — these figures also apply for FY 2026-27.

This skill is the SINGLE source of truth for all payroll math.
design.md and any other doc must REFERENCE this skill, not restate figures.
Restating figures in multiple places causes drift (it already happened once —
design.md had FY2024-25 slabs while this skill had FY2025-26).

---

## 1. New regime income tax — FY 2025-26

### Standard deduction
₹75,000 for salaried employees.
Applied exactly once, before computing taxable income.
Floor at zero — taxable income cannot go negative.

```typescript
function applyStandardDeduction(grossIncome: number): number {
  return Math.max(0, grossIncome - 75_000);
}
```

### Tax slabs (7-band progressive structure)

| Band | Taxable income | Rate |
|---|---|---|
| 1 | ₹0 – ₹4,00,000 | 0% |
| 2 | ₹4,00,001 – ₹8,00,000 | 5% |
| 3 | ₹8,00,001 – ₹12,00,000 | 10% |
| 4 | ₹12,00,001 – ₹16,00,000 | 15% |
| 5 | ₹16,00,001 – ₹20,00,000 | 20% |
| 6 | ₹20,00,001 – ₹24,00,000 | 25% |
| 7 | Above ₹24,00,000 | 30% |

**Common mistake:** FY2024-25 had 6 slabs starting at ₹3L with a 25% band absent.
FY2025-26 has 7 slabs starting at ₹4L. Using old slabs produces wrong results
for incomes above ₹12L — especially at ₹16L–₹24L where the 20%/25% bands exist.

Each rate applies only to income within that band — progressive, not flat.

### Section 87A rebate
₹60,000 rebate zeroing tax when taxable income ≤ ₹12,00,000.
Applied AFTER slab computation, BEFORE cess.
At exactly ₹12L taxable: slab tax = ₹60,000, rebate = ₹60,000, net = ₹0.

```typescript
if (taxableIncome <= 1_200_000) {
  tax = Math.max(0, tax - 60_000);
}
```

**Common mistake:** FY2024-25 rebate threshold was ₹7,00,000.
FY2025-26 threshold is ₹12,00,000. Using the old threshold produces wrong results
for incomes between ₹7L and ₹12L taxable — they should be zero, not non-zero.

### Effective zero-tax gross income boundary
₹12,75,000 gross (₹12,75,000 − ₹75,000 SD = ₹12,00,000 taxable → full rebate → ₹0 tax).
This is the "salaried zero-tax ceiling" — a useful sanity check.

### Health and education cess
4% on tax after rebate. Applied last.
```typescript
finalTax = Math.round(tax * 1.04);
```

### Complete implementation (zero external imports — enforced by boundary test)

```typescript
// core/compensation/tax-engine.ts
// ZERO non-type imports. Boundary test asserts this.

export function applyStandardDeduction(grossIncome: number): number {
  return Math.max(0, grossIncome - 75_000);
}

export function computeNewRegimeTax(taxableIncome: number): number {
  const slabs = [
    { limit: 400_000,   rate: 0    },
    { limit: 800_000,   rate: 0.05 },
    { limit: 1_200_000, rate: 0.10 },
    { limit: 1_600_000, rate: 0.15 },
    { limit: 2_000_000, rate: 0.20 },
    { limit: 2_400_000, rate: 0.25 },
    { limit: Infinity,  rate: 0.30 },
  ];
  let tax = 0; let prev = 0;
  for (const { limit, rate } of slabs) {
    if (taxableIncome <= prev) break;
    tax += (Math.min(taxableIncome, limit) - prev) * rate;
    prev = limit;
  }
  // 87A rebate — applied after slabs, before cess
  if (taxableIncome <= 1_200_000) tax = Math.max(0, tax - 60_000);
  // 4% health and education cess
  return Math.round(tax * 1.04);
}
```

### Boundary rule
`tax-engine.ts` must have ZERO non-type external imports. This is enforced by:
```typescript
// tax-engine.boundary.spec.ts
it('must have zero non-type external imports', () => {
  const src = fs.readFileSync(path.join(__dirname, 'tax-engine.ts'), 'utf-8');
  const imports = src.split('\n')
    .filter(l => l.startsWith('import') && !l.includes(' type '));
  expect(imports).toHaveLength(0);
});
```
If this test fails, someone added an external dependency to the tax engine. Fix immediately.

### Discriminating test fixtures
These FOUR fixtures must ALL pass. Any implementation with correct FY2025-26 slabs
passes all four. An implementation using FY2024-25 slabs fails fixtures 3 and 4.

| Gross income | Taxable (−₹75k SD) | Expected tax | What it proves |
|---|---|---|---|
| ₹9,75,000 | ₹9,00,000 | **₹0** | 87A threshold is ₹12L not ₹7L (FY2024-25 gives ₹41,600) |
| ₹12,75,000 | ₹12,00,000 | **₹0** | Exact zero-tax salaried boundary |
| ₹13,00,000 | ₹12,25,000 | **₹66,300** | Rebate cliff + 15% slab above ₹12L |
| ₹21,75,000 | ₹21,00,000 | **₹2,34,000** | 25% band (₹20–24L) exists only in FY2025-26 |

Worked verification for fixture 4 (₹21L taxable):
- Band 1: 0–4L → ₹0
- Band 2: 4–8L → ₹20,000
- Band 3: 8–12L → ₹40,000
- Band 4: 12–16L → ₹60,000
- Band 5: 16–20L → ₹80,000
- Band 6: 20–21L → ₹25,000 (1L × 25%)
- Sum: ₹2,25,000
- Cess 4%: ₹2,25,000 × 1.04 = **₹2,34,000** ✓

---

## 2. Employee PF (EPF)

### Formula
```typescript
const employeePfMonthly = Math.round(Math.min(basicMonthly, 15_000) * 0.12);
const employeePfAnnual  = employeePfMonthly * 12;
```

### The ₹15,000 rule — ceiling not floor
₹15,000/month is the **statutory wage ceiling** — it CAPS the PF contribution base.
- If basicMonthly > ₹15,000: PF is computed on ₹15,000 (capped down).
- If basicMonthly ≤ ₹15,000: PF is computed on actual basic (no adjustment).

**Critical mistake to never repeat:** flooring basic UP to ₹15,000 inflates PF for
low earners who don't owe it. A ₹2L CTC worker has ~₹8,333/month basic. Their
PF is 12% × ₹8,333 = ₹1,000/month — NOT 12% × ₹15,000 = ₹1,800/month.

### Test fixtures (three cases that bracket the ceiling)
| Basic/month | Employee PF/month | Proves |
|---|---|---|
| ₹10,000 | ₹1,200 | Below ceiling — actual basic used |
| ₹15,000 | ₹1,800 | At ceiling — exact 12% × ₹15,000 |
| ₹50,000 | ₹1,800 | Above ceiling — capped, not inflated |

### Employer PF
```typescript
const employerPfAnnual = payStructure.pfApplicable ? employeePfAnnual : 0;
```
Same formula as employee PF when `pfApplicable = true`.
`pfApplicable = false` is common in startups — employer contributes nothing.

### Statutory resolution
When employer PF input is the string `'statutory'`:
```
employerPfAnnual = 12% × ₹15,000/month × 12 = ₹21,600/year
```
The Phase 2 service resolves `'statutory'` before passing to CompensationService.
CompensationService always receives a concrete number — never the string.

---

## 3. Gratuity accrual

### Formula (N = years of service)
```typescript
const gratuityAccrualAnnual = Math.round((15 * basicMonthly * N) / 26);
```

For an offer snapshot, always use N = 1 (first-year annual accrual estimate).

### Test fixtures
| Basic/month | N | Result | Use |
|---|---|---|---|
| ₹40,000 | 1 | ₹23,077 | Annual offer snapshot estimate |
| ₹40,000 | 5 | ₹1,15,385 | Total 5-year payout |

### Key rules
- Statutory gratuity requires minimum 5 years of continuous service.
- Always label as **"first-year accrual estimate (vests at 5 yrs)"** in UI.
- Never present unvested gratuity as spendable income.
- Tax-exempt up to ₹20,00,000 at payout.

---

## 4. CTC derivation chain

Apply in this exact order. Any other order produces a wrong result.

```typescript
// Step 1 — decompose total CTC
const totalCtc         = totalCtcLpa * 100_000;
const joiningBonus     = joiningBonusLpa * 100_000;         // one-time; excluded from recurring math
const variableAnnual   = Math.round(totalCtc * variablePct / 100);
const fixedCtcBase     = totalCtc - variableAnnual - joiningBonus;

// Step 2 — basic and HRA (from company profile; see §5)
const basicAnnual      = Math.round(fixedCtcBase * basicPct / 100);  // basicPct from company profile
const basicMonthly     = Math.round(basicAnnual / 12);
const hraAnnual        = Math.round(basicAnnual * hraPct / 100);

// Step 3 — PF
const employeePfMonthly = Math.round(Math.min(basicMonthly, 15_000) * 0.12);
const employeePfAnnual  = employeePfMonthly * 12;
const employerPfAnnual  = pfApplicable ? employeePfAnnual : 0;

// Step 4 — gratuity
const gratuityAccrualAnnual = Math.round((15 * basicMonthly) / 26);  // N=1

// Step 5 — fixed pay (residual after removing all employer-side components)
const fixedPayAnnual   = totalCtc
                         - variableAnnual
                         - employerPfAnnual
                         - gratuityAccrualAnnual
                         - joiningBonus;

const specialAllowanceAnnual = fixedPayAnnual - basicAnnual - hraAnnual;

// Step 6 — effective CTC for tax (variable excluded if not guaranteed)
const effectiveCtcAnnual = variableGuaranteed
  ? fixedPayAnnual + variableAnnual
  : fixedPayAnnual;

// Step 7 — tax
const taxableIncome    = applyStandardDeduction(effectiveCtcAnnual);  // −₹75,000
const incomeTaxAnnual  = computeNewRegimeTax(taxableIncome);

// Step 8 — take-home
const monthlyInHand    = Math.round(
  (effectiveCtcAnnual - employeePfAnnual - incomeTaxAnnual) / 12
);
const annualInHand     = monthlyInHand * 12;
```

### Reconciliation invariant (must hold within ₹1)
```typescript
const sum = fixedPayAnnual + variableAnnual + employerPfAnnual
          + gratuityAccrualAnnual + joiningBonus;
Math.abs(sum - totalCtc) <= 1   // must be true
```
Write a test asserting this. If it fails, there is a derivation bug — do not ship.

---

## 5. basicPct — company-specific vs generic fallback

`basicPct` is NOT a universal constant. It varies by company type.

```typescript
// When company profile exists in DB → use company-specific basicPct
const basicPct = companyProfile !== null
  ? companyProfile.payStructure.basicPct    // e.g. 45 for Infosys, 40 for Razorpay
  : 40;                                      // generic fallback

// Always record which path was taken
const payStructureSource: 'company-profile' | 'generic-fallback' =
  companyProfile !== null ? 'company-profile' : 'generic-fallback';
```

Show a warning badge in the UI when `payStructureSource === 'generic-fallback'`:
"Pay structure is a generic estimate — company not in database. Actual in-hand may differ."

Valid range for `basicPct`: 30–60. Reject AI-generated company profiles where
`basicPct` is outside this range (throw `AiParseError`).

---

## 6. COL adjustment

### Formula
```typescript
// Chennai = 1.00 base (matches our seeded COL index)
const equivCtcForCity  = baseCTC * colIndex[targetCity] / colIndex[currentCity];
const colAdjustedInHand = annualInHand * colIndex[currentCity] / colIndex[targetCity];
```

### COL index reference (Chennai = 1.00 base — matches seeded data)
| City | COL index |
|---|---|
| Kolkata | 0.71 |
| **Chennai** | **1.00 (base)** |
| Hyderabad | 0.92 |
| Pune | 1.07 |
| Bangalore | 1.25 |
| Mumbai | 1.31 |

**Important:** these values must match what is in MongoDB and computed relative to the base city (Chennai = 1.00) based on family of 4 total expenses.

### When to apply
- `targetCity !== currentCity` AND neither is WFH → apply adjustment.
- `targetCity === currentCity` OR WFH → no adjustment; `colAdjustedAnnualInHand = null`.

### Show to user (AC-7.2)
Always display the COL index values used so the user can inspect the adjustment.
Never silently apply COL without showing what drove it.

---

## 7. Salary range (Phase 1 — before offer)

```typescript
const experiencePremium = clamp(
  (experienceYears / benchmarkExperienceMidpoint) - 1,
  -0.30,
  +0.50,
);

const target       = benchmarkCTC * (1 + experiencePremium);
const conservative = target * 0.88;
const stretch      = target * 1.18;

// COL delta when cities differ
if (targetCity !== currentCity && neither is WFH) {
  const colFactor = colIndex[targetCity] / colIndex[currentCity];
  // apply colFactor to all three figures
}
```

Invariant: `conservative ≤ target ≤ stretch` — structural from the multipliers.

**This skill must NOT generate benchmarks.** If no benchmark is supplied by the caller
(from seeded data), return "no benchmark — cannot compute range" and stop.

---

## 8. Confidence

```typescript
function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  let level: 'high' | 'medium' | 'low' = 'high';
  const reasons: string[] = [];

  if (!input.roleMatchedBenchmark) {
    level = worstOf(level, 'medium');
    reasons.push('role did not match a known benchmark');
  }
  if (!input.experienceInRange) {
    level = worstOf(level, 'medium');
    reasons.push('experience is outside the benchmark band');
  }
  if (!input.companyInDataset) {
    level = 'low';
    reasons.push('company not in dataset');
  }
  if (input.dataAgeInDays > 90) {
    level = worstOf(level, level === 'high' ? 'medium' : 'low');
    reasons.push(`benchmark data is ${input.dataAgeInDays} days old`);
  }

  return {
    level,
    reason: reasons.length > 0 ? reasons.join('; ') : null,
  };
}
```

**Authority rule:** `CompensationService.computeConfidence()` is the sole authority.
The AI receives this result as a context input and echoes it.
The AI must never independently assign or modify confidence on financial figures.

---

## 9. Common mistakes — history of errors caught in this project

| Mistake | Correct | When caught |
|---|---|---|
| FY2024-25 slabs (₹3L, 6 bands, ₹7L rebate) | FY2025-26: ₹4L, 7 bands, ₹12L rebate | Spec review pass 2 |
| 87A rebate threshold ₹7L | ₹12,00,000 | Spec review pass 2 |
| PF floor (basic floored UP to ₹15k) | PF ceiling — cap DOWN to ₹15k | Spec review pass 3 |
| `@IsInt()` only on employerPF DTO | Union validator: number OR 'statutory' | Audit resolution #2 |
| AI assigning confidence independently | CompModule owns confidence; AI echoes | Audit resolution #5 |
| Phase 1 signals typed as `string[]` | Typed discriminated union same as Phase 2 | Audit resolution #6 |
| `gratuity = (basic × 15) / 26` (N missing) | `(15 × basicMonthly × N) / 26` | Spec review pass 1 |
| Stale tax slabs in test fixtures (₹7L → ₹0) | ₹12.75L → ₹0 as zero-tax boundary | Spec review pass 3 |
| Bangalore=100 COL base (different from seed) | Chennai=1.00 base matches seeded data | Skill correction |

This history is here so the same mistakes are not repeated. When adding new computation,
check this table first.

---

## 10. What this skill must NOT do

- Generate or invent a benchmark CTC. Benchmarks come from the caller (seeded data).
- Compute old-regime tax (80C, HRA exemption, old slabs). New regime only.
- Value ESOPs, RSUs, or foreign-currency components.
- Present a final figure without showing intermediate values.
- Assign a confidence level without running `computeConfidence()`.
- Be consulted without loading — any payroll computation task loads this skill first.