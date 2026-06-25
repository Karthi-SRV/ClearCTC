import { SalaryAskService } from './salary-ask.service.js';
import { SalaryAskRequestDto } from './dtos/salary-ask-request.dto.js';

const CITY_COL: Record<string, number> = {
  kolkata: 75, chennai: 87, hyderabad: 90, pune: 88, bangalore: 100, mumbai: 115,
};

// Returns the virtual breakdown object that CityExpenseService.getExpenseBreakdown resolves to
// (not the raw CityExpense document — the service wraps the doc before returning).
function makeExpenseDoc(city: string) {
  return {
    city,
    familyType: 'family' as const,
    memberCount: 4,
    breakdown: {
      rent: 30_000, groceries: 8_000, utilities: 3_000, transport: 5_000,
      foodDining: 6_000, personalLifestyle: 4_000, miscellaneous: 3_000, total: 59_000,
    },
    generatedBy: 'ai',
    generatedAt: new Date(),
    modelUsed: 'test',
    disclaimer: 'Test disclaimer',
  };
}

function makeService() {
  const mockComp = {
    computeMonthlyInHandFromLpa: jest.fn().mockImplementation(
      (lpa: number) => Math.round((lpa * 100_000) / 12),
    ),
  };
  const mockData = {
    getCOLIndex: jest.fn().mockImplementation(async (city: string) =>
      CITY_COL[city.toLowerCase()] ?? null,
    ),
  };
  const mockCityExpense = {
    getExpenseBreakdown: jest.fn().mockImplementation(async (city: string) =>
      makeExpenseDoc(city),
    ),
  };
  const svc = new SalaryAskService(
    mockComp as any,
    mockData as any,
    mockCityExpense as any,
  );
  return { svc, mockComp, mockData, mockCityExpense };
}

const BASE_DTO: SalaryAskRequestDto = {
  currentCity: 'Chennai',
  currentCtcLpa: 28,
  expectedIncrementPct: 30,
};

describe('SalaryAskService.execute — city response', () => {
  it('returns one comparison row per standard city (34 total)', async () => {
    const { svc } = makeService();
    const result = await svc.execute(BASE_DTO);
    expect(result.cityComparisons).toHaveLength(34);
  });

  it('hikedCtcLpa is deterministic (28 × 1.30 = 36.4)', async () => {
    const { svc } = makeService();
    const result = await svc.execute(BASE_DTO);
    expect(result.hikedCtcLpa).toBe(36.4);
  });

  it('colIndices contains only cities with a known COL value', async () => {
    const { svc } = makeService();
    const result = await svc.execute(BASE_DTO);
    // mock only provides COL for these 6; remaining 28 cities use the fallback index
    expect(Object.keys(result.colIndices).sort()).toEqual(
      ['Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Mumbai', 'Pune'],
    );
  });
});

describe('SalaryAskService.execute — badge assignment', () => {
  it('Chennai badge is your-base', async () => {
    const { svc } = makeService();
    const result = await svc.execute(BASE_DTO);
    const chennai = result.cityComparisons.find((c) => c.city === 'Chennai');
    expect(chennai?.badge).toBe('your-base');
  });

  it('Kolkata badge is cheaper (col 75, ratio 0.862 < 0.95)', async () => {
    const { svc } = makeService();
    const result = await svc.execute(BASE_DTO);
    const kolkata = result.cityComparisons.find((c) => c.city === 'Kolkata');
    expect(kolkata?.badge).toBe('cheaper');
  });

  it('Hyderabad badge is similar (ratio 1.034 ≤ 1.07)', async () => {
    const { svc } = makeService();
    const result = await svc.execute(BASE_DTO);
    const hyd = result.cityComparisons.find((c) => c.city === 'Hyderabad');
    expect(hyd?.badge).toBe('similar');
  });

  it('Mumbai badge is premium (col 115, ratio 1.322 ≤ 1.35)', async () => {
    const { svc } = makeService();
    const result = await svc.execute(BASE_DTO);
    const mumbai = result.cityComparisons.find((c) => c.city === 'Mumbai');
    expect(mumbai?.badge).toBe('premium');
  });
});

describe('SalaryAskService.execute — savings invariant', () => {
  it('monthlySavings === monthlyInHand − monthlyExpenses for every city', async () => {
    const { svc } = makeService();
    const result = await svc.execute(BASE_DTO);
    for (const c of result.cityComparisons) {
      expect(c.monthlySavings).toBe(c.monthlyInHand - c.monthlyExpenses);
    }
  });
});

describe('SalaryAskService.execute — confidence', () => {
  it('high when city known and all expenses fresh', async () => {
    const { svc } = makeService();
    expect((await svc.execute(BASE_DTO)).confidence).toBe('high');
  });

  it('low when currentCity not in COL index', async () => {
    const { svc } = makeService();
    const result = await svc.execute({ ...BASE_DTO, currentCity: 'Gurgaon' });
    expect(result.confidence).toBe('low');
    expect(result.confidenceReason).toMatch(/Gurgaon/);
  });

  it('medium when an expense fetch fails', async () => {
    const { svc, mockCityExpense } = makeService();
    let call = 0;
    mockCityExpense.getExpenseBreakdown.mockImplementation(async (city: string) => {
      call++;
      if (call === 2) throw new Error('AI unavailable');
      return makeExpenseDoc(city);
    });
    const result = await svc.execute(BASE_DTO);
    expect(result.confidence).toBe('medium');
  });
});

