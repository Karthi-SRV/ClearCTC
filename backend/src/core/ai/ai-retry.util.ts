export const MAX_RETRIES = 3;
export const RETRY_DELAYS_MS: readonly number[] = [15_000, 30_000, 60_000];

export const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Returns the backoff delay for this attempt, honouring Retry-After when present. */
export function retryDelay(
  attempt: number,
  retryAfterHeader: string | null,
): number {
  const secs = parseInt(retryAfterHeader ?? '0', 10);
  return secs > 0 ? secs * 1_000 : (RETRY_DELAYS_MS[attempt] ?? 60_000);
}
