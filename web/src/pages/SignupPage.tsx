import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../context/AuthContext';
import { useCities } from '../context/CitiesContext';
import { AUTH_SIGNUP } from '../constants/api';

interface FormState {
  email: string;
  password: string;
  currentCity: string;
  basicPayLpa: string;
  variablePayLpa: string;
  isFixed: boolean;
  expectedHikePct: string;
  currentRole: string;
  preferredCities: string[];
}

interface FieldErrors {
  email?: string;
  password?: string;
  currentCity?: string;
  basicPayLpa?: string;
  variablePayLpa?: string;
  expectedHikePct?: string;
  currentRole?: string;
}

// Pure validation — no side-effects, defined at module level (SRP)
function validate(f: FormState): FieldErrors {
  const e: FieldErrors = {};
  if (!f.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))
    e.email = 'Enter a valid email address';
  if (f.password.length < 8)
    e.password = 'Password must be at least 8 characters';
  if (!f.currentCity.trim())
    e.currentCity = 'Select your current city';
  if (!f.basicPayLpa || isNaN(Number(f.basicPayLpa)) || Number(f.basicPayLpa) <= 0)
    e.basicPayLpa = 'Enter a valid basic pay';
  if (!f.isFixed && (isNaN(Number(f.variablePayLpa)) || Number(f.variablePayLpa) < 0))
    e.variablePayLpa = 'Enter a valid variable pay (0 or above)';
  if (!f.expectedHikePct || isNaN(Number(f.expectedHikePct)) || Number(f.expectedHikePct) < 0)
    e.expectedHikePct = 'Enter a valid hike percentage';
  if (!f.currentRole.trim())
    e.currentRole = 'Enter your current role';
  return e;
}

// ── Multi-select dropdown (ISP: receives only what it needs) ──────────────────
interface MultiSelectProps {
  options: string[];
  selected: string[];
  onToggle: (city: string) => void;
  onClear: () => void;
  placeholder?: string;
}

