import { NotFoundException } from '@nestjs/common';
import { SalaryComparisonService } from './salary-comparison.service.js';
import type { QuickSalaryComparisonDto } from './dtos/salary-comparison-request.dto.js';

const baseUser = {
  _id: 'u1',
  currentCity: 'Bangalore',
  currentCtcLpa: 20,
  basicPayLpa: 16,
  variablePayLpa: 4,
  isFixed: false,
  expectedHikePct: 20,
  currentRole: 'SDE2',
};

const baseOffer = {
  companyName: 'Acme',
  totalCtcLpa: 25,
  variablePct: 10,
  variableGuaranteed: false,
  joiningBonusLpa: 0,
  employerPf: 'statutory' as const,
  targetCity: 'Bangalore',
  isWfh: false,
};

const baseExpenseBreakdown = {
  rent: 20000,
  groceries: 5000,
  utilities: 2000,
  transport: 3000,
  foodDining: 4000,
  personalLifestyle: 3000,
  miscellaneous: 2000,
  total: 39000,
};

function makeService({
  user = baseUser,
  colIndex = 1.19,
  company = null as object | null,
}: {
  user?: object | null;
  colIndex?: number;
  company?: object | null;
} = {}) {
  const compMock = {
    computeOfferSnapshot: jest
      .fn()
      .mockImplementation((offer: typeof baseOffer) => ({
        companyName: offer.companyName,
        totalCtcLpa: offer.totalCtcLpa,
        variablePct: offer.variablePct,
        variableGuaranteed: offer.variableGuaranteed,
        joiningBonusLpa: offer.joiningBonusLpa,
        employerPf: offer.employerPf,
        targetCity: offer.targetCity,
        isWfh: offer.isWfh,
        monthlyInHand: 80000,
        annualInHand: 960000,
        monthlyExpenses: 39000,
        monthlySavings: 41000,
        annualSavings: 492000,
        basicMonthly: 16667,
        employeePfMonthly: 1800,
        employeePfAnnual: 21600,
        employerPfAnnual: 21600,
        gratuityAccrualAnnual: 9615,
        effectiveCtcAnnual: 2500000,
        taxableIncome: 2000000,
        incomeTaxAnnual: 100000,
        variableAnnual: 250000,
        fixedPayAnnual: 2250000,
        colIndexUsed: colIndex,
        expenseBreakdown: baseExpenseBreakdown,
      })),
  };

  const dataMock = {
    getCOLIndex: jest.fn().mockResolvedValue(colIndex),
    getCompany: jest.fn().mockResolvedValue(company),
  };

  const cityExpenseMock = {
    getExpenseBreakdown: jest.fn().mockResolvedValue({
      breakdown: baseExpenseBreakdown,
      confidence: 'high',
    }),
  };

  const userModelMock = {
    findById: jest.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(user) }),
    }),
  };

  const service = new SalaryComparisonService(
    compMock as never,
    dataMock as never,
    cityExpenseMock as never,
    userModelMock as never,
  );

  return { service, compMock, dataMock, cityExpenseMock, userModelMock };
}

const dto: QuickSalaryComparisonDto = {
  offers: [baseOffer, { ...baseOffer, companyName: 'Beta', totalCtcLpa: 30 }],
  familyType: 'family',
  memberCount: 4,
};

describe('SalaryComparisonService.execute', () => {
  it('returns response with snapshots and company details', async () => {
    const { service } = makeService();
    const result = await service.execute('user1', dto);

    expect(result.userId).toBe('user1');
    expect(result.offers).toHaveLength(2);
    expect(result.companyDetails).toHaveLength(2);
    expect(result.disclaimer).toBeDefined();
    expect(result.comparedAt).toBeDefined();
  });

  it('throws NotFoundException when user not found', async () => {
    const { service } = makeService({ user: null });
    await expect(service.execute('missing', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('uses currentCity as expenseCity when offer isWfh', async () => {
    const { service, cityExpenseMock } = makeService();
    const wfhDto: QuickSalaryComparisonDto = {
      offers: [{ ...baseOffer, isWfh: true, targetCity: 'Chennai' }],
      familyType: 'individual',
    };

    await service.execute('user1', wfhDto);
    expect(cityExpenseMock.getExpenseBreakdown).toHaveBeenCalledWith(
      'Bangalore',
      'individual',
      1,
    );
  });

  it('uses targetCity as expenseCity when not WFH', async () => {
    const { service, cityExpenseMock } = makeService();
    const officeDto: QuickSalaryComparisonDto = {
      offers: [{ ...baseOffer, isWfh: false, targetCity: 'Hyderabad' }],
    };

    await service.execute('user1', officeDto);
    expect(cityExpenseMock.getExpenseBreakdown).toHaveBeenCalledWith(
      'Hyderabad',
      'family',
      4,
    );
  });

  it('returns fallback company details when company not in DB', async () => {
    const { service } = makeService({ company: null });
    const result = await service.execute('user1', dto);

    expect(result.companyDetails[0].size).toBe('Not available in data');
    expect(result.companyDetails[0].reviews).toEqual([]);
  });

  it('maps company ratings and reviews when company exists in DB', async () => {
    const company = {
      name: 'Acme',
      ratings: [
        {
          source: 'Glassdoor',
          wlb: 4,
          culture: 4.5,
          growth: 3.5,
          jobSecurity: 4,
        },
      ],
      reviews: [
        { text: 'Great WLB', source: 'Glassdoor' },
        { text: 'Good pay', source: 'AmbitionBox' },
        { text: 'Extra review', source: 'LinkedIn' },
      ],
      aiProfile: {
        companySize: 'Large (50,000+)',
        basicInsurance: 'Group Mediclaim',
        otherBenefits: ['Remote'],
      },
    };
    const { service } = makeService({ company });
    const result = await service.execute('user1', {
      offers: [baseOffer],
      familyType: 'individual',
    });

    expect(result.companyDetails[0].employeeRating.overall).toBe(4);
    expect(result.companyDetails[0].reviews).toHaveLength(2);
    expect(result.companyDetails[0].size).toBe('Large (50,000+)');
  });

  it('defaults familyType to family and memberCount to 4', async () => {
    const { service, cityExpenseMock } = makeService();
    const minimalDto: QuickSalaryComparisonDto = { offers: [baseOffer] };

    await service.execute('user1', minimalDto);
    expect(cityExpenseMock.getExpenseBreakdown).toHaveBeenCalledWith(
      expect.any(String),
      'family',
      4,
    );
  });
});
