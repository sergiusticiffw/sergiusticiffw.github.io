import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@shared/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** When this value changes (e.g. the current route), a shown error is cleared. */
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle React errors
 * Displays user-friendly error message and allows recovery
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to logger (will only log in development)
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  componentDidUpdate(prevProps: Props): void {
    // Navigating to another page should not keep showing the previous page's crash.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.handleReset();
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      );
    }

    return this.props.children;
  }
}

/**
 * Error fallback component that displays user-friendly error message
 * This component is independent of any context providers to ensure it always works
 */
interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

const FALLBACK_TRANSLATIONS: Record<'en' | 'ro', Record<string, string>> = {
  en: {
    'error.boundary.title': 'Something went wrong',
    'error.boundary.message':
      'We encountered an unexpected error. Please try again or reload the page. Your saved data is not affected.',
    'error.boundary.details': 'Error Details (Development Only)',
    'error.boundary.tryAgain': 'Try Again',
    'error.boundary.reload': 'Reload Page',
  },
  ro: {
    'error.boundary.title': 'Ceva nu a mers bine',
    'error.boundary.message':
      'A apărut o eroare neașteptată. Încearcă din nou sau reîncarcă pagina. Datele tale salvate nu sunt afectate.',
    'error.boundary.details': 'Detalii eroare (doar dezvoltare)',
    'error.boundary.tryAgain': 'Încearcă din nou',
    'error.boundary.reload': 'Reîncarcă pagina',
  },
};

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onReset }) => {
  // Error Boundary must work even if context providers fail, so read the
  // saved language directly instead of using the localization context.
  let language: 'en' | 'ro' = 'en';
  try {
    if (localStorage.getItem('language') === 'ro') language = 'ro';
  } catch {
    /* storage unavailable */
  }
  const getTranslation = (key: string): string =>
    FALLBACK_TRANSLATIONS[language][key] || key;

  return (
    <div
      role="alert"
      className="flex items-center justify-center min-h-[60vh] p-6"
    >
      <div className="max-w-[600px] w-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <h2 className="text-xl font-semibold text-app-primary mb-3">
          {getTranslation('error.boundary.title')}
        </h2>
        <p className="text-app-secondary mb-6 leading-relaxed">
          {getTranslation('error.boundary.message')}
        </p>
        {error && import.meta.env.DEV && (
          <details className="my-6 text-left rounded-lg bg-black/30 p-4">
            <summary className="cursor-pointer font-semibold text-app-primary mb-2 select-none">
              {getTranslation('error.boundary.details')}
            </summary>
            <pre className="text-app-secondary p-2 rounded overflow-x-auto text-sm font-mono whitespace-pre-wrap break-all mt-2">
              {error.toString()}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center mt-6">
          <button
            type="button"
            onClick={onReset}
            className="min-h-12 px-6 py-3 rounded-xl text-base font-semibold cursor-pointer bg-[var(--color-app-accent)] text-[var(--color-btn-on-accent)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-app-accent)]"
          >
            {getTranslation('error.boundary.tryAgain')}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-12 px-6 py-3 rounded-xl text-base font-semibold cursor-pointer border border-white/15 text-app-primary hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-app-accent)]"
          >
            {getTranslation('error.boundary.reload')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary;
