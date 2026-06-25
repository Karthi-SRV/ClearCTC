import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useErrors } from '../context/ErrorContext';

/**
 * Returns a fetch wrapper that:
 *  - Injects Authorization: Bearer <token> on every call
 *  - Defaults Content-Type to application/json when not set
 *  - On 401: logs the user out and redirects to /login
 *  - On 403: pushes a "Forbidden" error toast
 *  - On 5xx: pushes a server-error toast
 *  - On network failure: pushes a connectivity error toast
 */
export function useApiFetch() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const { pushError } = useErrors();

  return useCallback(
    async (url: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      let res: Response;
      try {
        res = await fetch(url, { ...init, headers });
      } catch {
        pushError('Network error — check your connection and try again.', { severity: 'error' });
        throw new Error('Network error');
      }

      if (res.status === 401) {
        logout();
        navigate('/login', { replace: true });
      } else if (res.status === 403) {
        pushError('You do not have permission to perform this action.', { severity: 'warning' });
      } else if (res.status >= 500) {
        pushError(`Server error (${res.status}) — please try again later.`, { severity: 'error' });
      }

      return res;
    },
    [token, logout, navigate, pushError],
  );
}
