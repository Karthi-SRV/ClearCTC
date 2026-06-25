import { CompanyFetchService } from './company-fetch.service.js';
import { AiParseError } from '../ai/ai-parse.error.js';

const validCompanyData = {
  aliases: ['Acme Corp'],
  roles: [{ title: 'SDE2', avgCTC: 2500000, experienceMin: 2, experienceMax: 5 }],
  ratings: [{ source: 'Glassdoor', wlb: 4, culture: 4.2, growth: 3.8, jobSecurity: 4.1 }],
  reviews: [{ text: 'Good WLB', source: 'Glassdoor', date: '2024-06', sentiment: 'positive', dimension: 'wlb' }],
};

function makeService(aiResponse: object | Error) {
  const ai = {
    call: jest.fn().mockImplementation(() =>
      aiResponse instanceof Error ? Promise.reject(aiResponse) : Promise.resolve(aiResponse),
    ),
  };
  return new CompanyFetchService(ai as never);
}

describe('CompanyFetchService.fetchCompany', () => {
  it('returns validated company data when AI response is valid', async () => {
    const service = makeService(validCompanyData);
    const result = await service.fetchCompany('Acme');

    expect(result.aliases).toEqual(['Acme Corp']);
    expect(result.roles).toHaveLength(1);
    expect(result.roles[0].title).toBe('SDE2');
    expect(result.ratings[0].source).toBe('Glassdoor');
  });

  it('throws AiParseError when AI response fails validation (missing roles)', async () => {
    const service = makeService({ aliases: [], roles: [], ratings: [], reviews: [] });
    await expect(service.fetchCompany('Acme')).rejects.toThrow(AiParseError);
  });

  it('throws AiParseError when AI response has invalid role avgCTC', async () => {
    const service = makeService({
      ...validCompanyData,
      roles: [{ title: 'SDE', avgCTC: 50, experienceMin: 0, experienceMax: 2 }],
    });
    await expect(service.fetchCompany('Acme')).rejects.toThrow(AiParseError);
  });

  it('propagates AiParseError from AI client', async () => {
    const service = makeService(new AiParseError('quota exhausted'));
    await expect(service.fetchCompany('Acme')).rejects.toThrow(AiParseError);
  });
});
