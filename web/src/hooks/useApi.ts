import { useCallback, useEffect, useRef, useState } from 'react';
import { useErrors } from '../context/ErrorContext';

// ── Module-level cache shared across all hook instances ───────────────────
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/** How long a cached response is considered fresh (default: 5 minutes) */
const DEFAULT_TTL_MS = 5 * 60 * 1_000;

export interface UseApiOptions {
  /** Cache TTL in ms. Pass 0 to disable caching. Default: 5 minutes. */
  ttl?: number;
  /** Set to false to skip the fetch entirely (e.g. while waiting for a dependency). */
  enabled?: boolean;
  /**
   * If true (default), network/HTTP errors are also pushed to the global
   * ErrorContext so a toast appears. Set to false for silent background fetches.
   */
  silent?: boolean;
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Manually re-fetch, bypassing the cache. */
  refetch: () => void;
}

/**
 * Generic GET hook with in-memory request caching.
 *
 * @example
 * const { data, loading } = useApi<{ cities: string[] }>('/api/v1/salary-asks/cities');
 */
export function useApi<T>(url: string, options: UseApiOptions = {}): UseApiResult<T> {
  const { ttl = DEFAULT_TTL_MS, enabled = true, silent = false } = options;
  const { pushError } = useErrors();

  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0); // increment to trigger refetch

  // Track whether the component is still mounted to avoid state updates after unmount
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Check cache first (unless ttl=0)
    if (ttl > 0) {
      const entry = cache.get(url) as CacheEntry<T> | undefined;
      if (entry && Date.now() - entry.fetchedAt < ttl) {
        setData(entry.data);
        setError(null);
        return;
      }
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json() as T;
        
        if (cancelled) return;
        
        // Store in cache
        if (ttl > 0) {
          cache.set(url, { data: result, fetchedAt: Date.now() });
        }
        if (mounted.current) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        const message = (err as Error).message ?? 'Request failed';
        if (mounted.current) {
          setError(message);
          setLoading(false);
          if (!silent) {
            pushError(`Failed to load data: ${message}`, { severity: 'error' });
          }
        }
      }
    })();

    return () => { cancelled = true; };
  // tick is intentionally included so refetch() re-runs the effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, ttl, tick]);

  const refetch = useCallback(() => {
    // Bust cache for this URL then re-run
    cache.delete(url);
    setTick((n) => n + 1);
  }, [url]);

  return { data, loading, error, refetch };
}