const MultiCitySelect = memo(function MultiCitySelect({
  options,
  selected,
  onToggle,
  onClear,
  placeholder = 'Select cities…',
}: MultiSelectProps) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const containerRef        = useRef<HTMLDivElement>(null);
  const searchRef           = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      search.trim()
        ? options.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
        : options,
    [options, search],
  );

  const openDropdown = useCallback(() => {
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 0);
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
      setSearch('');
    }
  }, []);

  return (
    <div className="msel" ref={containerRef} onBlur={handleBlur}>
      {/* Trigger */}
      <button
        type="button"
        className={`msel__trigger${open ? ' msel__trigger--open' : ''}`}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="msel__trigger-text">
          {selected.length === 0 ? (
            <span className="msel__placeholder">{placeholder}</span>
          ) : (
            <span className="msel__count">
              {selected.length} {selected.length === 1 ? 'city' : 'cities'} selected
            </span>
          )}
        </span>
        <span className="msel__chevron" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="msel__panel"
          role="listbox"
          aria-multiselectable="true"
          aria-label="Preferred cities"
        >
          <div className="msel__search-wrap">
            <input
              ref={searchRef}
              className="msel__search"
              type="search"
              placeholder="Search cities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search cities"
            />
          </div>

          <ul className="msel__list">
            {filtered.length === 0 ? (
              <li className="msel__empty">No cities match</li>
            ) : (
              filtered.map((city) => {
                const checked = selected.includes(city);
                return (
                  <li
                    key={city}
                    className={`msel__option${checked ? ' msel__option--checked' : ''}`}
                    role="option"
                    aria-selected={checked}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onToggle(city);
                    }}
                  >
                    <span className="msel__checkbox" aria-hidden="true">
                      {checked ? '✓' : ''}
                    </span>
                    {city}
                  </li>
                );
              })
            )}
          </ul>

          {selected.length > 0 && (
            <div className="msel__footer">
              <button
                type="button"
                className="msel__clear"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onClear();
                }}
              >
                Clear all
              </button>
              <button
                type="button"
                className="msel__done"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  setSearch('');
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="msel__tags" aria-label="Selected cities">
          {selected.map((city) => (
            <span key={city} className="msel__tag">
              {city}
              <button
                type="button"
                className="msel__tag-remove"
                onClick={() => onToggle(city)}
                aria-label={`Remove ${city}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

// ── Main signup page ──────────────────────────────────────────────────────────
export default function SignupPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  // Cities from context — fetched once at app level, no duplicate requests
  const { cities: allCities, loading: citiesLoading } = useCities();

  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    currentCity: '',
    basicPayLpa: '',
    variablePayLpa: '',
    isFixed: false,
    expectedHikePct: '',
    currentRole: '',
    preferredCities: [],
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);

  // Current city combobox
  const [citySearch, setCitySearch] = useState('');
  const [cityOpen, setCityOpen]     = useState(false);

  const filteredCurrentCities = useMemo(
    () =>
      citySearch.trim()
        ? allCities.filter((c) => c.toLowerCase().includes(citySearch.toLowerCase()))
        : allCities,
    [citySearch, allCities],
  );

  const totalCtcLpa = useMemo(() => {
    const b = Number(form.basicPayLpa) || 0;
    const v = form.isFixed ? 0 : Number(form.variablePayLpa) || 0;
    return Math.round((b + v) * 10) / 10;
  }, [form.basicPayLpa, form.variablePayLpa, form.isFixed]);

  // Generic field setter — clears the field's error on change (OCP: extend fields without touching handler)
  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const selectCurrentCity = useCallback((city: string) => {
    set('currentCity', city);
    setCitySearch(city);
    setCityOpen(false);
  }, [set]);

  const togglePreferredCity = useCallback((city: string) => {
    setForm((prev) => ({
      ...prev,
      preferredCities: prev.preferredCities.includes(city)
        ? prev.preferredCities.filter((c) => c !== city)
        : [...prev.preferredCities, city],
    }));
  }, []);

  const clearPreferredCities = useCallback(() => {
    setForm((p) => ({ ...p, preferredCities: [] }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);

    const errors = validate(form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    const basicPayLpa    = Number(form.basicPayLpa);
    const variablePayLpa = form.isFixed ? 0 : Number(form.variablePayLpa);

    setLoading(true);
    try {
      const res = await fetch(AUTH_SIGNUP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          currentCity: form.currentCity,
          basicPayLpa,
          variablePayLpa,
          currentCtcLpa: Math.round((basicPayLpa + variablePayLpa) * 10) / 10,
          isFixed: form.isFixed,
          expectedHikePct: Number(form.expectedHikePct),
          currentRole: form.currentRole.trim(),
          preferredCities: form.preferredCities,
        }),
      });

      const data = (await res.json()) as {
        accessToken?: string;
        user?: AuthUser;
        message?: string | string[];
      };

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(', ')
          : (data.message ?? 'Signup failed');
        setServerError(msg);
        return;
      }

      login(data.accessToken!, data.user!);
      navigate('/', { replace: true });
    } catch {
      setServerError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }, [form, login, navigate]);

  return (
    <main className="page auth-page">
      <h1>Create account</h1>
      <p className="subtitle">
        Tell us about yourself so we can personalise your compensation insights.
      </p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* ── Account ──────────────────────────────────────── */}
        <fieldset className="auth-fieldset">
          <legend className="auth-fieldset__legend">Account</legend>

          <div className={`auth-field${fieldErrors.email ? ' auth-field--error' : ''}`}>
            <label className="auth-field__label" htmlFor="su-email">Email</label>
            <input
              id="su-email"
              className="auth-field__input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
            {fieldErrors.email && <span className="auth-field__error">{fieldErrors.email}</span>}
          </div>

          <div className={`auth-field${fieldErrors.password ? ' auth-field--error' : ''}`}>
            <label className="auth-field__label" htmlFor="su-password">Password</label>
            <input
              id="su-password"
              className="auth-field__input"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
            {fieldErrors.password && <span className="auth-field__error">{fieldErrors.password}</span>}
          </div>
        </fieldset>

        {/* ── About you ────────────────────────────────────── */}
        <fieldset className="auth-fieldset">
          <legend className="auth-fieldset__legend">About you</legend>

          <div className={`auth-field${fieldErrors.currentRole ? ' auth-field--error' : ''}`}>
            <label className="auth-field__label" htmlFor="su-role">Current role</label>
            <input
              id="su-role"
              className="auth-field__input"
              type="text"
              placeholder="e.g. Senior Software Engineer"
              value={form.currentRole}
              onChange={(e) => set('currentRole', e.target.value)}
            />
            {fieldErrors.currentRole && <span className="auth-field__error">{fieldErrors.currentRole}</span>}
          </div>

          {/* Current city — single combobox */}
          <div className={`auth-field${fieldErrors.currentCity ? ' auth-field--error' : ''}`}>
            <label className="auth-field__label" htmlFor="su-city">Current city</label>
            <div
              className="city-combo"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setCityOpen(false);
              }}
            >
              <div className="p1-form__input-wrap">
                <input
                  id="su-city"
                  className="auth-field__input"
                  type="text"
                  autoComplete="off"
                  placeholder="Search city…"
                  value={citySearch}
                  onChange={(e) => {
                    setCitySearch(e.target.value);
                    setCityOpen(true);
                    set('currentCity', '');
                  }}
                  onFocus={() => setCityOpen(true)}
                  aria-autocomplete="list"
                  aria-expanded={cityOpen}
                  aria-haspopup="listbox"
                />
                <span className="city-combo__chevron" aria-hidden="true">▾</span>
              </div>
              {cityOpen && filteredCurrentCities.length > 0 && (
                <ul className="city-combo__list" role="listbox" aria-label="Cities">
                  {filteredCurrentCities.slice(0, 8).map((c) => (
                    <li
                      key={c}
                      className={`city-combo__option${form.currentCity === c ? ' city-combo__option--active' : ''}`}
                      role="option"
                      aria-selected={form.currentCity === c}
                      onMouseDown={() => selectCurrentCity(c)}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {fieldErrors.currentCity && <span className="auth-field__error">{fieldErrors.currentCity}</span>}
          </div>

          {/* Preferred cities — multi-select dropdown */}
          <div className="auth-field">
            <label className="auth-field__label">
              Preferred cities{' '}
              <span className="auth-field__optional">(optional)</span>
            </label>
            <MultiCitySelect
              options={allCities}
              selected={form.preferredCities}
              onToggle={togglePreferredCity}
              onClear={clearPreferredCities}
              placeholder={citiesLoading ? 'Loading cities…' : "Select cities you'd relocate to…"}
            />
          </div>
        </fieldset>

        {/* ── Compensation ──────────────────────────────────── */}
        <fieldset className="auth-fieldset">
          <legend className="auth-fieldset__legend">Compensation</legend>

          <label className="auth-toggle">
            <input
              type="checkbox"
              className="p2-toggle__input"
              checked={form.isFixed}
              onChange={(e) => {
                set('isFixed', e.target.checked);
                if (e.target.checked) set('variablePayLpa', '0');
              }}
            />
            <span className="p2-toggle__track" aria-hidden="true" />
            <span className="auth-toggle__label">My CTC is fully fixed (no variable component)</span>
          </label>

          <div className="auth-row">
            <div className={`auth-field${fieldErrors.basicPayLpa ? ' auth-field--error' : ''}`}>
              <label className="auth-field__label" htmlFor="su-basic">Basic pay</label>
              <div className="auth-field__input-wrap auth-field__input-wrap--suffix">
                <input
                  id="su-basic"
                  className="auth-field__input"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g. 10"
                  value={form.basicPayLpa}
                  onChange={(e) => set('basicPayLpa', e.target.value)}
                />
                <span className="auth-field__suffix">LPA</span>
              </div>
              {fieldErrors.basicPayLpa && <span className="auth-field__error">{fieldErrors.basicPayLpa}</span>}
            </div>

            {!form.isFixed && (
              <div className={`auth-field${fieldErrors.variablePayLpa ? ' auth-field--error' : ''}`}>
                <label className="auth-field__label" htmlFor="su-variable">Variable pay</label>
                <div className="auth-field__input-wrap auth-field__input-wrap--suffix">
                  <input
                    id="su-variable"
                    className="auth-field__input"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 2"
                    value={form.variablePayLpa}
                    onChange={(e) => set('variablePayLpa', e.target.value)}
                  />
                  <span className="auth-field__suffix">LPA</span>
                </div>
                {fieldErrors.variablePayLpa && (
                  <span className="auth-field__error">{fieldErrors.variablePayLpa}</span>
                )}
              </div>
            )}
          </div>

          {(Number(form.basicPayLpa) > 0 || Number(form.variablePayLpa) > 0) && (
            <div className="auth-ctc-summary">
              Total CTC: <strong>{totalCtcLpa} LPA</strong>
              {!form.isFixed && Number(form.variablePayLpa) > 0 && (
                <span className="auth-ctc-summary__detail">
                  {' '}({form.basicPayLpa} fixed + {form.variablePayLpa} variable)
                </span>
              )}
            </div>
          )}

          <div className={`auth-field${fieldErrors.expectedHikePct ? ' auth-field--error' : ''}`}>
            <label className="auth-field__label" htmlFor="su-hike">Expected hike</label>
            <div className="auth-field__input-wrap auth-field__input-wrap--suffix">
              <input
                id="su-hike"
                className="auth-field__input"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 30"
                value={form.expectedHikePct}
                onChange={(e) => set('expectedHikePct', e.target.value)}
              />
              <span className="auth-field__suffix">%</span>
            </div>
            {fieldErrors.expectedHikePct && (
              <span className="auth-field__error">{fieldErrors.expectedHikePct}</span>
            )}
          </div>
        </fieldset>

        {serverError && (
          <div className="auth-server-error" role="alert">
            <span aria-hidden="true">⚠</span> {serverError}
          </div>
        )}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="p1-form__spinner" aria-hidden="true" /> Creating account…
            </>
          ) : (
            'Create account →'
          )}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
