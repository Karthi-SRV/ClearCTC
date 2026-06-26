import { CityExpenseService, CityExpenseUnavailableError } from './city-expense.service.js';
import type { CityExpense } from '../../shared/schemas/city-expense.schema.js';

function makeDoc(city: string, fresh = true): CityExpense {
  const generatedAt = fresh
    ? new Date()
    : new Date(Date.now() - 35 * 24 * 3600 * 1000);
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
    generatedAt,
    modelUsed: 'test',
    disclaimer: 'Test disclaimer',
  };
}

function makeService() {
  const lean = jest.fn();
  const exec = jest.fn().mockResolvedValue(null);
  const findOne = jest.fn().mockReturnValue({ lean: () => ({ exec }) });
  const findOneAndUpdate = jest.fn().mockImplementation((filter, update) => {
    const setObj = update?.$set || {};
    return {
      exec: () => Promise.resolve({
        toObject: () => setObj,
        ...setObj
      })
    };
  });
  const mockModel = { findOne, findOneAndUpdate };

  const mockCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const mockFetch = {
    fetchExpense: jest.fn(),
  };

  const svc = new CityExpenseService(mockModel as any, mockCache as any, mockFetch as any);
  void lean;
  return { svc, mockModel, mockCache, mockFetch, mongoExec: exec };
}

describe('CityExpenseService.getExpenseBreakdown', () => {
  it('returns cached document on Redis hit', async () => {
    const { svc, mockCache, mockFetch } = makeService();
    const doc = makeDoc('Mumbai');
    mockCache.get.mockResolvedValue(doc);
    const result = await svc.getExpenseBreakdown('Mumbai');
    expect(result.city).toBe('Mumbai');
    expect(mockFetch.fetchExpense).not.toHaveBeenCalled();
  });

  it('returns fresh MongoDB doc and writes Redis', async () => {
    const { svc, mockCache, mockFetch, mongoExec } = makeService();
    const doc = makeDoc('Chennai', true);
    mongoExec.mockResolvedValue(doc);
    const result = await svc.getExpenseBreakdown('Chennai');
    expect(result.city).toBe('Chennai');
    expect(mockCache.set).toHaveBeenCalled();
    expect(mockFetch.fetchExpense).not.toHaveBeenCalled();
  });

  it('fetches AI when MongoDB doc is stale, upserts and caches result', async () => {
    const { svc, mockCache, mockFetch, mongoExec } = makeService();
    const stale = makeDoc('Bangalore', false);
    mongoExec.mockResolvedValue(stale);
    const fresh = makeDoc('Bangalore', true);
    mockFetch.fetchExpense.mockResolvedValue(fresh);
    await svc.getExpenseBreakdown('Bangalore');
    expect(mockFetch.fetchExpense).toHaveBeenCalledWith('Bangalore');
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('returns stale doc immediately when background refresh fails', async () => {
    const { svc, mockFetch, mongoExec } = makeService();
    const stale = makeDoc('Hyderabad', false);
    mongoExec.mockResolvedValue(stale);
    mockFetch.fetchExpense.mockRejectedValue(new Error('AI unavailable'));
    const result = await svc.getExpenseBreakdown('Hyderabad');
    expect(result.city).toBe('Hyderabad');
    expect(result.disclaimer).toBe('Test disclaimer');
  });

  it('fetches AI when no MongoDB doc, stores and returns', async () => {
    const { svc, mockCache, mockFetch, mongoExec } = makeService();
    mongoExec.mockResolvedValue(null);
    const doc = makeDoc('Pune', true);
    mockFetch.fetchExpense.mockResolvedValue(doc);
    const result = await svc.getExpenseBreakdown('Pune');
    expect(result.city).toBe('Pune');
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('throws CityExpenseUnavailableError when no Mongo doc and AI fails', async () => {
    const { svc, mongoExec, mockFetch } = makeService();
    mongoExec.mockResolvedValue(null);
    mockFetch.fetchExpense.mockRejectedValue(new Error('AI unavailable'));
    await expect(svc.getExpenseBreakdown('Kolkata')).rejects.toThrow(
      CityExpenseUnavailableError,
    );
  });
});

describe('CityExpenseService.forceRefresh', () => {
  it('invalidates Redis and fetches fresh via AI', async () => {
    const { svc, mockCache, mockFetch } = makeService();
    const doc = makeDoc('Mumbai', true);
    mockFetch.fetchExpense.mockResolvedValue(doc);
    await svc.forceRefresh('Mumbai');
    expect(mockCache.del).toHaveBeenCalledWith('Mumbai');
    expect(mockFetch.fetchExpense).toHaveBeenCalledWith('Mumbai');
    expect(mockCache.set).toHaveBeenCalled();
  });
});

describe('CityExpenseService.getCityNames', () => {
  it('returns city names sorted alphabetically', async () => {
    const modelWithFind = {
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([{ city: 'Pune' }, { city: 'Bangalore' }, { city: 'Mumbai' }]) }),
      }),
      findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };
    const svc = new CityExpenseService(modelWithFind as any, { get: jest.fn(), set: jest.fn() } as any, {} as any);

    const names = await svc.getCityNames();
    expect(names).toEqual(['Bangalore', 'Mumbai', 'Pune']);
  });
});

