/**
 * ErrorBoundary — catches synchronous React render errors.
 *
 * Because React error boundaries must be class components, this one
 * uses a companion functional wrapper that reads the ErrorContext and
 * passes `pushError` in via a prop.
 */
import { Component, type ReactNode } from 'react';
import { useErrors } from '../context/ErrorContext';

interface Props {
  children: ReactNode;
  pushError: (message: string) => void;
}

interface State {
  hasError: boolean;
  message: string;
}

class ErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected rendering error occurred';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    const message =
      error instanceof Error ? error.message : 'An unexpected rendering error occurred';
    // Tag the error so the global window.error handler does not double-report it
    if (error instanceof Error) {
      (error as Error & { __reportedByErrorBoundary?: boolean }).__reportedByErrorBoundary = true;
    }
    this.props.pushError(message);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback" role="alert">
          <div className="error-boundary-fallback__card">
            <div className="error-boundary-fallback__icon" aria-hidden="true">⚠️</div>
            <h2 className="error-boundary-fallback__title">Something went wrong</h2>
            <p className="error-boundary-fallback__message">{this.state.message}</p>
            <button
              className="error-boundary-fallback__btn"
              type="button"
              onClick={this.handleReset}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Public wrapper — reads ErrorContext so the class component can call pushError. */
export default function ErrorBoundary({ children }: { children: ReactNode }) {
  const { pushError } = useErrors();
  return (
    <ErrorBoundaryInner pushError={(msg) => pushError(msg, { severity: 'error' })}>
      {children}
    </ErrorBoundaryInner>
  );
}
