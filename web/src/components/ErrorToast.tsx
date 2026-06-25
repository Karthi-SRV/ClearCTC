/**
 * ErrorToastContainer — renders the global toast stack.
 * Place this once in App.tsx outside the router so it survives route changes.
 */
import { useErrors, type AppError, type ErrorSeverity } from '../context/ErrorContext';

const ICONS: Record<ErrorSeverity, string> = {
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
  success: '✓',
};

function Toast({ toast, onDismiss }: { toast: AppError; onDismiss: () => void }) {
  return (
    <div
      className={`error-toast error-toast--${toast.severity}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <span className="error-toast__icon" aria-hidden="true">
        {ICONS[toast.severity]}
      </span>
      <span className="error-toast__message">{toast.message}</span>
      <button
        className="error-toast__close"
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}

export default function ErrorToastContainer() {
  const { errors, dismissError } = useErrors();

  if (errors.length === 0) return null;

  return (
    <div className="error-toast-container" aria-label="Notifications">
      {errors.map((e) => (
        <Toast key={e.id} toast={e} onDismiss={() => dismissError(e.id)} />
      ))}
    </div>
  );
}