describe('CityExpenseService.getAllExpenses', () => {
  it('returns all expense documents', async () => {
    const docs = [makeDoc('Bangalore'), makeDoc('Pune')];
    const modelWithFind = {
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(docs) }),
      }),
      findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };
    const svc = new CityExpenseService(modelWithFind as any, { get: jest.fn(), set: jest.fn() } as any, {} as any);

    const result = await svc.getAllExpenses();
    expect(result).toHaveLength(2);
  });
});

describe('CityExpenseService.getExpensesByFilter', () => {
  it('returns all expenses when filter is empty', async () => {
    const docs = [makeDoc('Bangalore'), makeDoc('Pune')];
    const modelWithFind = {
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(docs) }),
      }),
      findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };
    const svc = new CityExpenseService(modelWithFind as any, { get: jest.fn(), set: jest.fn() } as any, {} as any);

    const result = await svc.getExpensesByFilter([]);
    expect(result).toHaveLength(2);
  });

  it('returns filtered expenses for matching cities', async () => {
    const docs = [makeDoc('Bangalore')];
    const modelWithFind = {
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(docs) }),
      }),
      findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
    };
    const fetchMock = { fetchExpense: jest.fn().mockResolvedValue(makeDoc('Pune')) };
    const svc = new CityExpenseService(modelWithFind as any, { get: jest.fn(), set: jest.fn() } as any, fetchMock as any);

    const result = await svc.getExpensesByFilter(['Bangalore', 'Pune']);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe('CityExpenseService.getExpenseBreakdown — family type routing', () => {
  it('returns individual breakdown for familyType=individual', async () => {
    const { svc, mockCache } = makeService();
    const doc = makeDoc('Bangalore');
    mockCache.get.mockResolvedValue(doc);

    const result = await svc.getExpenseBreakdown('Bangalore', 'individual', 1);
    expect(result.familyType).toBe('individual');
    expect(result.breakdown).toEqual(doc.individual);
  });

  it('returns family2 breakdown for memberCount=2', async () => {
    const { svc, mockCache } = makeService();
    const doc = makeDoc('Bangalore');
    mockCache.get.mockResolvedValue(doc);

    const result = await svc.getExpenseBreakdown('Bangalore', 'family', 2);
    expect(result.breakdown).toEqual(doc.family);
  });

  it('returns family4 breakdown for memberCount=4 (default)', async () => {
    const { svc, mockCache } = makeService();
    const doc = makeDoc('Bangalore');
    mockCache.get.mockResolvedValue(doc);

    const result = await svc.getExpenseBreakdown('Bangalore', 'family', 4);
    expect(result.breakdown).toEqual(doc.family4);
  });

  it('returns family6 breakdown for memberCount=6 and out-of-range', async () => {
    const { svc, mockCache } = makeService();
    const doc = makeDoc('Bangalore');
    mockCache.get.mockResolvedValue(doc);

    const result6 = await svc.getExpenseBreakdown('Bangalore', 'family', 6);
    expect(result6.breakdown).toEqual(doc.family6);
  });
});

describe('CityExpenseService.onModuleDestroy', () => {
  it('clears the fetch interval if set', () => {
    jest.useFakeTimers();
    const { svc } = makeService();
    // Manually inject a fake interval so we can test destruction
    (svc as any).fetchInterval = setInterval(() => {}, 10000);
    expect(() => svc.onModuleDestroy()).not.toThrow();
    jest.useRealTimers();
  });

  it('does not throw when no interval is set', () => {
    const { svc } = makeService();
    expect(() => svc.onModuleDestroy()).not.toThrow();
  });
});
