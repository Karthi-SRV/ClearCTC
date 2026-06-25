import { NotFoundException } from '@nestjs/common';
import { AiParseError } from '../../core/ai/ai-parse.error.js';
import { OfferComparisonService } from './offer-comparison.service.js';
import type { CreateOfferComparisonDto } from '../../shared/dtos/offer-input.dto.js';

// ── Fixture helpers ──────────────────────────────────────────────────────────

const MOCK_EXPENSE = {
  breakdown: {
    rent: 25_000, groceries: 8_000, utilities: 5_000, transport: 5_000,
    foodDining: 8_000, personalLifestyle: 5_000, kidsEducation: 0,
    insurance: 2_000, miscellaneous: 2_000, total: 60_000,
  },
  generatedAt: new Date('2025-01-01'),
  city: 'Bangalore',
};

const MOCK_COMPANY = {
  name: 'Acme',
  ratings: [{ source: 'ambitionbox', wlb: 4.0, culture: 3.8, growth: 3.5, jobSecurity: 3.8 }],
  reviews: [{ text: 'Good WLB', source: 'ambitionbox', date: '2024-06', sentiment: 'positive', dimension: 'wlb' }],
  dataAsOf: new Date('2025-01-01'),
};

function validAiResponse(companyNames: string[]) {
  return {
    offers: companyNames.map((name, i) => ({
      companyName: name,
      companySize: '10,000+ employees',
      basicInsurance: '₹5L family',
      otherBenefits: ['WFH policy', 'Learning budget'],
      employeeRating: { overall: 4.0, wlb: 4.0, culture: 3.8, growth: 3.5, jobSecurity: 3.8, source: 'ambitionbox', disagreementFlag: null },
      pros: ['Good WLB (wlb: 4.0)', 'Stable company (jobSecurity: 3.8)'],
      cons: ['Lower growth (growth: 3.5)', 'Average culture (culture: 3.8)'],
      riskAssessment: { level: 'low', factors: ['Established company'], benefitForRisk: 'Savings adequate' },
      score: 70 + i * 5,
      scoreBreakdown: { financial: 28 + i * 2, qualitative: 30 + i, risk: 12 + i * 2 },
    })),
    recommendation: {
      bestOffer: companyNames[companyNames.length - 1],
      suggestion: 'Take the best offer.',
      whyBest: 'Highest score and savings.',
      whyNotOthers: Object.fromEntries(companyNames.slice(0, -1).map(n => [n, 'Lower score.'])),
      confidence: 'high',
      caveat: 'All offers are close — consider non-financial factors.',
    },
  };
}

function makeOffer(name: string, overrides = {}) {
  return {
    companyName: name,
    totalCtcLpa: 25,
    variablePct: 10,
    variableGuaranteed: true,
    joiningBonusLpa: 0,
    employerPf: 'statutory' as const,
    targetCity: 'Bangalore',
    isWfh: false,
    ...overrides,
  };
}

