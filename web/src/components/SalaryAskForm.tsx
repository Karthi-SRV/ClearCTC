import { useCallback, useState } from 'react';
import type { Phase1Response } from '../types';
import Combobox from './Combobox';
import { useCities } from '../context/CitiesContext';
import { useApiFetch } from '../hooks/useApiFetch';
import { SALARY_ASKS } from '../constants/api';

interface Props {
  onResult: (res: Phase1Response) => void;
  /** Pre-fill from logged-in user's profile */
  initialCity?: string;
  initialCtcLpa?: string;
  initialHikePct?: string;
}

interface Fields {
  currentCity: string;
  currentCtcLpa: string;
  expectedIncrementPct: string;
}

interface Errors {
  currentCity?: string;
  currentCtcLpa?: string;
  expectedIncrementPct?: string;
}

// Pure validation at module level (SRP)
function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.currentCity) e.currentCity = 'Required';
  const ctc = parseFloat(f.currentCtcLpa);
  if (!f.currentCtcLpa || isNaN(ctc) || ctc < 1 || ctc > 1000)
    e.currentCtcLpa = 'Enter 1–1000 LPA';
  const inc = parseInt(f.expectedIncrementPct, 10);
  if (!f.expectedIncrementPct || isNaN(inc) || inc < 0 || inc > 200)
    e.expectedIncrementPct = 'Enter 0–200';
  return e;
}

export default function SalaryAskForm({ onResult, initialCity, initialCtcLpa, initialHikePct }: Props) {
  const apiFetch = useApiFetch();
  const { cities } = useCities();
  const [fields, setFields] = useState<Fields>({
    currentCity: initialCity ?? '',
    currentCtcLpa: initialCtcLpa ?? '',
    expectedIncrementPct: initialHikePct ?? '30',
  });
  const [errors, setErrors]           = useState<Errors>({});
  const [loading, setLoading]         = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = useCallback((key: keyof Fields, value: any) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(fields);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    setServerError(null);
    try {
      const res = await apiFetch(SALARY_ASKS, {
        method: 'POST',
        body: JSON.stringify({
          currentCity: fields.currentCity,
          currentCtcLpa: parseFloat(fields.currentCtcLpa),
          expectedIncrementPct: parseInt(fields.expectedIncrementPct, 10),
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: Phase1Response = await res.json();
      onResult(data);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }, [fields, apiFetch, onResult]);

  return (
    <form className="p1-form" onSubmit={handleSubmit} noValidate>
      {/* Single-row: city | CTC | hike | button */}
      <div className="p1-form__row">

        <div className={`p1-form__row-field${errors.currentCity ? ' p1-form__field--error' : ''}`}>
          <label className="p1-form__label" htmlFor="currentCity">City</label>
          <Combobox<string>
            id="currentCity"
            options={cities}
            value={fields.currentCity}
            onChange={(city) => set('currentCity', city)}
            getOptionLabel={(c) => c}
            getOptionValue={(c) => c}
            error={errors.currentCity}
            placeholder="e.g. Bangalore"
            propagateQueryOnChange
            onAdd={async (q) => q}
            addingText="Use"
          />
          {errors.currentCity && (
            <span className="p1-form__error" role="alert">{errors.currentCity}</span>
          )}
        </div>

        <div className={`p1-form__row-field p1-form__row-field--sm${errors.currentCtcLpa ? ' p1-form__field--error' : ''}`}>
          <label className="p1-form__label" htmlFor="currentCtcLpa">CTC</label>
          <div className="p1-form__input-wrap p1-form__input-wrap--suffix">
            <input
              className="p1-form__input"
              id="currentCtcLpa"
              type="number"
              min="1"
              max="1000"
              step="0.5"
              placeholder="e.g. 28"
              value={fields.currentCtcLpa}
              onChange={(e) => set('currentCtcLpa', e.target.value)}
            />
            <span className="p1-form__suffix" aria-hidden="true">LPA</span>
          </div>
          {errors.currentCtcLpa && (
            <span className="p1-form__error" role="alert">{errors.currentCtcLpa}</span>
          )}
        </div>

        <div className={`p1-form__row-field p1-form__row-field--sm${errors.expectedIncrementPct ? ' p1-form__field--error' : ''}`}>
          <label className="p1-form__label" htmlFor="expectedIncrementPct">Hike</label>
          <div className="p1-form__input-wrap p1-form__input-wrap--suffix">
            <input
              className="p1-form__input"
              id="expectedIncrementPct"
              type="number"
              min="0"
              max="200"
              step="1"
              placeholder="e.g. 30"
              value={fields.expectedIncrementPct}
              onChange={(e) => set('expectedIncrementPct', e.target.value)}
            />
            <span className="p1-form__suffix" aria-hidden="true">%</span>
          </div>
          {errors.expectedIncrementPct && (
            <span className="p1-form__error" role="alert">{errors.expectedIncrementPct}</span>
          )}
        </div>

        <div className="p1-form__row-action">
          <label className="p1-form__label p1-form__label--invisible" aria-hidden="true">Go</label>
          <button className="p1-form__submit p1-form__submit--inline" type="submit" disabled={loading}>
            {loading
              ? <><span className="p1-form__spinner" aria-hidden="true" /> Calculating…</>
              : 'Calculate →'
            }
          </button>
        </div>

      </div>

      {serverError && (
        <div className="p1-form__server-error" role="alert">
          <span>⚠</span> {serverError}
        </div>
      )}
    </form>
  );
}
