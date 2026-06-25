/**
 * CitiesContext — fetches /api/v1/cities once on mount and makes the list
 * available to the entire app. Consumers use `useCities()` instead of
 * calling the API themselves — no duplicate requests, no stale hooks.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { CITIES } from '../constants/api';
import { useApiFetch } from '../hooks/useApiFetch';

interface CitiesContextValue {
  cities: string[];
  loading: boolean;
  error: string | null;
}

const CitiesContext = createContext<CitiesContextValue>({
  cities: [],
  loading: false,
  error: null,
});

// Module-level singleton so even if the provider re-renders we never
// issue more than one network request per page lifetime.
let _promise: Promise<string[]> | null = null;
let _cache: string[] | null = null;

async function fetchCities(apiFetch: ReturnType<typeof useApiFetch>): Promise<string[]> {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = (async () => {
      try {
        const r = await apiFetch(CITIES);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json() as { cities: string[] };
        _cache = d.cities;
        return d.cities;
      } catch (err) {
        _promise = null; // allow retry on next mount
        throw err;
      }
    })();
  }
  return _promise;
}

export function CitiesProvider({ children }: { children: React.ReactNode }) {
  const [cities, setCities]   = useState<string[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError]     = useState<string | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    if (_cache) return; // already have data
    setLoading(true);
    
    (async () => {
      try {
        const c = await fetchCities(apiFetch);
        setCities(c);
        setLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    })();
  }, [apiFetch]);

  const value = useMemo(
    () => ({ cities, loading, error }),
    [cities, loading, error],
  );

  return (
    <CitiesContext.Provider value={value}>{children}</CitiesContext.Provider>
  );
}

/** Use this in any component that needs the city list. */
export function useCities(): CitiesContextValue {
  return useContext(CitiesContext);
}