function makeService(overrides: Partial<{
  comp: any;
  data: any;
  cityExpenseService: any;
  userModel: any;
  ai: any;
  offersService: any;
}> = {}) {
  const comp = overrides.comp ?? {
    computeOfferSnapshot: jest.fn((input: any, breakdown: any, col: number) => ({
      companyName: input.companyName, totalCtcLpa: input.totalCtcLpa,
      variablePct: input.variablePct, variableGuaranteed: input.variableGuaranteed,
      joiningBonusLpa: input.joiningBonusLpa, employerPf: input.employerPf,
      targetCity: input.targetCity, isWfh: input.isWfh,
      variableAnnual: 250_000, fixedPayAnnual: 2_000_000, basicAnnual: 1_000_000,
      basicMonthly: 83_333, employeePfMonthly: 1_800, employeePfAnnual: 21_600,
      employerPfAnnual: 21_600, gratuityAccrualAnnual: 48_077,
      effectiveCtcAnnual: 2_250_000, taxableIncome: 2_175_000,
      incomeTaxAnnual: 234_000, monthlyInHand: 166_200, annualInHand: 1_994_400,
      colIndexUsed: col, monthlyExpenses: breakdown.total, monthlySavings: 106_200,
      annualSavings: 1_274_400, expenseBreakdown: breakdown,
      computedAt: '2025-01-01T00:00:00.000Z',
    })),
  };

  const data = overrides.data ?? {
    getCOLIndex: jest.fn().mockResolvedValue(100),
    getCompany: jest.fn().mockResolvedValue(MOCK_COMPANY),
    getBenchmark: jest.fn().mockResolvedValue(null),
  };

  const cityExpenseService = overrides.cityExpenseService ?? {
    getExpenseBreakdown: jest.fn().mockResolvedValue(MOCK_EXPENSE),
  };

  const userModel = overrides.userModel ?? {
    findById: jest.fn().mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve({ _id: 'user1', currentCity: 'Bangalore', currentCtcLpa: 20 }),
      }),
    }),
  };

  const ai = overrides.ai ?? {
    call: jest.fn(),
  };

  const offersService = overrides.offersService ?? {
    createMany: jest.fn().mockResolvedValue([]),
  };

  return new OfferComparisonService(comp, data, cityExpenseService, userModel as any, ai, offersService as any);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OfferComparisonService.validateAiResponse', () => {
  let svc: OfferComparisonService;

  beforeEach(() => { svc = makeService(); });

  it('passes a valid response through unchanged', () => {
    const raw = validAiResponse(['Acme', 'Beta']);
    expect(() => svc.validateAiResponse(raw, ['Acme', 'Beta'])).not.toThrow();
  });

  it('throws AiParseError when score is out of range (>100)', () => {
    const raw = validAiResponse(['Acme', 'Beta']);
    raw.offers[0].score = 101;
    raw.offers[0].scoreBreakdown = { financial: 40, qualitative: 40, risk: 21 };
    expect(() => svc.validateAiResponse(raw, ['Acme', 'Beta']))
      .toThrow(AiParseError);
  });

  it('throws AiParseError when scoreBreakdown sum does not equal score', () => {
    const raw = validAiResponse(['Acme', 'Beta']);
    raw.offers[0].scoreBreakdown = { financial: 10, qualitative: 10, risk: 10 }; // sum=30 ≠ 70
    expect(() => svc.validateAiResponse(raw, ['Acme', 'Beta']))
      .toThrow(AiParseError);
  });

  it('throws AiParseError when a scoreBreakdown component exceeds its bound', () => {
    const raw = validAiResponse(['Acme', 'Beta']);
    raw.offers[0].scoreBreakdown = { financial: 41, qualitative: 20, risk: 9 }; // financial > 40
    raw.offers[0].score = 70;
    expect(() => svc.validateAiResponse(raw, ['Acme', 'Beta']))
      .toThrow(AiParseError);
  });

  it('throws AiParseError when pros.length > 4', () => {
    const raw = validAiResponse(['Acme', 'Beta']);
    raw.offers[0].pros = ['a', 'b', 'c', 'd', 'e'];
    expect(() => svc.validateAiResponse(raw, ['Acme', 'Beta']))
      .toThrow(AiParseError);
  });

  it('throws AiParseError when cons.length > 4', () => {
    const raw = validAiResponse(['Acme', 'Beta']);
    raw.offers[0].cons = ['a', 'b', 'c', 'd', 'e'];
    expect(() => svc.validateAiResponse(raw, ['Acme', 'Beta']))
      .toThrow(AiParseError);
  });

  it('throws AiParseError for invalid riskAssessment.level', () => {
    const raw = validAiResponse(['Acme', 'Beta']);
    (raw.offers[0].riskAssessment as any).level = 'extreme';
    expect(() => svc.validateAiResponse(raw, ['Acme', 'Beta']))
      .toThrow(AiParseError);
  });

  it('throws AiParseError when bestOffer does not match any input', () => {
    const raw = validAiResponse(['Acme', 'Beta']);
    raw.recommendation.bestOffer = 'UnknownCorp';
    expect(() => svc.validateAiResponse(raw, ['Acme', 'Beta']))
      .toThrow(AiParseError);
  });

  it('throws AiParseError for invalid confidence value', () => {
    const raw = validAiResponse(['Acme', 'Beta']);
    (raw.recommendation as any).confidence = 'very-high';
    expect(() => svc.validateAiResponse(raw, ['Acme', 'Beta']))
      .toThrow(AiParseError);
  });
});

describe('OfferComparisonService.detectStale', () => {
  let svc: OfferComparisonService;

  beforeEach(() => { svc = makeService(); });

  function daysAgo(n: number) { return new Date(Date.now() - n * 86_400_000); }

  it('91 days ago → stale', () => { expect(svc.detectStale(daysAgo(91))).toBe(true); });
  it('89 days ago → not stale', () => { expect(svc.detectStale(daysAgo(89))).toBe(false); });
  it('today → not stale', () => { expect(svc.detectStale(new Date())).toBe(false); });
});

