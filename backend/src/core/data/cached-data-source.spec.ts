import { CachedDataSource } from './cached-data-source.js';

// ── Mongoose model mock ──────────────────────────────────────────────────────

const SEED_COMPANY = {
  name: 'Infosys',
  aliases: ['infy', 'infosys limited'],
  roles: [
    {
      title: 'Software Engineer',
      avgCTC: 800_000,
      experienceMin: 1,
      experienceMax: 4,
    },
    {
      title: 'Senior Software Engineer',
      avgCTC: 1_400_000,
      experienceMin: 4,
      experienceMax: 8,
    },
  ],
  ratings: [
    {
      source: 'ambitionbox',
      wlb: 3.8,
      culture: 3.6,
      growth: 3.5,
      jobSecurity: 4.0,
    },
    {
      source: 'glassdoor',
      wlb: 3.2,
      culture: 3.5,
      growth: 3.3,
      jobSecurity: 3.8,
    },
  ],
  reviews: [],
  dataAsOf: new Date('2025-01-01'),
};

function makeMockModel(returnDoc: typeof SEED_COMPANY | null) {
  const exec = jest.fn().mockResolvedValue(returnDoc);
  const lean = jest.fn().mockReturnValue({ exec });
  const findOne = jest.fn().mockReturnValue({ lean: () => ({ exec }) });
  return { findOne } as any;
}

function makeMockCityExpenseModel(colIndex: number | null) {
  const returnDoc = colIndex !== null ? { colIndex } : null;
  const exec = jest.fn().mockResolvedValue(returnDoc);
  const lean = jest.fn().mockReturnValue({ exec });
  const select = jest.fn().mockReturnValue({ lean });
  const findOne = jest.fn().mockReturnValue({ select });
  return { findOne } as any;
}

// ── 2.6 getCOLIndex ──────────────────────────────────────────────────────────

describe('CachedDataSource.getCOLIndex', () => {
  it('"Bangalore" → 1.19', async () => {
    const ds = new CachedDataSource(
      makeMockModel(null),
      makeMockCityExpenseModel(1.19),
    );
    expect(await ds.getCOLIndex('Bangalore')).toBe(1.19);
  });

  it('"Mumbai" → 1.39', async () => {
    const ds = new CachedDataSource(
      makeMockModel(null),
      makeMockCityExpenseModel(1.39),
    );
    expect(await ds.getCOLIndex('Mumbai')).toBe(1.39);
  });

  it('unknown city → null', async () => {
    const ds = new CachedDataSource(
      makeMockModel(null),
      makeMockCityExpenseModel(null),
    );
    expect(await ds.getCOLIndex('Atlantis')).toBeNull();
  });

  it('"WFH" → null', async () => {
    const ds = new CachedDataSource(
      makeMockModel(null),
      makeMockCityExpenseModel(null),
    );
    expect(await ds.getCOLIndex('WFH')).toBeNull();
  });
});

// ── 2.8 getCompany ───────────────────────────────────────────────────────────

describe('CachedDataSource.getCompany', () => {
  it('exact name match returns record', async () => {
    const ds = new CachedDataSource(makeMockModel(SEED_COMPANY), {} as any);
    const result = await ds.getCompany('Infosys');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Infosys');
  });

  it('alias match returns same record', async () => {
    const ds = new CachedDataSource(makeMockModel(SEED_COMPANY), {} as any);
    const result = await ds.getCompany('infy');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Infosys');
  });

  it('unknown name returns null', async () => {
    const ds = new CachedDataSource(makeMockModel(null), {} as any);
    const result = await ds.getCompany('Unknown Corp');
    expect(result).toBeNull();
  });
});

// ── 2.10 getBenchmark ────────────────────────────────────────────────────────

describe('CachedDataSource.getBenchmark', () => {
  it('in-band match returns correct avgCTC and experienceMidpoint', async () => {
    const ds = new CachedDataSource(makeMockModel(SEED_COMPANY), {} as any);
    const result = await ds.getBenchmark('Infosys', 'Software Engineer', 3);
    expect(result).not.toBeNull();
    expect(result!.avgCTC).toBe(800_000);
    expect(result!.experienceMidpoint).toBe(2.5); // (1+4)/2
    expect(result!.source).toBe('seeded');
  });

  it('experience below all bands → null', async () => {
    const ds = new CachedDataSource(makeMockModel(SEED_COMPANY), {} as any);
    const result = await ds.getBenchmark('Infosys', 'Software Engineer', 0);
    expect(result).toBeNull();
  });

  it('experience above all bands → null', async () => {
    const ds = new CachedDataSource(makeMockModel(SEED_COMPANY), {} as any);
    const result = await ds.getBenchmark('Infosys', 'Software Engineer', 10);
    expect(result).toBeNull();
  });

  it('company not found → null', async () => {
    const ds = new CachedDataSource(makeMockModel(null), {} as any);
    const result = await ds.getBenchmark('Ghost Corp', 'SDE', 3);
    expect(result).toBeNull();
  });
});
