/**
 * ErrorContext — global error/notification system.
 *
 * Usage:
 *   const { pushError } = useErrors();
 *   pushError('Something went wrong', { severity: 'error' });
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ErrorSeverity = 'error' | 'warning' | 'info' | 'success';

export interface AppError {
  id: string;
  message: string;
  severity: ErrorSeverity;
  /** Unix ms when this error was created */
  createdAt: number;
}

export interface PushErrorOptions {
  severity?: ErrorSeverity;
  /** Auto-dismiss after this many ms. Defaults: error=6000, others=4000. Set 0 to disable. */
  ttl?: number;
}

interface ErrorContextValue {
  errors: AppError[];
  pushError: (message: string, options?: PushErrorOptions) => void;
  dismissError: (id: string) => void;
  clearErrors: () => void;
}

const ErrorContext = createContext<ErrorContextValue>({
  errors: [],
  pushError: () => {},
  dismissError: () => {},
  clearErrors: () => {},
});

const MAX_TOASTS = 5;

let _idCounter = 0;
function nextId(): string {
  return `err-${Date.now()}-${++_idCounter}`;
}

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<AppError[]>([]);

  // Use a ref to the latest setErrors so window handlers don't capture stale closures
  const setErrorsRef = useRef(setErrors);
  setErrorsRef.current = setErrors;

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const dismissRef = useRef(dismissError);
  dismissRef.current = dismissError;

  const pushError = useCallback((message: string, options: PushErrorOptions = {}) => {
    const { severity = 'error', ttl } = options;
    const resolvedTtl = ttl !== undefined ? ttl : severity === 'error' ? 6_000 : 4_000;

    const id = nextId();
    const entry: AppError = { id, message, severity, createdAt: Date.now() };

    setErrorsRef.current((prev) => {
      // Keep at most MAX_TOASTS — drop the oldest if at capacity
      const updated = [...prev, entry];
      return updated.length > MAX_TOASTS ? updated.slice(updated.length - MAX_TOASTS) : updated;
    });

    if (resolvedTtl > 0) {
      setTimeout(() => dismissRef.current(id), resolvedTtl);
    }
  }, []);

  const clearErrors = useCallback(() => setErrors([]), []);

  // Register global unhandled-rejection / error listeners
  useEffect(() => {
    function handleUnhandledRejection(ev: PromiseRejectionEvent) {
      const msg =
        ev.reason instanceof Error
          ? ev.reason.message
          : typeof ev.reason === 'string'
            ? ev.reason
            : 'An unexpected error occurred';
      pushError(msg, { severity: 'error' });
    }

    function handleGlobalError(ev: ErrorEvent) {
      // Avoid double-reporting errors that React already caught via ErrorBoundary
      if (ev.error && ev.error.__reportedByErrorBoundary) return;
      pushError(ev.message || 'An unexpected error occurred', { severity: 'error' });
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleGlobalError);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleGlobalError);
    };
  }, [pushError]);

  const value = useMemo<ErrorContextValue>(
    () => ({ errors, pushError, dismissError, clearErrors }),
    [errors, pushError, dismissError, clearErrors],
  );

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
}

export function useErrors(): ErrorContextValue {
  return useContext(ErrorContext);
}
