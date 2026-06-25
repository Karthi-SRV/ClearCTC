import {
  CompensationService,
  ExpenseBreakdownItem,
  OfferInput,
} from './compensation.service.js';

describe('CompensationService', () => {
  let svc: CompensationService;

  beforeEach(() => {
    svc = new CompensationService();
  });

  // ── computeTax ───────────────────────────────────────────────────────────────

  describe('computeTax', () => {
    it('₹9.75 L gross → ₹0 (taxable ₹9 L, rebate applies)', () => {
      expect(svc.computeTax(975_000)).toBe(0);
    });

    it('₹12.75 L gross → ₹0 (exact zero-tax gross threshold)', () => {
      expect(svc.computeTax(1_275_000)).toBe(0);
    });

    it('₹13 L gross → ₹66,300 (one step above rebate cliff)', () => {
      expect(svc.computeTax(1_300_000)).toBe(66_300);
    });

    it('₹21.75 L gross → ₹2,34,000 (proves 25% slab ₹20–24 L)', () => {
      expect(svc.computeTax(2_175_000)).toBe(234_000);
    });
  });

  // ── computeEmployeePF ────────────────────────────────────────────────────────

  describe('computeEmployeePF', () => {
    it('CTC ₹2.4 L → PF ₹14,400 (monthlyBasic ₹10k, below ceiling)', () => {
      expect(svc.computeEmployeePF(240_000)).toBe(14_400);
    });

    it('CTC ₹3.6 L → PF ₹21,600 (monthlyBasic ₹15k, at ceiling)', () => {
      expect(svc.computeEmployeePF(360_000)).toBe(21_600);
    });

    it('CTC ₹6 L → PF ₹21,600 (monthlyBasic ₹25k, capped)', () => {
      expect(svc.computeEmployeePF(600_000)).toBe(21_600);
    });
  });

  // ── computeGratuityAccrual ───────────────────────────────────────────────────

  describe('computeGratuityAccrual', () => {
    it('CTC ₹12 L, 1 year → ₹28,846', () => {
      expect(svc.computeGratuityAccrual(1_200_000, 1)).toBe(28_846);
    });

    it('CTC ₹12 L, 5 years → ₹1,44,231', () => {
      expect(svc.computeGratuityAccrual(1_200_000, 5)).toBe(144_231);
    });
  });

  // ── computeOfferSnapshot ─────────────────────────────────────────────────────

  // Shared fixtures
  const baseExpense: ExpenseBreakdownItem = {
    rent: 25_000, groceries: 8_000, utilities: 5_000, transport: 5_000,
    foodDining: 8_000, personalLifestyle: 5_000,
    miscellaneous: 9_000, total: 65_000,
  };

  const profileExpense: ExpenseBreakdownItem = {
    ...baseExpense, total: 50_000, rent: 20_000, miscellaneous: 7_000,
  };

  const targetExpense: ExpenseBreakdownItem = {
    ...baseExpense, total: 70_000, rent: 35_000,
  };

  function makeInput(overrides: Partial<OfferInput> = {}): OfferInput {
    return {
      companyName: 'Acme',
      totalCtcLpa: 20,
      variablePct: 0,
      variableGuaranteed: false,
      joiningBonusLpa: 0,
      employerPf: 'statutory',
      targetCity: 'Bangalore',
      isWfh: false,
      ...overrides,
    };
  }

  describe('Case 1 — pure fixed (variablePct=0, variableGuaranteed=false)', () => {
    it('variableAnnual is 0', () => {
      const snap = svc.computeOfferSnapshot(makeInput(), baseExpense, 100);
      expect(snap.variableAnnual).toBe(0);
    });

    it('effectiveCtcAnnual equals fixedPayAnnual', () => {
      const snap = svc.computeOfferSnapshot(makeInput(), baseExpense, 100);
      expect(snap.effectiveCtcAnnual).toBe(snap.fixedPayAnnual);
    });
  });

  describe('Case 2 — 20% variable, at-risk', () => {
    const input = makeInput({ variablePct: 20, variableGuaranteed: false });

    it('effectiveCtcAnnual equals fixedPayAnnual (variable excluded)', () => {
      const snap = svc.computeOfferSnapshot(input, baseExpense, 100);
      expect(snap.effectiveCtcAnnual).toBe(snap.fixedPayAnnual);
    });

    it('taxableIncome is based on fixedPayAnnual only', () => {
      const snap = svc.computeOfferSnapshot(input, baseExpense, 100);
      const expected = Math.max(snap.fixedPayAnnual - 75_000, 0);
      expect(snap.taxableIncome).toBe(expected);
    });
  });

  describe('Case 3 — 20% variable, guaranteed', () => {
    const input = makeInput({ variablePct: 20, variableGuaranteed: true });

    it('effectiveCtcAnnual equals fixedPayAnnual + variableAnnual', () => {
      const snap = svc.computeOfferSnapshot(input, baseExpense, 100);
      expect(snap.effectiveCtcAnnual).toBe(snap.fixedPayAnnual + snap.variableAnnual);
    });

    it('taxableIncome is based on full effective CTC', () => {
      const snap = svc.computeOfferSnapshot(input, baseExpense, 100);
      const expected = Math.max(snap.effectiveCtcAnnual - 75_000, 0);
      expect(snap.taxableIncome).toBe(expected);
    });

    it('guaranteed variant has higher inHand than at-risk', () => {
      const atRisk     = svc.computeOfferSnapshot(makeInput({ variablePct: 20, variableGuaranteed: false }), baseExpense, 100);
      const guaranteed = svc.computeOfferSnapshot(input, baseExpense, 100);
      expect(guaranteed.monthlyInHand).toBeGreaterThan(atRisk.monthlyInHand);
    });
  });

  describe('Case 4 — joining bonus present', () => {
    const input = makeInput({ joiningBonusLpa: 1 });  // ₹1L joining bonus

    it('joiningBonus excluded from basicAnnual derivation', () => {
      const withBonus    = svc.computeOfferSnapshot(input, baseExpense, 100);
      const withoutBonus = svc.computeOfferSnapshot(makeInput(), baseExpense, 100);
      // With joining bonus, basicAnnual must be lower because the bonus is excluded from the base
      expect(withBonus.basicAnnual).toBeLessThan(withoutBonus.basicAnnual);
    });

    it('joiningBonus excluded from effectiveCtcAnnual', () => {
      const snap = svc.computeOfferSnapshot(input, baseExpense, 100);
      // effectiveCtcAnnual = fixedPayAnnual (or + variable), never includes joiningBonus
      expect(snap.effectiveCtcAnnual).toBe(snap.fixedPayAnnual);
    });

    it('joiningBonus excluded from taxableIncome', () => {
      const snap = svc.computeOfferSnapshot(input, baseExpense, 100);
      const expected = Math.max(snap.effectiveCtcAnnual - 75_000, 0);
      expect(snap.taxableIncome).toBe(expected);
    });
  });

  describe('Case 5 — employerPf=none', () => {
    const noPf = makeInput({ employerPf: 'none' });
    const stat  = makeInput({ employerPf: 'statutory' });

    it('employerPfAnnual is 0', () => {
      const snap = svc.computeOfferSnapshot(noPf, baseExpense, 100);
      expect(snap.employerPfAnnual).toBe(0);
    });

    it('fixedPayAnnual is higher when employer PF is none (not deducted from CTC)', () => {
      const snapNone = svc.computeOfferSnapshot(noPf, baseExpense, 100);
      const snapStat = svc.computeOfferSnapshot(stat, baseExpense, 100);
      expect(snapNone.fixedPayAnnual).toBeGreaterThan(snapStat.fixedPayAnnual);
    });
  });

  describe('Case 6 — WFH=true uses profileCity expenses', () => {
    it('monthlyExpenses equals the profileCity breakdown total when isWfh=true', () => {
      const input = makeInput({ isWfh: true, targetCity: 'Mumbai' });
      // Caller must supply profileCity breakdown when isWfh=true
      const snap = svc.computeOfferSnapshot(input, profileExpense, 100);
      expect(snap.monthlyExpenses).toBe(profileExpense.total);
      expect(snap.monthlyExpenses).not.toBe(targetExpense.total);
    });

    it('isWfh is echoed on the snapshot', () => {
      const snap = svc.computeOfferSnapshot(makeInput({ isWfh: true }), profileExpense, 100);
      expect(snap.isWfh).toBe(true);
    });
  });

  describe('Case 7 — RECONCILIATION INVARIANT across all configurations', () => {
    const cases: Array<Partial<OfferInput>> = [
      {},                                                                  // Case 1
      { variablePct: 20, variableGuaranteed: false },                      // Case 2
      { variablePct: 20, variableGuaranteed: true },                       // Case 3
      { joiningBonusLpa: 1 },                                              // Case 4
      { employerPf: 'none' },                                              // Case 5
      { isWfh: true, targetCity: 'Mumbai' },                               // Case 6
    ];

    it.each(cases)('fixedPay + variable + empPF + gratuity + joiningBonus = totalCTC', (overrides) => {
      const input = makeInput(overrides);
      const snap  = svc.computeOfferSnapshot(input, baseExpense, 100);

      const sum =
        snap.fixedPayAnnual +
        snap.variableAnnual +
        snap.employerPfAnnual +
        snap.gratuityAccrualAnnual +
        snap.joiningBonusLpa * 100_000;

      const totalCtcAnnual = input.totalCtcLpa * 100_000;
      expect(Math.abs(sum - totalCtcAnnual)).toBeLessThanOrEqual(1);
    });
  });

  describe('Case 8 — determinism', () => {
    it('same input always produces identical output', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

      const input = makeInput({ variablePct: 20, variableGuaranteed: true, joiningBonusLpa: 0.5 });
      const a = svc.computeOfferSnapshot(input, baseExpense, 105);
      const b = svc.computeOfferSnapshot(input, baseExpense, 105);
      expect(a).toEqual(b);

      jest.useRealTimers();
    });
  });

  // ── computeSalaryRange ───────────────────────────────────────────────────────

  describe('computeSalaryRange', () => {
    const base = {
      benchmarkCTC: 1_500_000,
      experienceYears: 5,
      benchmarkExperienceMidpoint: 5,
      colIndexCurrent: 1.00,
      colIndexTarget: 1.00,
    };

    it.each([
      ['below midpoint', 2],
      ['at midpoint', 5],
      ['above midpoint', 8],
    ])('%s: conservative ≤ target ≤ stretch', (_label, years) => {
      const r = svc.computeSalaryRange({ ...base, experienceYears: years });
      expect(r.conservative).toBeLessThanOrEqual(r.target);
      expect(r.target).toBeLessThanOrEqual(r.stretch);
    });

    it('very low experience clamps premium at -0.3', () => {
      const r = svc.computeSalaryRange({ ...base, experienceYears: 0 });
      const expected = Math.round(base.benchmarkCTC * (1 - 0.3));
      expect(r.target).toBe(expected);
    });

    it('very high experience clamps premium at +0.5', () => {
      const r = svc.computeSalaryRange({ ...base, experienceYears: 100 });
      const expected = Math.round(base.benchmarkCTC * 1.5);
      expect(r.target).toBe(expected);
    });

    it('different colIndexCurrent and colIndexTarget applies COL delta', () => {
      const sameCity = svc.computeSalaryRange({ ...base });
      const diffCity = svc.computeSalaryRange({
        ...base,
        colIndexCurrent: 1.00,
        colIndexTarget: 1.15,
      });
      expect(diffCity.target).not.toBe(sameCity.target);
    });
  });

  // ── computeConfidence ────────────────────────────────────────────────────────

  describe('computeConfidence', () => {
    const allTrue = {
      companyInDataset: true,
      roleMatchedBenchmark: true,
      experienceInRange: true,
      dataAgeInDays: 0,
    };

    it('all true + age 0 → high, null reason', () => {
      const r = svc.computeConfidence(allTrue);
      expect(r.level).toBe('high');
      expect(r.reason).toBeNull();
    });

    it('company absent → low, reason non-empty', () => {
      const r = svc.computeConfidence({ ...allTrue, companyInDataset: false });
      expect(r.level).toBe('low');
      expect(r.reason).toBeTruthy();
    });

    it('role unmatched → medium, reason non-empty', () => {
      const r = svc.computeConfidence({ ...allTrue, roleMatchedBenchmark: false });
      expect(r.level).toBe('medium');
      expect(r.reason).toBeTruthy();
    });

    it('age 91 days → confidence downgraded vs age 0', () => {
      const fresh = svc.computeConfidence(allTrue);
      const stale = svc.computeConfidence({ ...allTrue, dataAgeInDays: 91 });
      expect(fresh.level).toBe('high');
      expect(stale.level).not.toBe('high');
    });
  });
});
