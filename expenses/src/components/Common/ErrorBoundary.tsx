import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@utils/logger';
import './ErrorBoundary.scss';

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
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
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
      'error.boundary.message': 'We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.',
      'error.boundary.details': 'Error Details (Development Only)',
      'error.boundary.tryAgain': 'Try Again',
      'error.boundary.reload': 'Reload Page',
    };
    return translations[key] || key;
  };

  return (
    <div className="error-boundary">
      <div className="error-boundary__container">
        <div className="error-boundary__icon">⚠️</div>
        <h2 className="error-boundary__title">
          {getTranslation('error.boundary.title')}
        </h2>
        <p className="error-boundary__message">
          {getTranslation('error.boundary.message')}
        </p>
        {error && import.meta.env.DEV && (
          <details className="error-boundary__details">
            <summary className="error-boundary__summary">
              {getTranslation('error.boundary.details')}
            </summary>
            <pre className="error-boundary__stack">
              {error.toString()}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <div className="error-boundary__actions">
          <button 
            onClick={onReset} 
            className="error-boundary__button error-boundary__button--primary"
          >
            {getTranslation('error.boundary.tryAgain')}
          </button>
          <button 
            onClick={() => window.location.reload()} 
            className="error-boundary__button error-boundary__button--secondary"
          >
            {getTranslation('error.boundary.reload')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary;

