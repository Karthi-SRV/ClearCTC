import { useCallback, useEffect, useRef, useState } from 'react';
import SalaryAskForm from '../components/SalaryAskForm';
import SalaryAskResult from '../components/SalaryAskResult';
import { useAuth } from '../context/AuthContext';
import { useApiFetch } from '../hooks/useApiFetch';
import type { Phase1Response } from '../types';
import { SALARY_ASKS, CITY_EXPENSES } from '../constants/api';

export default function SalaryAskPage() {
  const { user } = useAuth();
  const apiFetch = useApiFetch();
  const [result, setResult]           = useState<Phase1Response | null>(null);
  const [expenses, setExpenses]       = useState<any[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError]     = useState<string | null>(null);
  const didAutoFetch                  = useRef(false);

  // Stable callback — passed down to SalaryAskForm
  const handleResult = useCallback((res: Phase1Response) => {
    setResult(res);
  }, []);

  // Fetch all city expenses once for local recalculations
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(CITY_EXPENSES);
        if (r.ok) {
          const data = await r.json();
          setExpenses(data);
        }
      } catch (err) {
        console.error('Failed to load city expenses locally:', err);
      }
    })();
  }, [apiFetch]);

  // Auto-fetch on first load using the logged-in user's profile
  useEffect(() => {
    if (!user || didAutoFetch.current) return;
    didAutoFetch.current = true;

    setAutoLoading(true);
    setAutoError(null);

    (async () => {
      try {
        const r = await apiFetch(SALARY_ASKS, {
          method: 'POST',
          body: JSON.stringify({
            currentCity: user.currentCity,
            currentCtcLpa: user.currentCtcLpa,
            expectedIncrementPct: Math.round(user.expectedHikePct),
            familyType: 'family',
            memberCount: 4,
          }),
        });
        
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        const result = await r.json() as Phase1Response;
        handleResult(result);
      } catch (err) {
        setAutoError((err as Error).message);
      } finally {
        setAutoLoading(false);
      }
    })();
  // apiFetch is stable (memoized); didAutoFetch guard prevents re-runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <main className="page">
      <h2>Salary Ask</h2>

      <SalaryAskForm
        onResult={handleResult}
        initialCity={user?.currentCity}
        initialCtcLpa={user ? String(user.currentCtcLpa) : undefined}
        initialHikePct={user ? String(Math.round(user.expectedHikePct)) : undefined}
      />

      {autoLoading && (
        <div className="p1-auto-status">
          <span className="p1-form__spinner" aria-hidden="true" />
          Loading your personalised insights…
        </div>
      )}

      {autoError && !autoLoading && (
        <div className="p1-form__server-error" role="alert" style={{ maxWidth: 760, margin: '16px auto 0' }}>
          <span>⚠</span> Could not auto-load results: {autoError}
        </div>
      )}

      {result && <SalaryAskResult result={result} expenses={expenses} />}
    </main>
  );
}
