import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  currentCity: string;
  currentCtcLpa: number;
  basicPayLpa: number;
  variablePayLpa: number;
  isFixed: boolean;
  expectedHikePct: number;
  currentRole: string;
  preferredCities: string[];
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const LS_TOKEN = 'cc_token';
const LS_USER  = 'cc_user';

function loadFromStorage(): AuthState {
  try {
    const token = localStorage.getItem(LS_TOKEN);
    const raw   = localStorage.getItem(LS_USER);
    if (token && raw) {
      return { token, user: JSON.parse(raw) as AuthUser };
    }
  } catch {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  }
  return { token: null, user: null };
}

export const AuthContext = createContext<AuthContextValue>({
  token: null,
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(loadFromStorage);

  const login = useCallback((token: string, user: AuthUser) => {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(user));
    setState({ token, user });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    setState({ token: null, user: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, isAuthenticated: !!state.token, login, logout }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
