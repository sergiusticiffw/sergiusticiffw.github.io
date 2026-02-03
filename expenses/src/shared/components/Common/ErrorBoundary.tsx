import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@shared/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
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

    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
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

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onReset }) => {
  // Fallback translations - Error Boundary must work even if context providers fail
  // This ensures the error UI always displays, even if the error broke context providers
  const getTranslation = (key: string): string => {
    const translations: Record<string, string> = {
      'error.boundary.title': 'Something went wrong',
      'error.boundary.message':
        'We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.',
      'error.boundary.details': 'Error Details (Development Only)',
      'error.boundary.tryAgain': 'Try Again',
      'error.boundary.reload': 'Reload Page',
    };
    return translations[key] || key;
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8 bg-[var(--background-color,#f5f5f5)]">
      <div className="max-w-[600px] w-full bg-white rounded-xl p-8 shadow-md text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-semibold text-[var(--text-color,#333)] mb-4">
          {getTranslation('error.boundary.title')}
        </h2>
        <p className="text-[var(--text-secondary,#666)] mb-6 leading-relaxed">
          {getTranslation('error.boundary.message')}
        </p>
        {error && import.meta.env.DEV && (
          <details className="my-6 text-left bg-[#f8f8f8] rounded-lg p-4">
            <summary className="cursor-pointer font-semibold text-[var(--text-color,#333)] mb-2 select-none hover:text-[var(--primary-color,#667eea)]">
              {getTranslation('error.boundary.details')}
            </summary>
            <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded overflow-x-auto text-sm font-mono whitespace-pre-wrap break-all mt-2">
              {error.toString()}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <div className="flex gap-4 justify-center mt-8">
          <button
            onClick={onReset}
            className="px-6 py-3 rounded-lg text-base font-medium cursor-pointer transition-all bg-[var(--primary-color,#667eea)] text-white hover:bg-[var(--primary-hover,#5568d3)] hover:-translate-y-px hover:shadow-lg"
          >
            {getTranslation('error.boundary.tryAgain')}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-lg text-base font-medium cursor-pointer transition-all bg-[var(--secondary-color,#e2e8f0)] text-[var(--text-color,#333)] hover:bg-[var(--secondary-hover,#cbd5e0)] hover:-translate-y-px"
          >
            {getTranslation('error.boundary.reload')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary;
