import { useEffect, useState } from 'react';
import SalaryComparisonForm from '../components/SalaryComparisonForm';
import SalaryComparisonResult from '../components/SalaryComparisonResult';
import type { QuickSalaryComparisonResponseDto } from '../types';
import { CITY_EXPENSES } from '../constants/api';
import { useApiFetch } from '../hooks/useApiFetch';

export default function SalaryComparisonPage() {
  const apiFetch = useApiFetch();
  const [result, setResult] = useState<QuickSalaryComparisonResponseDto | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);

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

  return (
    <main className="page">
      <h2>Quick Salary Comparison</h2>
      <p className="subtitle">
        Compare multiple offers side-by-side — taxes, city expenses, and savings calculated instantly. No AI required.
      </p>
      <SalaryComparisonForm onResult={setResult} />
      {result && <SalaryComparisonResult data={result} expenses={expenses} />}
    </main>
  );
}
