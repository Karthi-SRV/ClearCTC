import { useCallback, useMemo, useState } from 'react';
import type { Phase1Response, CityComparisonDto, BadgeType } from '../types';
import { computeMonthlyInHand, computeAnnualTax } from '../utils/comp-client.util';
import { useAuth } from '../context/AuthContext';
import CitySelector from './CitySelector';

// ── Badge ─────────────────────────────────────────────────────────────────────

type BadgeVariant = 'green' | 'blue' | 'gray' | 'amber' | 'orange' | 'red';

const BADGE_VARIANT: Record<BadgeType, BadgeVariant> = {
  'cheaper': 'green',
  'your-base': 'blue',
  'similar': 'gray',
  'moderate': 'amber',
  'premium': 'orange',
  'high-cost': 'red',
};

function Badge({ label }: { label: BadgeType }) {
  return <span className={`p1r-pill p1r-pill--${BADGE_VARIANT[label]}`}>{label}</span>;
}

function ConfBadge({ level, reason }: { level: string; reason?: string }) {
  return (
    <span className={`p1r-pill p1r-pill--conf-${level}`} title={reason}>
      {level}{reason ? ' ⚠' : ''}
    </span>
  );
}

// ── Formatters ────────────────────────────────────────────────────────────────

const inrFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});

function fmtLpa(lpa: number) { return `${lpa.toFixed(1)} LPA`; }
function fmtAnnual(rupees: number) {
  return `₹${(Math.abs(rupees) / 100_000).toFixed(1)}L`;
}

// ── Recompute a row for a given base CTC ─────────────────────────────────────

function recomputeRow(c: CityComparisonDto, baseCtcLpa: number, baseColIdx: number, householdSize: string, expenses: any[]) {
  const equivCtcLpa = Math.round((baseCtcLpa * c.colIndex) / baseColIdx * 10) / 10;
  const monthlyInHand = computeMonthlyInHand(equivCtcLpa);

  let monthlyExpenses = c.monthlyExpenses;
  let expenseBreakdown = c.expenseBreakdown;
  const expRecord = expenses.find((e) => e.city.toLowerCase() === c.city.toLowerCase());
  if (expRecord) {
    const propKey = householdSize === 'individual' ? 'individual' : (householdSize === 'family2' ? 'family' : householdSize);
    const breakdown = expRecord[propKey];
    if (breakdown) {
      monthlyExpenses = breakdown.total;
      expenseBreakdown = {
        ...breakdown,
        disclaimer: expRecord.disclaimer || '',
        generatedAt: expRecord.generatedAt || '',
      };
    }
  }

  return {
    ...c,
    equivCtcLpa,
    equivCtcRangeLow: Math.round(equivCtcLpa * 0.95 * 10) / 10,
    equivCtcRangeHigh: Math.round(equivCtcLpa * 1.05 * 10) / 10,
    monthlyInHand,
    monthlyExpenses,
    monthlySavings: monthlyInHand - monthlyExpenses,
    expenseBreakdown,
    monthlyTax: Math.round(computeAnnualTax(equivCtcLpa) / 12),
  };
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  result: Phase1Response;
  expenses: any[];
}