describe('OfferComparisonService.execute', () => {
  it('makes exactly ONE AI call regardless of offer count', async () => {
    const aiMock = { call: jest.fn().mockResolvedValue(validAiResponse(['Acme', 'Beta'])) };
    const svc = makeService({ ai: aiMock });

    const dto: CreateOfferComparisonDto = {
      offers: [makeOffer('Acme'), makeOffer('Beta')],
    };

    await svc.execute('user1', dto);
    expect(aiMock.call).toHaveBeenCalledTimes(1);
  });

  it('makes exactly one AI call for three offers too', async () => {
    const aiMock = { call: jest.fn().mockResolvedValue(validAiResponse(['A', 'B', 'C'])) };
    const svc = makeService({ ai: aiMock });

    const dto: CreateOfferComparisonDto = {
      offers: [makeOffer('A'), makeOffer('B'), makeOffer('C')],
    };

    await svc.execute('user1', dto);
    expect(aiMock.call).toHaveBeenCalledTimes(1);
  });

  it('computes all deterministic snapshots BEFORE the AI call', async () => {
    const order: string[] = [];
    const compMock = {
      computeOfferSnapshot: jest.fn((input: any, breakdown: any, col: number) => {
        order.push('deterministic');
        return {
          companyName: input.companyName, totalCtcLpa: input.totalCtcLpa,
          variablePct: input.variablePct, variableGuaranteed: input.variableGuaranteed,
          joiningBonusLpa: input.joiningBonusLpa, employerPf: input.employerPf,
          targetCity: input.targetCity, isWfh: input.isWfh,
          variableAnnual: 0, fixedPayAnnual: 2_000_000, basicAnnual: 1_000_000,
          basicMonthly: 83_333, employeePfMonthly: 1_800, employeePfAnnual: 21_600,
          employerPfAnnual: 21_600, gratuityAccrualAnnual: 48_077,
          effectiveCtcAnnual: 2_000_000, taxableIncome: 1_925_000,
          incomeTaxAnnual: 200_000, monthlyInHand: 148_200, annualInHand: 1_778_400,
          colIndexUsed: col, monthlyExpenses: breakdown.total, monthlySavings: 88_200,
          annualSavings: 1_058_400, expenseBreakdown: breakdown,
          computedAt: '2025-01-01T00:00:00.000Z',
        };
      }),
    };

    const aiMock = {
      call: jest.fn().mockImplementation(async () => {
        order.push('ai');
        return validAiResponse(['Acme', 'Beta']);
      }),
    };

    const svc = makeService({ comp: compMock, ai: aiMock });
    await svc.execute('user1', { offers: [makeOffer('Acme'), makeOffer('Beta')] });

    // Deterministic must precede AI
    const firstAi = order.indexOf('ai');
    const lastDet = order.lastIndexOf('deterministic');
    expect(lastDet).toBeLessThan(firstAi);
  });

  it('passes computed snapshots to AI prompt — not raw inputs', async () => {
    const aiMock = { call: jest.fn().mockResolvedValue(validAiResponse(['Acme', 'Beta'])) };
    const svc = makeService({ ai: aiMock });

    await svc.execute('user1', { offers: [makeOffer('Acme'), makeOffer('Beta')] });

    const promptArg: string = aiMock.call.mock.calls[0][1];
    // Snapshot fields (not raw DTO fields like totalCtcLpa as string)
    expect(promptArg).toContain('monthlyInHand');
    expect(promptArg).toContain('effectiveCtcAnnual');
    expect(promptArg).toContain('fixedPayAnnual');
  });

  it('throws NotFoundException when user is not found', async () => {
    const userModel = {
      findById: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) }),
    };
    const svc = makeService({ userModel });
    await expect(svc.execute('missing', { offers: [makeOffer('A'), makeOffer('B')] }))
      .rejects.toThrow(NotFoundException);
  });

  it('propagates AiParseError from validateAiResponse', async () => {
    const badResponse = validAiResponse(['Acme', 'Beta']);
    badResponse.offers[0].score = 200; // invalid
    const aiMock = { call: jest.fn().mockResolvedValue(badResponse) };
    const svc = makeService({ ai: aiMock });

    await expect(svc.execute('user1', { offers: [makeOffer('Acme'), makeOffer('Beta')] }))
      .rejects.toThrow(AiParseError);
  });
});
