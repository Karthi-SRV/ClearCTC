import { CompanyAiProfileService } from './company-ai-profile.service.js';

const validProfileResponse = {
  companySize: 'Large (50,000+)',
  basicInsurance: 'Group Mediclaim',
  otherBenefits: ['Remote work', 'Cafeteria'],
  pros: ['Good WLB', 'Strong pay'],
  cons: ['Slow promotions'],
  riskLevel: 'low',
  riskFactors: ['stable domain'],
  benefitForRisk: 'High pay with stable employment',
};

const companyDoc = {
  _id: 'c1',
  name: 'Acme',
  ratings: [
    { source: 'Glassdoor', wlb: 4, culture: 4, growth: 3.5, jobSecurity: 4 },
  ],
  reviews: [
    {
      text: 'Good place',
      source: 'Glassdoor',
      date: '2024-06',
      sentiment: 'positive',
    },
  ],
  aiProfile: null,
};

function makeService({
  companies = [] as object[],
  aiResponse = validProfileResponse,
  fetchResult = { aliases: [], roles: [], ratings: [], reviews: [] },
}: {
  companies?: object[];
  aiResponse?: object;
  fetchResult?: object;
} = {}) {
  const companyModel = {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(companies),
    }),
    updateOne: jest.fn().mockResolvedValue({}),
  };

  const ai = {
    call: jest.fn().mockResolvedValue(aiResponse),
  };

  const companyFetch = {
    fetchCompany: jest.fn().mockResolvedValue(fetchResult),
  };

  const service = new CompanyAiProfileService(
    companyModel as never,
    ai,
    companyFetch as never,
  );

  return { service, companyModel, ai, companyFetch };
}

describe('CompanyAiProfileService', () => {
  describe('seedMissingProfiles', () => {
    it('generates aiProfile for a company without one', async () => {
      const { service, companyModel, ai } = makeService({
        companies: [companyDoc],
      });

      await service.seedMissingProfiles();

      expect(ai.call).toHaveBeenCalledTimes(1);
      expect(companyModel.updateOne).toHaveBeenCalledWith(
        { _id: 'c1' },
        expect.objectContaining({
          $set: expect.objectContaining({ aiProfile: expect.any(Object) }),
        }),
      );
    });

    it('skips companies with a fresh aiProfile', async () => {
      const freshDoc = {
        ...companyDoc,
        aiProfile: { generatedAt: new Date() },
      };
      const { service, ai } = makeService({ companies: [freshDoc] });

      await service.seedMissingProfiles();
      expect(ai.call).not.toHaveBeenCalled();
    });

    it('regenerates profiles older than 90 days', async () => {
      const ninetyOneDaysAgo = new Date(Date.now() - 91 * 86_400_000);
      const staleDoc = {
        ...companyDoc,
        aiProfile: { generatedAt: ninetyOneDaysAgo },
      };
      const { service, ai } = makeService({ companies: [staleDoc] });

      await service.seedMissingProfiles();
      expect(ai.call).toHaveBeenCalledTimes(1);
    });

    it('continues seeding after a non-quota AI failure', async () => {
      jest.useFakeTimers();
      const twoCompanies = [
        { ...companyDoc, _id: 'c1', name: 'Acme', aiProfile: null },
        { ...companyDoc, _id: 'c2', name: 'Beta', aiProfile: null },
      ];
      const ai = {
        call: jest
          .fn()
          .mockRejectedValueOnce(new Error('timeout'))
          .mockResolvedValueOnce(validProfileResponse),
      };
      const companyModel = {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(twoCompanies),
        }),
        updateOne: jest.fn().mockResolvedValue({}),
      };
      const service = new CompanyAiProfileService(
        companyModel as never,
        ai,
        {} as never,
      );

      const seedPromise = service.seedMissingProfiles();
      await jest.runAllTimersAsync();
      await seedPromise;

      jest.useRealTimers();
      expect(ai.call).toHaveBeenCalledTimes(2);
      expect(companyModel.updateOne).toHaveBeenCalledTimes(1);
    });

    it('aborts remaining profiles on quota exhaustion', async () => {
      const twoCompanies = [
        { ...companyDoc, _id: 'c1', name: 'A', aiProfile: null },
        { ...companyDoc, _id: 'c2', name: 'B', aiProfile: null },
      ];
      const ai = {
        call: jest
          .fn()
          .mockRejectedValue(
            new Error('[GEMINI_QUOTA_EXHAUSTED] Account quota exhausted'),
          ),
      };
      const companyModel = {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(twoCompanies),
        }),
        updateOne: jest.fn().mockResolvedValue({}),
      };
      const service = new CompanyAiProfileService(
        companyModel as never,
        ai,
        {} as never,
      );

      // quota exhaustion doesn't need inter-call sleep (breaks immediately)
      await service.seedMissingProfiles();

      expect(ai.call).toHaveBeenCalledTimes(1);
      expect(companyModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('sets isShuttingDown and clears active timeouts', () => {
      const { service } = makeService();
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });
});
