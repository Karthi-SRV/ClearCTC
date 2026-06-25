import { CityExpenseCacheService } from './city-expense-cache.service.js';
import type { CityExpense } from '../../shared/schemas/city-expense.schema.js';

function makeDoc(city: string): CityExpense {
  const breakdown = {
    rent: 25_000, groceries: 8_000, utilities: 3_000, transport: 5_000,
    foodDining: 6_000, personalLifestyle: 4_000, miscellaneous: 3_000, total: 54_000,
  };
  return {
    city,
    individual: breakdown,
    family: breakdown,
    family3: breakdown,
    family4: breakdown,
    family5: breakdown,
    family6: breakdown,
    generatedBy: 'ai',
    generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    modelUsed: 'test',
    disclaimer: 'Test disclaimer',
  };
}

function makeCacheService() {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
  const svc = new CityExpenseCacheService(mockRedis as any);
  return { svc, mockRedis };
}

describe('CityExpenseCacheService.get', () => {
  it('returns null on miss', async () => {
    const { svc, mockRedis } = makeCacheService();
    mockRedis.get.mockResolvedValue(null);
    expect(await svc.get('Mumbai')).toBeNull();
  });

  it('returns parsed document with Date restored on hit', async () => {
    const { svc, mockRedis } = makeCacheService();
    const doc = makeDoc('Mumbai');
    mockRedis.get.mockResolvedValue(JSON.stringify(doc));
    const result = await svc.get('Mumbai');
    expect(result).not.toBeNull();
    expect(result!.city).toBe('Mumbai');
    expect(result!.generatedAt).toBeInstanceOf(Date);
  });

  it('uses compound lowercase key', async () => {
    const { svc, mockRedis } = makeCacheService();
    mockRedis.get.mockResolvedValue(null);
    await svc.get('Mumbai');
    expect(mockRedis.get).toHaveBeenCalledWith('city-expense:mumbai');
  });
});

describe('CityExpenseCacheService.set', () => {
  it('writes with 7-day TTL', async () => {
    const { svc, mockRedis } = makeCacheService();
    await svc.set('Chennai', makeDoc('Chennai'));
    expect(mockRedis.set).toHaveBeenCalledWith(
      'city-expense:chennai',
      expect.any(String),
      'EX',
      604_800,
    );
  });
});

describe('CityExpenseCacheService.del', () => {
  it('deletes the key', async () => {
    const { svc, mockRedis } = makeCacheService();
    await svc.del('Bangalore');
    expect(mockRedis.del).toHaveBeenCalledWith('city-expense:bangalore');
  });
});
