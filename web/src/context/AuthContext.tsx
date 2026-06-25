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

export const AuthContext = createContext<AuthContextValue>({
  token: null,
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Auth state lives in React memory only — no browser storage.
  // Page refresh requires re-login; this is intentional per architecture spec.
  const [state, setState] = useState<AuthState>({ token: null, user: null });

  const login = useCallback((token: string, user: AuthUser) => {
    setState({ token, user });
  }, []);

  const logout = useCallback(() => {
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
