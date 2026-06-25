import { memo, useMemo, useState } from 'react';
import type { QuickSalaryComparisonResponseDto, QuickOfferSnapshotDto, CompanyDetailsDto } from '../types';
import { useAuth } from '../context/AuthContext';

interface Props {
  data: QuickSalaryComparisonResponseDto;
  expenses: any[];
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});

function lpa(n: number) {
  return `${(Math.round(n * 10) / 10).toFixed(1)} LPA`;
}

function lakh(n: number) {
  return `₹${(Math.round(n / 10_000) / 10).toFixed(1)}L`;
}

// ── Expense row label formatter (pure — defined once at module level) ─────────
function expenseLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase());
}

// ── Single offer result card ──────────────────────────────────────────────────
const OfferCard = memo(function OfferCard({
  offer,
  isBestInHand,
  isBestSavings,
}: {
  offer: QuickOfferSnapshotDto;
  isBestInHand: boolean;
  isBestSavings: boolean;
}) {  const isBest = isBestInHand || isBestSavings;
  return (
    <div className={`p2r-offer-card${isBest ? ' p2r-offer-card--best' : ''}`}>
      {/* Header */}
      <div className="p2r-offer-card__head">
        <div className="p2r-offer-card__name">{offer.companyName}</div>
        {isBestInHand && <div className="p2r-offer-card__star">★ BEST IN-HAND</div>}
        {!isBestInHand && isBestSavings && <div className="p2r-offer-card__star">★ BEST SAVINGS</div>}
      </div>

      {/* CTC breakdown */}
      <div className="p2r-section-block">
        <div className="p2r-row">
          <span>Total CTC</span>
          <strong>{lpa(offer.totalCtcLpa)}</strong>
        </div>
        <div className="p2r-row">
          <span>Variable</span>
          <span>
            {offer.variablePct}%
            {offer.variablePct > 0 && (
              <span className={`p2r-var-badge ${offer.variableGuaranteed ? 'p2r-var-badge--guar' : 'p2r-var-badge--risk'}`}>
                {offer.variableGuaranteed ? '✓ guaranteed' : '⚠ at-risk'}
              </span>
            )}
          </span>
        </div>
        {offer.joiningBonusLpa > 0 && (
          <div className="p2r-row">
            <span>Joining Bonus</span>
            <span>{lpa(offer.joiningBonusLpa)} <em className="p2r-note">one-time</em></span>
          </div>
        )}

        <div className="p2r-subsection-head">Contributions</div>

        <div className="p2r-row">
          <span>Employee PF /mo</span>
          <span>{INR.format(offer.employeePfMonthly)}</span>
        </div>
        <div className="p2r-row">
          <span>Employer PF /yr</span>
          <span>{offer.employerPf === 'statutory' ? INR.format(offer.employerPfAnnual) : 'None'}</span>
        </div>
        <div className="p2r-row">
          <span>Gratuity accrual /yr</span>
          <span>{INR.format(offer.gratuityAccrualAnnual)} <em className="p2r-note">first-year</em></span>
        </div>

        <div className="p2r-subsection-head">Tax</div>

        <div className="p2r-row">
          <span>Taxable income</span>
          <span>{INR.format(offer.taxableIncome)}</span>
        </div>
        <div className="p2r-row">
          <span>Income tax /yr</span>
          <span>{INR.format(offer.incomeTaxAnnual)}</span>
        </div>

        <div className="p2r-subsection-head">Take-home</div>

        <div className="p2r-row p2r-row--highlight">
          <span>Monthly in-hand</span>
          <strong className="p2r-inhand">{INR.format(offer.monthlyInHand)}</strong>
        </div>
        <div className="p2r-row">
          <span>Annual in-hand</span>
          <span>{lakh(offer.annualInHand)}</span>
        </div>

        <div className="p2r-subsection-head">Savings</div>

        <div className="p2r-row">
          <span>City</span>
          <span>
            {offer.targetCity}
            {offer.isWfh && <em className="p2r-note"> (WFH)</em>}
          </span>
        </div>
        <div className="p2r-row">
          <span>Monthly expenses</span>
          <span>{INR.format(offer.monthlyExpenses)} <em className="p2r-note">[illustrative]</em></span>
        </div>
        <div className="p2r-row p2r-row--highlight">
          <span>Monthly savings</span>
          <strong>{INR.format(offer.monthlySavings)}</strong>
        </div>
        <div className="p2r-row">
          <span>Annual savings</span>
          <span>{lakh(offer.annualSavings)}</span>
        </div>
      </div>

      {/* Expense breakdown — collapsible */}
      <details className="p2r-breakdown">
        <summary className="p2r-breakdown__toggle">Monthly expense breakdown</summary>
        <div className="p2r-section-block">
          {Object.entries(offer.expenseBreakdown)
            .filter(([k]) => k !== 'total')
            .map(([key, val]) => (
              <div key={key} className="p2r-row">
                <span>{expenseLabel(key)}</span>
                <span>{INR.format(val as number)}</span>
              </div>
            ))}
          <div className="p2r-row p2r-row--highlight">
            <span>Total</span>
            <strong>{INR.format(offer.expenseBreakdown.total)}</strong>
          </div>
        </div>
      </details>
    </div>
  );
});

