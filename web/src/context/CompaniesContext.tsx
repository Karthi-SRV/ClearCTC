/**
 * CompaniesContext — fetches /api/v1/salary-comparisons/companies once on mount and makes the list
 * available to the entire app. Consumers use `useCompanies()` instead of
 * calling the API themselves.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { COMPANIES } from '../constants/api';
import { useApiFetch } from '../hooks/useApiFetch';

interface CompaniesContextValue {
  companies: string[];
  loading: boolean;
  error: string | null;
}

const CompaniesContext = createContext<CompaniesContextValue>({
  companies: [],
  loading: false,
  error: null,
});

let _promise: Promise<string[]> | null = null;
let _cache: string[] | null = null;

async function fetchCompanies(apiFetch: ReturnType<typeof useApiFetch>): Promise<string[]> {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = (async () => {
      try {
        const r = await apiFetch(COMPANIES);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json() as { companies: string[] };
        _cache = d.companies;
        return d.companies;
      } catch (err) {
        _promise = null; // allow retry on next mount
        throw err;
      }
    })();
  }
  return _promise;
}

export function CompaniesProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<string[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError]     = useState<string | null>(null);
  const apiFetch = useApiFetch();

  useEffect(() => {
    if (_cache) return; // already have data
    setLoading(true);
    
    (async () => {
      try {
        const c = await fetchCompanies(apiFetch);
        setCompanies(c);
        setLoading(false);
      } catch (e) {
        setError((e as Error).message);
        setLoading(false);
      }
    })();
  }, [apiFetch]);

  const value = useMemo(
    () => ({ companies, loading, error }),
    [companies, loading, error],
  );

  return (
    <CompaniesContext.Provider value={value}>{children}</CompaniesContext.Provider>
  );
}

/** Use this in any component that needs the company list. */
export function useCompanies(): CompaniesContextValue {
  return useContext(CompaniesContext);
}
