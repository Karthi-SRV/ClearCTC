import { MAX_RETRIES, RETRY_DELAYS_MS, retryDelay, sleep } from './ai-retry.util.js';

describe('sleep', () => {
  it('resolves after approximately the given delay', async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe('retryDelay', () => {
  it('returns the Retry-After header value in ms when present and positive', () => {
    expect(retryDelay(0, '30')).toBe(30_000);
    expect(retryDelay(1, '60')).toBe(60_000);
  });

  it('falls back to RETRY_DELAYS_MS when Retry-After is absent', () => {
    expect(retryDelay(0, null)).toBe(RETRY_DELAYS_MS[0]);
    expect(retryDelay(1, null)).toBe(RETRY_DELAYS_MS[1]);
    expect(retryDelay(2, null)).toBe(RETRY_DELAYS_MS[2]);
  });

  it('falls back to RETRY_DELAYS_MS when Retry-After is zero or invalid', () => {
    expect(retryDelay(0, '0')).toBe(RETRY_DELAYS_MS[0]);
    expect(retryDelay(0, 'abc')).toBe(RETRY_DELAYS_MS[0]);
  });

  it('falls back to 60_000 for out-of-range attempt index', () => {
    expect(retryDelay(99, null)).toBe(60_000);
  });
});

describe('constants', () => {
  it('MAX_RETRIES is 3', () => {
    expect(MAX_RETRIES).toBe(3);
  });

  it('RETRY_DELAYS_MS has 3 entries in ascending order', () => {
    expect(RETRY_DELAYS_MS).toHaveLength(3);
    expect(RETRY_DELAYS_MS[0]).toBeLessThan(RETRY_DELAYS_MS[1]!);
    expect(RETRY_DELAYS_MS[1]!).toBeLessThan(RETRY_DELAYS_MS[2]!);
  });
});
