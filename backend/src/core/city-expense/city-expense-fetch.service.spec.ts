import { CityExpenseFetchService } from './city-expense-fetch.service.js';
import { AiParseError } from '../ai/ai-parse.error.js';

const MOCK_BREAKDOWN = {
  rent: 25_000,
  groceries: 8_000,
  utilities: 3_000,
  transport: 5_000,
  foodDining: 6_000,
  personalLifestyle: 4_000,
  miscellaneous: 3_000,
  total: 54_000, // 25000+8000+3000+5000+6000+4000+3000 = 54000
};

const VALID_RESPONSE = {
  individual: { ...MOCK_BREAKDOWN },
  family: { ...MOCK_BREAKDOWN },
  family3: { ...MOCK_BREAKDOWN },
  family4: { ...MOCK_BREAKDOWN },
  family5: { ...MOCK_BREAKDOWN },
  family6: { ...MOCK_BREAKDOWN },
  disclaimer: 'Illustrative estimates for Bangalore.',
};

function makeFetchService() {
  const mockAi = { call: jest.fn() };
  const svc = new CityExpenseFetchService(mockAi);
  return { svc, mockAi };
}

describe('CityExpenseFetchService.fetchExpense', () => {
  it('returns valid CityExpense for a correct AI response', async () => {
    const { svc, mockAi } = makeFetchService();
    mockAi.call.mockResolvedValue(JSON.parse(JSON.stringify(VALID_RESPONSE)));
    const result = await svc.fetchExpense('Bangalore');
    expect(result.city).toBe('Bangalore');
    expect(result.individual!.total).toBe(54_000);
    expect(result.family4!.total).toBe(54_000);
    expect(result.generatedBy).toBe('ai');
    expect(result.generatedAt).toBeInstanceOf(Date);
    expect(result.disclaimer).toBeTruthy();
  });

  it('self-corrects total when AI arithmetic is off', async () => {
    const { svc, mockAi } = makeFetchService();
    const badArithmetic = JSON.parse(JSON.stringify(VALID_RESPONSE));
    badArithmetic.individual.total = 99_999;
    mockAi.call.mockResolvedValue(badArithmetic);
    const result = await svc.fetchExpense('Bangalore');
    expect(result.individual!.total).toBe(54_000); // corrected to sum of fields
  });

  it('throws AiParseError when a field is negative', async () => {
    const { svc, mockAi } = makeFetchService();
    const badVal = JSON.parse(JSON.stringify(VALID_RESPONSE));
    badVal.individual.rent = -1_000;
    mockAi.call.mockResolvedValue(badVal);
    await expect(svc.fetchExpense('Bangalore')).rejects.toThrow(AiParseError);
  });

  it('uses a default disclaimer when AI omits one', async () => {
    const { svc, mockAi } = makeFetchService();
    const badVal = JSON.parse(JSON.stringify(VALID_RESPONSE));
    badVal.disclaimer = '';
    mockAi.call.mockResolvedValue(badVal);
    const result = await svc.fetchExpense('Bangalore');
    expect(result.disclaimer).toBeTruthy();
    expect(result.disclaimer).toMatch(/illustrative/i);
  });

  it('throws AiParseError when a field is non-integer', async () => {
    const { svc, mockAi } = makeFetchService();
    const badVal = JSON.parse(JSON.stringify(VALID_RESPONSE));
    badVal.individual.rent = 25_000.5;
    mockAi.call.mockResolvedValue(badVal);
    await expect(svc.fetchExpense('Bangalore')).rejects.toThrow(AiParseError);
  });
});
