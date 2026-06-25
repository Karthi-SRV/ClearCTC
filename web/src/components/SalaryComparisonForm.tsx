import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApiFetch } from '../hooks/useApiFetch';
import { useCities } from '../context/CitiesContext';
import { computeOfferLivePreview } from '../utils/comp-client.util';
import CityCombobox from './CityCombobox';
import CompanyCombobox from './CompanyCombobox';
import { useCompanies } from '../context/CompaniesContext';
import type { SalaryComparisonOfferDto, QuickSalaryComparisonResponseDto } from '../types';
import { SALARY_COMPARISONS } from '../constants/api';

type OfferDraft = SalaryComparisonOfferDto;

interface Props {
  onResult: (res: QuickSalaryComparisonResponseDto) => void;
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
});

function emptyOffer(): OfferDraft {
  return {
    companyName: '',
    totalCtcLpa: 20,
    variablePct: 0,
    variableGuaranteed: false,
    joiningBonusLpa: 0,
    employerPf: 'statutory',
    targetCity: '',
    isWfh: false,
  };
}

function isComplete(o: OfferDraft): boolean {
  return o.companyName.trim().length > 0 && (o.isWfh || o.targetCity.trim().length > 0);
}

// ── Per-offer live preview strip ──────────────────────────────────────────────
const LivePreview = memo(function LivePreview({ offer }: { offer: OfferDraft }) {
  const preview = useMemo(
    () => computeOfferLivePreview(
      offer.totalCtcLpa,
      offer.variablePct,
      offer.variableGuaranteed,
      offer.joiningBonusLpa,
      offer.employerPf,
    ),
    [offer.totalCtcLpa, offer.variablePct, offer.variableGuaranteed, offer.joiningBonusLpa, offer.employerPf],
  );

  return (
    <div className="p2-preview">
      <div className="p2-preview__row">
        <span>Variable amount</span>
        <span>
          {INR.format(preview.variableAnnual)} /yr
          {offer.variablePct > 0 && <em className="p2-preview__pct"> ({offer.variablePct}% of total)</em>}
        </span>
      </div>
      <div className="p2-preview__row">
        <span>Fixed pay</span>
        <span>{INR.format(preview.fixedPayAnnual)} /yr <em className="p2-preview__note">(derived)</em></span>
      </div>
      <div className="p2-preview__row">
        <span>Effective CTC</span>
        <span>{preview.effectiveCtcLpa} LPA <em className="p2-preview__note">(for tax)</em></span>
      </div>
      <div className="p2-preview__row p2-preview__row--inhand">
        <span>Est. in-hand</span>
        <span>{INR.format(preview.monthlyInHand)} /mo</span>
      </div>
      <p className="p2-preview__label">approximate — full calculation after submit</p>
    </div>
  );
});

// ── Single offer card ─────────────────────────────────────────────────────────
interface OfferCardProps {
  index: number;
  offer: OfferDraft;
  canRemove: boolean;
  onChange: (patch: Partial<OfferDraft>) => void;
  onRemove: () => void;
}

const OFFER_ACCENT = ['#6366f1', '#0ea5e9', '#10b981'];

