import { memo, useMemo } from 'react';
import type { OfferResult, Phase2Response, Recommendation } from '../types';

interface Props {
  result: Phase2Response;
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});

function lpa(n: number) {
  return `${(Math.round(n / 1_00_000 * 10) / 10).toFixed(1)} LPA`;
}

function lakh(n: number) {
  return `₹${(Math.round(n / 1_00_000 * 10) / 10).toFixed(1)}L`;
}

// ── Tooltip helper ────────────────────────────────────────────────────────────
function Tip({ text }: { text: string }) {
  return <span className="p2r-tip" title={text} aria-label={text}>ⓘ</span>;
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="p2r-score-bar">
      <span className="p2r-score-bar__label">{label}</span>
      <div className="p2r-score-bar__track">
        <div className="p2r-score-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="p2r-score-bar__val">{value}/{max}</span>
    </div>
  );
}

// ── Risk badge ────────────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const cls = `p2r-risk-badge p2r-risk-badge--${level}`;
  return <span className={cls}>{level.toUpperCase()}</span>;
}

// ── Divider ───────────────────────────────────────────────────────────────────
function AiDivider() {
  return <div className="p2r-ai-divider"><span>AI analysis</span></div>;
}

// ── Single offer card ─────────────────────────────────────────────────────────
const OfferCard = memo(function OfferCard({ offer, isRecommended }: { offer: OfferResult; isRecommended: boolean }) {
  const det = offer;  // deterministic section alias for clarity
  const ai  = offer;  // AI section alias

  return (
    <div className={`p2r-offer-card${isRecommended ? ' p2r-offer-card--best' : ''}`}>
      {/* Header */}
      <div className="p2r-offer-card__head">
        <div className="p2r-offer-card__name">{det.companyName}</div>
        <div className="p2r-offer-card__score">Score: {ai.score}/100</div>
        {isRecommended && <div className="p2r-offer-card__star">★ RECOMMENDED</div>}
      </div>

      {/* ── Deterministic section ──────────────────────────────────────────── */}
      <div className="p2r-section-block">

        <div className="p2r-row">
          <span>Total CTC <Tip text="The headline CTC the company quoted. Includes fixed, variable, employer PF, and gratuity." /></span>
          <strong>{lpa(det.totalCtcLpa * 100_000)}</strong>
        </div>

        <div className="p2r-row">
          <span>Variable Pay</span>
          <span>
            {lpa(det.variableAnnual)}
            {' '}({det.variablePct}%)
            {det.variablePct > 0 && (
              <span className={`p2r-var-badge ${det.variableGuaranteed ? 'p2r-var-badge--guar' : 'p2r-var-badge--risk'}`}>
                {det.variableGuaranteed ? '✓ guaranteed' : '⚠ at-risk'}
              </span>
            )}
          </span>
        </div>

        <div className="p2r-row">
          <span>Fixed Pay <Tip text="Derived: Total CTC minus variable pay, employer PF, gratuity accrual, and joining bonus." /></span>
          <span>{lpa(det.fixedPayAnnual)} <em className="p2r-note">(derived)</em></span>
        </div>

        {det.joiningBonusLpa > 0 && (
          <div className="p2r-row">
            <span>Joining Bonus <Tip text="One-time payment. Not counted in recurring CTC. Taxed as a perquisite." /></span>
            <span>{lpa(det.joiningBonusLpa * 100_000)} <em className="p2r-note">one-time · perquisite tax</em></span>
          </div>
        )}

        <div className="p2r-subsection-head">Employer contributions</div>

        <div className="p2r-row">
          <span>Employer PF</span>
          <span>{det.employerPf === 'statutory' ? `${INR.format(det.employerPfAnnual / 12)} /mo` : 'Not contributed'}</span>
        </div>

        <div className="p2r-row">
          <span>Gratuity accrual <Tip text="First-year estimate only. Requires 5 years of continuous service for actual payout." /></span>
          <span>{INR.format(det.gratuityAccrualAnnual)} /yr <em className="p2r-note">first-year · vests at 5 yrs</em></span>
        </div>

        <div className="p2r-subsection-head">Tax</div>

        <div className="p2r-row">
          <span>Effective CTC <Tip text="Used for all tax and savings calculations. Variable excluded if marked at-risk." /></span>
          <span>{lpa(det.effectiveCtcAnnual)}</span>
        </div>

        <div className="p2r-row">
          <span>Taxable income</span>
          <span>{INR.format(det.taxableIncome)}</span>
        </div>

        <div className="p2r-row">
          <span>Income tax</span>
          <span>{INR.format(det.incomeTaxAnnual)} /yr</span>
        </div>

        <div className="p2r-row">
          <span>Employee PF</span>
          <span>{INR.format(det.employeePfMonthly)} /mo</span>
        </div>

        <div className="p2r-subsection-head">Take-home</div>

        <div className="p2r-row p2r-row--highlight">
          <span>Monthly in-hand</span>
          <strong className="p2r-inhand">{INR.format(det.monthlyInHand)}</strong>
        </div>

        <div className="p2r-row">
          <span>Annual in-hand</span>
          <span>{lakh(det.annualInHand)}</span>
        </div>

        <div className="p2r-subsection-head">Savings</div>

        <div className="p2r-row">
          <span>City</span>
          <span>
            {det.targetCity}
            {det.isWfh && <em className="p2r-note"> (WFH — expenses from your city)</em>}
          </span>
        </div>

        <div className="p2r-row">
          <span>Monthly expenses <em className="p2r-note">[illustrative]</em></span>
          <span>{INR.format(det.monthlyExpenses)}</span>
        </div>

        <div className="p2r-row p2r-row--highlight">
          <span>Monthly savings</span>
          <strong>{INR.format(det.monthlySavings)}</strong>
        </div>

        <div className="p2r-row">
          <span>Annual savings</span>
          <span>{lakh(det.annualSavings)}</span>
        </div>
      </div>

      <AiDivider />

      {/* ── AI section ────────────────────────────────────────────────────── */}
      <div className="p2r-section-block">

        <div className="p2r-row">
          <span>Company size</span>
          <span>{ai.companySize}</span>
        </div>

        <div className="p2r-row">
          <span>Insurance</span>
          <span>{ai.basicInsurance}</span>
        </div>

        {ai.otherBenefits.length > 0 && (
          <div className="p2r-row p2r-row--pills">
            <span>Benefits</span>
            <div className="p2r-pills">
              {ai.otherBenefits.map(b => <span key={b} className="p2r-pill">{b}</span>)}
            </div>
          </div>
        )}

        <div className="p2r-subsection-head">
          Ratings <em className="p2r-note">(source: {ai.employeeRating.source})</em>
        </div>

        {([
          ['Overall',      ai.employeeRating.overall],
          ['WLB',          ai.employeeRating.wlb],
          ['Culture',      ai.employeeRating.culture],
          ['Growth',       ai.employeeRating.growth],
          ['Job security', ai.employeeRating.jobSecurity],
        ] as [string, number][]).map(([label, val]) => (
          <div key={label} className="p2r-row p2r-row--rating">
            <span>{label}</span>
            <span>★ {typeof val === 'number' ? val.toFixed(1) : val}</span>
          </div>
        ))}

        {ai.employeeRating.disagreementFlag && (
          <div className="p2r-disagree">⚠ {ai.employeeRating.disagreementFlag}</div>
        )}

        <div className="p2r-procon">
          <div className="p2r-procon__col">
            {ai.pros.map((p, i) => <div key={i} className="p2r-pro">✓ {p}</div>)}
          </div>
          <div className="p2r-procon__col">
            {ai.cons.map((c, i) => <div key={i} className="p2r-con">✗ {c}</div>)}
          </div>
        </div>

        <div className="p2r-risk">
          <div className="p2r-risk__head">Risk <RiskBadge level={ai.riskAssessment.level} /></div>
          <ul className="p2r-risk__factors">
            {ai.riskAssessment.factors.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          <p className="p2r-risk__worth">Worth it? {ai.riskAssessment.benefitForRisk}</p>
        </div>

        <div className="p2r-score-section">
          <div className="p2r-subsection-head">Score breakdown</div>
          <ScoreBar value={ai.scoreBreakdown.financial}   max={40} label="Financial" />
          <ScoreBar value={ai.scoreBreakdown.qualitative} max={40} label="Qualitative" />
          <ScoreBar value={ai.scoreBreakdown.risk}        max={20} label="Risk" />
          <div className="p2r-score-total">Total {ai.score}/100</div>
        </div>

      </div>
    </div>
  );
});

// ── Comparison table ──────────────────────────────────────────────────────────
function ComparisonTable({ offers, recommendation }: { offers: OfferResult[]; recommendation: Recommendation }) {
  const best = recommendation.bestOffer;

  const maxInHand  = useMemo(() => offers.reduce((a, b) => b.monthlyInHand > a.monthlyInHand ? b : a).companyName, [offers]);
  const maxSavings = useMemo(() => offers.reduce((a, b) => b.monthlySavings > a.monthlySavings ? b : a).companyName, [offers]);
  const maxScore   = useMemo(() => offers.reduce((a, b) => b.score > a.score ? b : a).companyName, [offers]);
  const minScore   = useMemo(() => offers.reduce((a, b) => b.score < a.score ? b : a).companyName, [offers]);

  return (
    <section className="p2r-compare-section">
      <h3 className="p2r-compare-section__title">SIDE-BY-SIDE COMPARISON</h3>
      <div className="p2r-ct-wrap">
        <table className="p2r-ct">
          <thead>
            <tr>
              <th className="p2r-ct__metric">Metric</th>
              {offers.map(o => (
                <th key={o.companyName} className="p2r-ct__co">
                  {o.companyName}
                  {o.companyName === best && <span className="p2r-ct__star"> ★</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="p2r-ct__sep">
              <td colSpan={offers.length + 1} />
            </tr>

            {/* CTC block */}
            <TableRow label="Total CTC" offers={offers} fmt={o => lpa(o.totalCtcLpa * 100_000)} />
            <TableRow label="Variable" offers={offers}
              fmt={o => `${o.variablePct}% ${o.variablePct > 0 ? (o.variableGuaranteed ? '✓' : '⚠') : ''}`} />
            <TableRow label="Fixed Pay" offers={offers} fmt={o => INR.format(o.fixedPayAnnual)} />
            <TableRow label="Joining Bonus" offers={offers}
              fmt={o => o.joiningBonusLpa > 0 ? INR.format(o.joiningBonusLpa * 100_000) : '—'} />
            <TableRow label="Employer PF" offers={offers}
              fmt={o => o.employerPf === 'statutory' ? 'Statutory' : 'None'} />

            <tr className="p2r-ct__sep"><td colSpan={offers.length + 1} /></tr>

            {/* Take-home block */}
            <TableRow label="Effective CTC" offers={offers} fmt={o => lpa(o.effectiveCtcAnnual)} />
            <TableRow label="Income tax /yr" offers={offers} fmt={o => INR.format(o.incomeTaxAnnual)} />
            <tr>
              <td className="p2r-ct__metric">Monthly in-hand</td>
              {offers.map(o => (
                <td key={o.companyName} className={`p2r-ct__val ${o.companyName === maxInHand ? 'p2r-ct__val--best' : ''}`}>
                  {INR.format(o.monthlyInHand)}
                </td>
              ))}
            </tr>
            <TableRow label="Monthly expenses" offers={offers} fmt={o => INR.format(o.monthlyExpenses)} />
            <tr>
              <td className="p2r-ct__metric">Monthly savings</td>
              {offers.map(o => (
                <td key={o.companyName} className={`p2r-ct__val ${o.companyName === maxSavings ? 'p2r-ct__val--best' : ''}`}>
                  {INR.format(o.monthlySavings)}
                </td>
              ))}
            </tr>
            <TableRow label="Annual savings" offers={offers} fmt={o => lakh(o.annualSavings)} />

            <tr className="p2r-ct__sep"><td colSpan={offers.length + 1} /></tr>

            {/* Qualitative block */}
            <TableRow label="Employee rating" offers={offers} fmt={o => `★ ${o.employeeRating.overall.toFixed(1)}`} />
            <TableRow label="WLB" offers={offers} fmt={o => `★ ${o.employeeRating.wlb.toFixed(1)}`} />
            <tr>
              <td className="p2r-ct__metric">Risk level</td>
              {offers.map(o => (
                <td key={o.companyName} className="p2r-ct__val">
                  <RiskBadge level={o.riskAssessment.level} />
                </td>
              ))}
            </tr>
            <TableRow label="Insurance" offers={offers} fmt={o => o.basicInsurance} />

            <tr className="p2r-ct__sep"><td colSpan={offers.length + 1} /></tr>

            {/* Score */}
            <tr>
              <td className="p2r-ct__metric"><strong>Final score</strong></td>
              {offers.map(o => (
                <td key={o.companyName}
                  className={`p2r-ct__val ${o.companyName === maxScore ? 'p2r-ct__val--best' : ''} ${o.companyName === minScore && offers.length > 1 && o.score !== Math.max(...offers.map(x => x.score)) ? 'p2r-ct__val--worst' : ''}`}>
                  <strong>{o.score}/100</strong>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableRow({ label, offers, fmt }: { label: string; offers: OfferResult[]; fmt: (o: OfferResult) => string }) {
  return (
    <tr>
      <td className="p2r-ct__metric">{label}</td>
      {offers.map(o => <td key={o.companyName} className="p2r-ct__val">{fmt(o)}</td>)}
    </tr>
  );
}

// ── Recommendation panel ──────────────────────────────────────────────────────
function RecommendationPanel({ rec, offers }: { rec: Recommendation; offers: OfferResult[] }) {
  const others = offers.filter(o => o.companyName !== rec.bestOffer);
  const confClass = `p2r-rec p2r-rec--${rec.confidence}`;

  return (
    <section className={confClass}>
      <div className="p2r-rec__head">
        <span className="p2r-rec__star">★</span>
        <strong>{rec.bestOffer} is recommended</strong>
        <span className={`p2r-conf-badge p2r-conf-badge--${rec.confidence}`}>{rec.confidence} confidence</span>
      </div>

      <p className="p2r-rec__suggestion">{rec.suggestion}</p>

      <div className="p2r-rec__why">
        <strong>Why {rec.bestOffer}:</strong>
        <p>{rec.whyBest}</p>
      </div>

      {others.length > 0 && (
        <div className="p2r-rec__others">
          <strong>Why not the others:</strong>
          <ul>
            {others.map(o => (
              <li key={o.companyName}>
                <strong>{o.companyName}:</strong> {rec.whyNotOthers[o.companyName] ?? '—'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rec.caveat && (
        <p className="p2r-rec__caveat">⚠ {rec.caveat}</p>
      )}
    </section>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Phase2Result({ result }: Props) {
  const { offers, recommendation, dataDisclaimer } = result;

  return (
    <div className="p2r-root">
      {/* Header */}
      <div className="p2r-header">
        <p className="p2r-header__meta">
          Comparing {offers.length} offers
        </p>
        <div className="p2r-header__rec">
          Recommended: <strong>{recommendation.bestOffer}</strong>
          <span className={`p2r-conf-badge p2r-conf-badge--${recommendation.confidence}`}>
            {recommendation.confidence} confidence
          </span>
        </div>
      </div>

      {/* Offer cards */}
      <div className="p2r-cards">
        {offers.map(o => (
          <OfferCard
            key={o.companyName}
            offer={o}
            isRecommended={o.companyName === recommendation.bestOffer}
          />
        ))}
      </div>

      {/* Comparison table */}
      <ComparisonTable offers={offers} recommendation={recommendation} />

      {/* Recommendation panel */}
      <RecommendationPanel rec={recommendation} offers={offers} />

      {/* Footer disclaimer */}
      <footer className="p2r-footer">
        <p>{dataDisclaimer}</p>
        <p>Fixed pay is derived — not entered. Variable excluded from tax calculation unless guaranteed.</p>
        <p>Gratuity accrual is a first-year estimate; actual payout requires 5 years of service.</p>
        <p>This is decision support — not financial advice.</p>
      </footer>
    </div>
  );
}
