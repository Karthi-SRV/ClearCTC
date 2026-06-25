import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../context/AuthContext';
import { AUTH_LOGIN } from '../constants/api';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = 'Enter a valid email address';
    if (password.length < 8)
      e.password = 'Password must be at least 8 characters';
    return e;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(AUTH_LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json() as { accessToken?: string; user?: AuthUser; message?: string | string[] };

      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? 'Login failed');
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
  }

  return (
    <main className="page auth-page">
      <h1>Welcome back</h1>
      <p className="subtitle">Sign in to access your compensation insights.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>

        <div className={`auth-field${fieldErrors.email ? ' auth-field--error' : ''}`}>
          <label className="auth-field__label" htmlFor="email">Email</label>
          <input
            id="email"
            className="auth-field__input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
          />
          {fieldErrors.email && <span className="auth-field__error">{fieldErrors.email}</span>}
        </div>

        <div className={`auth-field${fieldErrors.password ? ' auth-field--error' : ''}`}>
          <label className="auth-field__label" htmlFor="password">Password</label>
          <input
            id="password"
            className="auth-field__input"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
          />
          {fieldErrors.password && <span className="auth-field__error">{fieldErrors.password}</span>}
        </div>

        {serverError && (
          <div className="auth-server-error" role="alert">
            <span aria-hidden="true">⚠</span> {serverError}
          </div>
        )}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? (
            <><span className="p1-form__spinner" aria-hidden="true" /> Signing in…</>
          ) : (
            'Sign in →'
          )}
        </button>

        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Create one</Link>
        </p>
      </form>
    </main>
  );
}