// ── Comparison table ──────────────────────────────────────────────────────────
function ComparisonTable({ offers }: { offers: QuickOfferSnapshotDto[] }) {
  const maxInHand  = useMemo(() => Math.max(...offers.map(o => o.monthlyInHand)), [offers]);
  const maxSavings = useMemo(() => Math.max(...offers.map(o => o.monthlySavings)), [offers]);

  function Row({ label, fmt }: { label: string; fmt: (o: QuickOfferSnapshotDto) => string }) {
    return (
      <tr>
        <td className="p2r-ct__metric">{label}</td>
        {offers.map(o => <td key={o.companyName} className="p2r-ct__val">{fmt(o)}</td>)}
      </tr>
    );
  }
  return (
    <section className="p2r-compare-section">
      <h3 className="p2r-compare-section__title">SIDE-BY-SIDE COMPARISON</h3>
      <div className="p2r-ct-wrap">
        <table className="p2r-ct">
          <thead>
            <tr>
              <th className="p2r-ct__metric">Metric</th>
              {offers.map(o => (
                <th key={o.companyName} className="p2r-ct__co">{o.companyName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="p2r-ct__sep"><td colSpan={offers.length + 1} /></tr>
            <Row label="Total CTC" fmt={o => lpa(o.totalCtcLpa)} />
            <Row label="Variable" fmt={o => `${o.variablePct}%`} />
            <Row label="Employer PF" fmt={o => o.employerPf === 'statutory' ? 'Statutory' : 'None'} />

            <tr className="p2r-ct__sep"><td colSpan={offers.length + 1} /></tr>
            <Row label="Taxable income" fmt={o => INR.format(o.taxableIncome)} />
            <Row label="Income tax /yr" fmt={o => INR.format(o.incomeTaxAnnual)} />
            <tr>
              <td className="p2r-ct__metric">Monthly in-hand</td>
              {offers.map(o => (
                <td key={o.companyName}
                  className={`p2r-ct__val ${o.monthlyInHand === maxInHand ? 'p2r-ct__val--best' : ''}`}>
                  {INR.format(o.monthlyInHand)}
                </td>
              ))}
            </tr>
            <Row label="Annual in-hand" fmt={o => lakh(o.annualInHand)} />

            <tr className="p2r-ct__sep"><td colSpan={offers.length + 1} /></tr>
            <Row label="City" fmt={o => o.isWfh ? `${o.targetCity} (WFH)` : o.targetCity} />
            <Row label="Monthly expenses" fmt={o => INR.format(o.monthlyExpenses)} />
            <tr>
              <td className="p2r-ct__metric">Monthly savings</td>
              {offers.map(o => (
                <td key={o.companyName}
                  className={`p2r-ct__val ${o.monthlySavings === maxSavings ? 'p2r-ct__val--best' : ''}`}>
                  {INR.format(o.monthlySavings)}
                </td>
              ))}
            </tr>
            <Row label="Annual savings" fmt={o => lakh(o.annualSavings)} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Company details panel ─────────────────────────────────────────────────────
function CompanyPanel({ company }: { company: CompanyDetailsDto }) {
  return (
    <div className="p2r-signal-card">
      <div className="p2r-signal-card__name">
        {company.companyName}
        <span className="p2r-note" style={{ marginLeft: 8, fontWeight: 400 }}>{company.size}</span>
      </div>

      <div className="p2r-ratings">
        <div className="p2r-ratings__source">
          <div className="p2r-ratings__source-name">Employee ratings</div>
          {([
            ['Overall',      company.employeeRating.overall],
            ['WLB',          company.employeeRating.wlb],
            ['Culture',      company.employeeRating.culture],
            ['Growth',       company.employeeRating.growth],
            ['Job Security', company.employeeRating.jobSecurity],
          ] as [string, number][]).map(([label, val]) => (
            <div key={label} className="p2r-ratings__row">
              <span className="p2r-ratings__label">{label}</span>
              <div className="p2r-rbar">
                <div className="p2r-rbar__fill" style={{ width: `${(val / 5) * 100}%` }} />
              </div>
              <span className="p2r-rbar__val">★ {val.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p2r-section-block">
        <div className="p2r-row">
          <span>Insurance</span>
          <span>{company.basicInsurance}</span>
        </div>
        {company.otherBenefits.length > 0 && (
          <div className="p2r-row p2r-row--pills">
            <span>Benefits</span>
            <div className="p2r-pills">
              {company.otherBenefits.map(b => <span key={b} className="p2r-pill">{b}</span>)}
            </div>
          </div>
        )}
      </div>

      {company.reviews.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {company.reviews.map((r, i) => (
            <blockquote key={i} className="p2r-review">
              <p className="p2r-review__text">"{r.snippet}"</p>
              <footer className="p2r-review__footer">— {r.source}</footer>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function SalaryComparisonResult({ data, expenses }: Props) {
  const { user } = useAuth();
  const { offers, companyDetails, disclaimer } = data;
  const [householdSize, setHouseholdSize] = useState<string>('family4');

  const processedOffers = useMemo(() => {
    return offers.map((o) => {
      let monthlyExpenses = o.monthlyExpenses;
      let expenseBreakdown = o.expenseBreakdown;
      const expenseCity = o.isWfh ? user?.currentCity || 'Bangalore' : o.targetCity;
      const expRecord = expenses.find((e) => e.city.toLowerCase() === expenseCity.toLowerCase());
      if (expRecord) {
        const propKey = householdSize === 'individual' ? 'individual' : (householdSize === 'family2' ? 'family' : householdSize);
        const breakdown = expRecord[propKey];
        if (breakdown) {
          monthlyExpenses = breakdown.total;
          expenseBreakdown = breakdown;
        }
      }
      const monthlySavings = o.monthlyInHand - monthlyExpenses;
      const annualSavings = monthlySavings * 12;
      return {
        ...o,
        monthlyExpenses,
        monthlySavings,
        annualSavings,
        expenseBreakdown,
      };
    });
  }, [offers, expenses, householdSize, user?.currentCity]);

  const bestInHand  = useMemo(() => processedOffers.reduce((a, b) => b.monthlyInHand > a.monthlyInHand ? b : a), [processedOffers]);
  const bestSavings = useMemo(() => processedOffers.reduce((a, b) => b.annualSavings > a.annualSavings ? b : a), [processedOffers]);

  return (
    <div className="p2r-root">
      {/* Header */}
      <div className="p2r-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <p className="p2r-header__meta">Comparing {processedOffers.length} offers</p>
          <div className="p2r-header__rec">
            Best in-hand: <strong>{bestInHand.companyName}</strong>
            {bestSavings.companyName !== bestInHand.companyName && (
              <> &nbsp;·&nbsp; Best savings: <strong>{bestSavings.companyName}</strong></>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--code-bg)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <label htmlFor="household-size-select-scr" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)' }}>Household Size:</label>
          <select
            id="household-size-select-scr"
            value={householdSize}
            onChange={(e) => setHouseholdSize(e.target.value)}
            className="ce-select"
            style={{ padding: '4px 8px', background: 'var(--surface)', fontSize: '13px' }}
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

      {/* Offer cards */}
      <div className="p2r-cards">
        {processedOffers.map(o => (
          <OfferCard
            key={o.companyName}
            offer={o}
            isBestInHand={o.companyName === bestInHand.companyName}
            isBestSavings={o.companyName === bestSavings.companyName && o.companyName !== bestInHand.companyName}
          />
        ))}
      </div>

      {/* Side-by-side table */}
      <ComparisonTable offers={processedOffers} />

      {/* Company details */}
      {companyDetails.length > 0 && (
        <section className="p2r-compare-section">
          <h3 className="p2r-compare-section__title">COMPANY DETAILS</h3>
          <div className="p2r-signals-grid">
            {companyDetails.map(c => (
              <CompanyPanel key={c.companyName} company={c} />
            ))}
          </div>
        </section>
      )}

      {/* Footer disclaimer */}
      <footer className="p2r-footer">
        <p>{disclaimer}</p>
        <p>Expense figures are illustrative estimates based on city cost-of-living index.</p>
        <p>This is decision support — not financial advice.</p>
      </footer>
    </div>
  );
}