const OfferCard = memo(function OfferCard({ index, offer, canRemove, onChange, onRemove }: OfferCardProps) {
  const { cities, loading: citiesLoading } = useCities();
  const { loading: companiesLoading } = useCompanies();
  const accent = OFFER_ACCENT[index] ?? '#6366f1';

  return (
    <div className="p2-offer-card" style={{ '--offer-color': accent } as React.CSSProperties}>
      <div className="p2-offer-card__header">
        <span className="p2-offer-card__num">Offer {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            className="p2-offer-card__remove"
            onClick={onRemove}
            aria-label={`Remove offer ${index + 1}`}
          >
            ✕
          </button>
        )}
      </div>

      <div className="p2-offer-card__grid">

        {/* Company name */}
        <div className="p2-field p2-field--full">
          <label className="p2-field__label">
            Company name
            {companiesLoading && <em className="p2r-note"> loading…</em>}
          </label>
          <CompanyCombobox
            id={`company-sc-${index}`}
            value={offer.companyName}
            onChange={company => onChange({ companyName: company })}
          />
        </div>

        {/* Total CTC */}
        <div className="p2-field">
          <label className="p2-field__label">Total CTC (LPA)</label>
          <input
            className="p2-field__input"
            type="number"
            min={1}
            step={0.5}
            value={offer.totalCtcLpa}
            onChange={e => onChange({ totalCtcLpa: Math.max(1, parseFloat(e.target.value) || 1) })}
          />
        </div>

        {/* Variable pay */}
        <div className="p2-field">
          <label className="p2-field__label">Variable pay (%)</label>
          <input
            className="p2-field__input"
            type="number"
            min={0}
            max={30}
            step={1}
            value={offer.variablePct}
            onChange={e => onChange({ variablePct: Math.min(30, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
          />
        </div>

        {/* Variable pay type toggle */}
        <div className="p2-field p2-field--full p2-field--toggle-wrap">
          <label className="p2-field__label">Variable pay type</label>
          <div className="p2-toggle">
            <button
              type="button"
              className={`p2-toggle__btn${offer.variableGuaranteed ? ' p2-toggle__btn--active' : ''}`}
              onClick={() => onChange({ variableGuaranteed: true })}
              disabled={offer.variablePct === 0}
            >
              ✓ Guaranteed
            </button>
            <button
              type="button"
              className={`p2-toggle__btn${!offer.variableGuaranteed ? ' p2-toggle__btn--active p2-toggle__btn--risk' : ''}`}
              onClick={() => onChange({ variableGuaranteed: false })}
              disabled={offer.variablePct === 0}
            >
              ⚠ At-risk
            </button>
          </div>
        </div>

        {/* Joining bonus */}
        <div className="p2-field">
          <label className="p2-field__label">Joining bonus (LPA)</label>
          <input
            className="p2-field__input"
            type="number"
            min={0}
            step={0.5}
            value={offer.joiningBonusLpa || ''}
            placeholder="0"
            onChange={e => onChange({ joiningBonusLpa: parseFloat(e.target.value) || 0 })}
          />
        </div>

        {/* Employer PF */}
        <div className="p2-field">
          <label className="p2-field__label">Employer PF</label>
          <div className="p2-radio-group">
            {(['statutory', 'none'] as const).map(v => (
              <label key={v} className="p2-radio">
                <input
                  type="radio"
                  name={`empPf-sc-${index}`}
                  value={v}
                  checked={offer.employerPf === v}
                  onChange={() => onChange({ employerPf: v })}
                />
                {v === 'statutory' ? 'Statutory' : 'Not contributed'}
              </label>
            ))}
          </div>
        </div>

        {/* Work mode */}
        <div className="p2-field">
          <label className="p2-field__label">Work mode</label>
          <div className="p2-radio-group">
            <label className="p2-radio">
              <input
                type="radio"
                name={`wfh-sc-${index}`}
                checked={!offer.isWfh}
                onChange={() => onChange({ isWfh: false })}
              />
              Office
            </label>
            <label className="p2-radio">
              <input
                type="radio"
                name={`wfh-sc-${index}`}
                checked={offer.isWfh}
                onChange={() => onChange({ isWfh: true })}
              />
              WFH
            </label>
          </div>
        </div>

        {/* Target city — only when office */}
        {!offer.isWfh && (
          <div className="p2-field">
            <label className="p2-field__label">
              Target city
              {citiesLoading && <em className="p2r-note"> loading…</em>}
            </label>
            <CityCombobox
              id={`city-sc-${index}`}
              value={offer.targetCity}
              onChange={city => onChange({ targetCity: city })}
              placeholder={cities.length ? 'e.g. Bangalore' : 'Loading cities…'}
            />
          </div>
        )}

      </div>

      <LivePreview offer={offer} />
    </div>
  );
});

// ── Form root ─────────────────────────────────────────────────────────────────
export default function SalaryComparisonForm({ onResult }: Props) {
  const { user } = useAuth();
  const apiFetch = useApiFetch();
  const [offers, setOffers] = useState<OfferDraft[]>(() => [emptyOffer(), emptyOffer()]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Stable IDs for each offer - using useRef to persist across re-renders
  const offerIdsRef = useRef<string[]>([]);
  
  // Initialize IDs if not already set
  if (offerIdsRef.current.length !== offers.length) {
    const currentIds = offerIdsRef.current;
    const newIds = offers.map((_, i) => 
      currentIds[i] || `offer-${Date.now()}-${Math.random()}-${i}`
    );
    offerIdsRef.current = newIds;
  }

  const updateOffer = useCallback((i: number, patch: Partial<OfferDraft>) => {
    setOffers(prev => prev.map((o, idx) => idx === i ? { ...o, ...patch } : o));
  }, []);

  const addOffer = useCallback(() => {
    setOffers(prev => {
      if (prev.length >= 10) return prev;
      const newOffers = [...prev, emptyOffer()];
      // Add a new stable ID for the new offer
      offerIdsRef.current = [
        ...offerIdsRef.current,
        `offer-${Date.now()}-${Math.random()}-${prev.length}`
      ];
      return newOffers;
    });
  }, []);

  const removeOffer = useCallback((i: number) => {
    setOffers(prev => {
      if (prev.length <= 2) return prev;
      const newOffers = prev.filter((_, idx) => idx !== i);
      // Remove the ID at the same index
      offerIdsRef.current = offerIdsRef.current.filter((_, idx) => idx !== i);
      return newOffers;
    });
  }, []);

  // Stable per-offer handlers to prevent OfferCard re-renders
  const offerHandlers = useMemo(
    () => offers.map((_, i) => ({
      onChange: (patch: Partial<OfferDraft>) => updateOffer(i, patch),
      onRemove: () => removeOffer(i),
    })),
    // Handlers only depend on the offer count, not content — length is sufficient
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offers.length, updateOffer, removeOffer],
  );

  const completedCount = useMemo(() => offers.filter(isComplete).length, [offers]);
  const canSubmit = completedCount >= 2 && !loading;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const completeOffers = offers.filter(isComplete);
    if (completeOffers.length < 2) {
      setFormError('Fill in at least 2 complete offers (company name + city/WFH).');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(SALARY_COMPARISONS, {
        method: 'POST',
        body: JSON.stringify({
          offers: completeOffers.map(o => ({
            companyName: o.companyName.trim(),
            totalCtcLpa: o.totalCtcLpa,
            variablePct: o.variablePct,
            variableGuaranteed: o.variableGuaranteed,
            joiningBonusLpa: o.joiningBonusLpa,
            employerPf: o.employerPf,
            targetCity: o.isWfh ? 'WFH' : o.targetCity.trim(),
            isWfh: o.isWfh,
          })),
        }),
      });

      if (!res.ok) {
        let msg = `Server error ${res.status}`;
        try {
          const body = await res.json();
          if (Array.isArray(body.message)) msg = body.message.join('; ');
          else if (body.message) msg = body.message;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      const data: QuickSalaryComparisonResponseDto = await res.json();
      onResult(data);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }, [offers, apiFetch, onResult]);

  if (!user) {
    return (
      <div className="p2-form__error" role="alert">
        <span aria-hidden="true">⚠</span> Please sign in to compare offers.
      </div>
    );
  }

  return (
    <form className="p2-form" onSubmit={handleSubmit} noValidate>
      <div className="p2-form__offers">
        {offers.map((offer, i) => (
          <OfferCard
            key={offerIdsRef.current[i]}
            index={i}
            offer={offer}
            canRemove={offers.length > 2}
            onChange={offerHandlers[i].onChange}
            onRemove={offerHandlers[i].onRemove}
          />
        ))}
      </div>

      {offers.length < 10 && (
        <button type="button" className="p2-form__add" onClick={addOffer}>
          + Add offer ({offers.length}/10)
        </button>
      )}

      {formError && (
        <div className="p2-form__error" role="alert">
          <span aria-hidden="true">⚠</span> {formError}
        </div>
      )}

      <button className="p2-form__submit" type="submit" disabled={!canSubmit}>
        {loading
          ? <><span className="p1-form__spinner" aria-hidden="true" /> Comparing offers…</>
          : `Compare ${completedCount >= 2 ? completedCount : ''} offers →`
        }
      </button>
    </form>
  );
}