export default function SalaryAskResult({ result, expenses }: Props) {
  const { user } = useAuth();

  const [mode, setMode] = useState<'current' | 'hiked'>('current');
  const [householdSize, setHouseholdSize] = useState<string>('family4');

  const profilePreferred = useMemo(
    () => new Set((user?.preferredCities ?? []).map((c) => c.toLowerCase())),
    [user?.preferredCities],
  );

  // Default: preferred cities + current city. Empty set = show all.
  const [activeCities, setActiveCities] = useState<Set<string>>(() => {
    const prefLower = (user?.preferredCities ?? []).map((c) => c.toLowerCase());
    if (prefLower.length === 0) return new Set();
    return new Set([...prefLower, result.currentCity.toLowerCase()]);
  });

  const toggleActive = useCallback((city: string) => {
    const key = city.toLowerCase();
    setActiveCities((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const clearActive = useCallback(() => { setActiveCities(new Set()); }, []);

  const baseCtcLpa = mode === 'current' ? result.currentCtcLpa : result.hikedCtcLpa;
  const baseCityRow = result.cityComparisons.find((c) => c.badge === 'your-base') ?? result.cityComparisons[0];
  const baseColIdx = baseCityRow?.colIndex ?? 87;

  const allCityRows = useMemo(
    () => result.cityComparisons.map((c) => recomputeRow(c, baseCtcLpa, baseColIdx, householdSize, expenses)),
    [result.cityComparisons, baseCtcLpa, baseColIdx, householdSize, expenses],
  );

  // Active city filter applies to all tables — empty = show all
  const visibleRows = useMemo(
    () =>
      activeCities.size === 0
        ? allCityRows
        : allCityRows.filter(
          (c) => c.badge === 'your-base' || activeCities.has(c.city.toLowerCase()),
        ),
    [allCityRows, activeCities],
  );

  const baseSavings =
    visibleRows.find((r) => r.badge === 'your-base')?.monthlySavings ?? 0;

  const rangeRows = useMemo(() => [
    { type: 'Conservative', mult: 1.08, note: '8% above current base' },
    { type: 'Target', mult: 1.20, note: '20% above — market-aligned ask' },
    { type: 'Stretch', mult: 1.35, note: '35% above — strong anchor' },
  ].map((r) => {
    const lpa = Math.round(baseCtcLpa * r.mult * 10) / 10;
    return { ...r, lpa, monthlyInHand: computeMonthlyInHand(lpa) };
  }), [baseCtcLpa]);

  const selectAll = useCallback(() => {
    setActiveCities(new Set(allCityRows.map((d) => d.city.toLowerCase())));
  }, [allCityRows]);

  return (
    <div className="p1r-root">

      {/* CTC toggle */}
      <div className="p1r-toggle">
        <button
          className={`p1r-toggle-btn${mode === 'current' ? ' p1r-toggle-btn--active' : ''}`}
          onClick={() => setMode('current')} type="button"
        >
          Current CTC — {result.currentCtcLpa} LPA
        </button>
        <button
          className={`p1r-toggle-btn${mode === 'hiked' ? ' p1r-toggle-btn--active' : ''}`}
          onClick={() => setMode('hiked')} type="button"
        >
          After {result.expectedIncrementPct}% hike — {result.hikedCtcLpa} LPA
        </button>
      </div>
      {/* City & Household filter — applies to all tables */}
      <section className="p1r-city-filter">
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 auto', minWidth: '280px' }}>
            <h3 className="p1r-city-filter__title">Filter by City</h3>
            <CitySelector
              cities={allCityRows.map((c) => ({
                city: c.city,
                isBase: c.badge === 'your-base',
                isPref: profilePreferred.has(c.city.toLowerCase()),
              }))}
              selected={activeCities}
              onToggle={toggleActive}
              onClear={clearActive}
              showSearch={true}
              onSelectAll={selectAll}
              totalCount={allCityRows.length}
            />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <h3 className="p1r-city-filter__title">Household Size</h3>
            <select
              id="household-size-select-sa"
              value={householdSize}
              onChange={(e) => setHouseholdSize(e.target.value)}
              className="ce-select"
              style={{ padding: '8px 12px', minWidth: '180px', background: 'var(--surface)' }}
            >
              <option value="individual">Individual (1 person)</option>
              <option value="family2">Family (2 members)</option>
              <option value="family3">Family (3 members)</option>
              <option value="family4">Family (4 members)</option>
              <option value="family5">Family (5 members)</option>
              <option value="family6">Family (6 members)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Table 1: Salary Range Recommendation */}
      <section className="p1r-section">
        <h2 className="p1r-section-h2">Salary Range Recommendation</h2>
        <div className="p1r-table-wrap">
          <table className="p1r-table">
            <thead>
              <tr>
                <th className="p1r-th-left">Type</th>
                <th>Ask (LPA)</th>
                <th>~In-hand / mo</th>
                <th className="p1r-th-left">Commentary</th>
              </tr>
            </thead>
            <tbody>
              {rangeRows.map((r) => (
                <tr key={r.type}>
                  <td className="p1r-td-city">{r.type}</td>
                  <td className="p1r-td-num p1r-td-bold">{fmtLpa(r.lpa)}</td>
                  <td className="p1r-td-num">{inrFmt.format(r.monthlyInHand)}</td>
                  <td className="p1r-td-note">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Table 2: Adjusted Equivalent CTC */}
      <section className="p1r-section">
        <h2 className="p1r-section-h2">Adjusted Equivalent CTC</h2>
        {visibleRows.length === 0 ? (
          <p className="p1r-empty">No cities selected.</p>
        ) : (
          <div className="p1r-table-wrap">
            <table className="p1r-table">
              <thead>
                <tr>
                  <th className="p1r-th-left">City</th>
                  <th>Badge</th>
                  <th>Equiv CTC</th>
                  <th>Range</th>
                  <th>~In-hand / mo</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((c) => (
                  <tr key={c.city} className={c.badge === 'your-base' ? 'p1r-tr--base' : ''}>
                    <td className="p1r-td-city">{c.city}</td>
                    <td><Badge label={c.badge} /></td>
                    <td className="p1r-td-num p1r-td-bold">{fmtLpa(c.equivCtcLpa)}</td>
                    <td className="p1r-td-num p1r-muted">
                      {fmtLpa(c.equivCtcRangeLow)}–{fmtLpa(c.equivCtcRangeHigh)}
                    </td>
                    <td className="p1r-td-num">{inrFmt.format(c.monthlyInHand)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Table 3: Monthly Savings with Tax */}
      <section className="p1r-section">
        <h2 className="p1r-section-h2">Monthly Savings Comparison</h2>
        {visibleRows.length === 0 ? (
          <p className="p1r-empty">No cities selected.</p>
        ) : (
          <div className="p1r-table-wrap">
            <table className="p1r-table">
              <thead>
                <tr>
                  <th className="p1r-th-left">City</th>
                  <th>Equiv CTC</th>
                  <th>~Tax / mo</th>
                  <th>~In-hand / mo</th>
                  <th>~Expenses / mo</th>
                  <th>~Savings / mo</th>
                  <th>Annual savings</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((c) => {
                  const annSavings = c.monthlySavings * 12;
                  const delta = c.monthlySavings - baseSavings;
                  const isBase = c.badge === 'your-base';
                  return (
                    <tr key={c.city} className={isBase ? 'p1r-tr--base' : ''}>
                      <td className="p1r-td-city">{c.city}</td>
                      <td className="p1r-td-num">{fmtLpa(c.equivCtcLpa)}</td>
                      <td className="p1r-td-num p1r-neg">{inrFmt.format(c.monthlyTax)}</td>
                      <td className="p1r-td-num">{inrFmt.format(c.monthlyInHand)}</td>
                      <td className="p1r-td-num">{inrFmt.format(c.monthlyExpenses)}</td>
                      <td className={`p1r-td-num ${c.monthlySavings >= 0 ? 'p1r-pos' : 'p1r-neg'}`}>
                        {inrFmt.format(c.monthlySavings)}
                      </td>
                      <td className="p1r-td-num">
                        <span>{fmtAnnual(annSavings)}</span>{' '}
                        {isBase ? (
                          <span className="p1r-muted">— base</span>
                        ) : (
                          <span className={delta >= 0 ? 'p1r-pos' : 'p1r-neg'}>
                            {delta >= 0 ? '+' : ''}{inrFmt.format(delta)}/mo
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Notes */}
      <div className="p1r-notes">
        <div className="p1r-notes-status">
          <div className="p1r-notes-stat">
            <span className="p1r-notes-stat__label">Confidence</span>
            <div className="p1r-notes-stat__value">
              <ConfBadge level={result.confidence} reason={result.confidenceReason} />
              <span className="p1r-notes-stat__detail">
                {result.confidenceReason ?? 'All expense data is fresh and city was recognised.'}
              </span>
            </div>
          </div>
          <div className="p1r-notes-stat">
            <span className="p1r-notes-stat__label">Data as of</span>
            <span className="p1r-notes-stat__detail">
              {result.dataAsOf} — AI-refreshed when &gt;30 days old; Redis TTL 7 days
            </span>
          </div>
        </div>

        <div className="p1r-notes-method">
          <p>Tax: FY 2025-26 new-regime — std deduction ₹75k; employee PF 12% of basic (cap ₹15k/mo); 4% cess; 87A rebate zeroes tax ≤ ₹12 L taxable.</p>
          <p>In-hand = CTC − annual PF − annual tax ÷ 12. Monthly expenses are AI-estimated city averages; individual spend varies.</p>
          <p>COL base: Bangalore = 100. Equiv CTC = your CTC × (target city COL ÷ your COL). ±5% range = negotiation band.</p>
          {result.expensesDisclaimer && (
            <p className="p1r-notes-disclaimer">✱ {result.expensesDisclaimer}</p>
          )}
        </div>
      </div>

    </div>
  );
}
