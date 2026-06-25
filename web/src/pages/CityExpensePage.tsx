import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApiFetch } from '../hooks/useApiFetch';
import CitySelector from '../components/CitySelector';
import { CITY_EXPENSES } from '../constants/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExpenseBreakdown {
  rent: number;
  groceries: number;
  utilities: number;
  transport: number;
  foodDining: number;
  personalLifestyle: number;
  kidsEducation: number;
  insurance: number;
  miscellaneous: number;
  total: number;
}

interface CityExpenseRecord {
  city: string;
  generatedAt: string;
  disclaimer: string;
  individual: ExpenseBreakdown;
  family: ExpenseBreakdown;
  family3: ExpenseBreakdown;
  family4: ExpenseBreakdown;
  family5: ExpenseBreakdown;
  family6: ExpenseBreakdown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const BREAKDOWN_LABELS: { key: keyof ExpenseBreakdown; label: string }[] = [
  { key: 'rent',              label: 'Rent' },
  { key: 'groceries',         label: 'Groceries' },
  { key: 'utilities',         label: 'Utilities' },
  { key: 'transport',         label: 'Transport' },
  { key: 'foodDining',        label: 'Food & Dining' },
  { key: 'personalLifestyle', label: 'Personal & Lifestyle' },
  { key: 'miscellaneous',     label: 'Miscellaneous' },
  { key: 'total',             label: 'Total' },
];

// ── Bar for a single breakdown row ────────────────────────────────────────────
function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="ce-bar" title={`${pct}% of highest`}>
      <div className="ce-bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CityExpensePage() {
  const { user } = useAuth();
  const apiFetch = useApiFetch();
  const [all, setAll]           = useState<CityExpenseRecord[]>([]);
  // selected uses lowercase city keys to match CitySelector's contract
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [householdSize, setHouseholdSize] = useState<string>('family4');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [hasAppliedDefault, setHasAppliedDefault] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch(CITY_EXPENSES);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json() as CityExpenseRecord[];
        
        const sorted = [...data].sort((a, b) => a.city.localeCompare(b.city));
        setAll(sorted);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [apiFetch]);

  // ── Sync default filter once user and data are both loaded ─────────────────
  useEffect(() => {
    if (loading || all.length === 0 || hasAppliedDefault) return;

    // Wait until user details are resolved since it's a private route
    if (!user) return;

    const prefs   = (user.preferredCities ?? []).map((c) => c.toLowerCase());
    const current = (user.currentCity ?? '').toLowerCase();
    const df = [...new Set([...prefs, current].filter(Boolean))];

    if (df.length > 0) {
      const filterSet = new Set(df);
      const matched   = new Set(
        all.filter((d) => filterSet.has(d.city.toLowerCase())).map((d) => d.city.toLowerCase()),
      );
      setSelected(matched.size > 0 ? matched : new Set(all.map((d) => d.city.toLowerCase())));
    } else {
      setSelected(new Set(all.map((d) => d.city.toLowerCase())));
    }
    setHasAppliedDefault(true);
  }, [all, loading, user, hasAppliedDefault]);

  // ── Rows to show in table = selected ∩ loaded ─────────────────────────────
  const rows = useMemo(
    () => all.filter((d) => selected.has(d.city.toLowerCase())),
    [all, selected],
  );

  const activeRows = useMemo(() => {
    return rows.map((r) => {
      const breakdown = (r as any)[householdSize] as ExpenseBreakdown || r.family4;
      return {
        ...r,
        breakdown,
      };
    });
  }, [rows, householdSize]);

  // ── Per-field max for bar scaling ──────────────────────────────────────────
  const maxByField = useMemo(() => {
    const m: Record<string, number> = {};
    for (const { key } of BREAKDOWN_LABELS) {
      m[key] = Math.max(...activeRows.map((r) => r.breakdown[key] ?? 0), 1);
    }
    return m;
  }, [activeRows]);

  const toggleCity = useCallback((cityLower: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(cityLower) ? next.delete(cityLower) : next.add(cityLower);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(all.map((d) => d.city.toLowerCase())));
  }, [all]);

  const clearAll = useCallback(() => { setSelected(new Set()); }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="page">
      <h2>City Expense Explorer</h2>
      <p className="subtitle">
      </p>

      {loading && <div className="ce-status">Loading expense data…</div>}
      {error   && <div className="ce-status ce-status--error">Failed to load: {error}</div>}

      {!loading && !error && (
        <>
          {/* ── City selector ─────────────────────────────────────────── */}
          <section className="ce-selector">
            <CitySelector
              cities={all.map((d) => ({ city: d.city }))}
              selected={selected}
              onToggle={toggleCity}
              onSelectAll={selectAll}
              onClear={clearAll}
              showSearch
              totalCount={all.length}
            />
          </section>

          {/* ── Household selector ───────────────────────────────────── */}
          <section className="ce-household-selector">
            <label htmlFor="household-size-select">Household Size:</label>
            <select
              id="household-size-select"
              value={householdSize}
              onChange={(e) => setHouseholdSize(e.target.value)}
              className="ce-select"
            >
              <option value="individual">Individual (1 person)</option>
              <option value="family">Family (2 members / Couple)</option>
              <option value="family3">Family (3 members)</option>
              <option value="family4">Family (4 members)</option>
              <option value="family5">Family (5 members)</option>
              <option value="family6">Family (6 members)</option>
            </select>
          </section>

          {/* ── Comparison table ──────────────────────────────────────── */}
          {activeRows.length === 0 ? (
            <div className="ce-status">Select at least one city to compare.</div>
          ) : (
            <section className="ce-table-section">
              <div className="ce-table-wrap">
                <table className="ce-table">
                  <thead>
                    <tr>
                      <th className="ce-th-label">Expense</th>
                      {activeRows.map((r) => (
                        <th key={r.city} className="ce-th-city">{r.city}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {BREAKDOWN_LABELS.map(({ key, label }) => (
                      <tr key={key} className={key === 'total' ? 'ce-tr--total' : ''}>
                        <td className="ce-td-label">{label}</td>
                        {activeRows.map((r) => {
                          const val   = r.breakdown[key] ?? 0;
                          const isMax = val === maxByField[key] && activeRows.length > 1;
                          const isMin = val === Math.min(...activeRows.map(x => x.breakdown[key] ?? 0)) && activeRows.length > 1 && val < maxByField[key];
                          return (
                            <td
                              key={r.city}
                              className={`ce-td-val${isMax ? ' ce-td-val--max' : ''}${isMin ? ' ce-td-val--min' : ''}`}
                            >
                              <div className="ce-td-val__num">{INR.format(val)}</div>
                              {key !== 'total' && (
                                <MiniBar value={val} max={maxByField[key]} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ce-disclaimer">
                ✱ {activeRows[0]?.disclaimer ?? 'Expense estimates are illustrative. Not financial advice.'}
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
