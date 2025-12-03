/**
 * Retry utility with exponential backoff
 * Implements retry logic for failed operations with configurable attempts and delays
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  attempts: number;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'retryable' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};

/**
 * Calculate delay for retry attempt using exponential backoff
 */
const calculateDelay = (
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number => {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelay);
};

/**
 * Sleep utility for delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Check if error is retryable
 * By default, network errors and 5xx errors are retryable
 */
const isRetryableError = (error: unknown): boolean => {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // HTTP errors (if error has status property)
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    // Retry on 5xx errors and 429 (Too Many Requests)
    return status >= 500 || status === 429;
  }

  // Timeout errors
  if (error instanceof Error) {
    return error.name === 'TimeoutError' || error.message.includes('timeout');
  }

  return true; // Default to retryable
};

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry (should return a Promise)
 * @param options - Retry configuration options
 * @returns Promise with retry result
 * 
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => fetch('/api/data'),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 * 
 * if (result.success) {
 *   console.log('Data:', result.data);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts');
 * }
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = DEFAULT_OPTIONS.maxAttempts,
    initialDelay = DEFAULT_OPTIONS.initialDelay,
    maxDelay = DEFAULT_OPTIONS.maxDelay,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    retryable = isRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;

    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts,
      };
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!retryable(error)) {
        return {
          success: false,
          error,
          attempts,
        };
      }

      // Don't wait after last attempt
      if (attempt < maxAttempts) {
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
        
        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(attempt, error);
        }

        // Wait before retrying
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts,
  };
}

/**
 * Retry a fetch request with exponential backoff
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param retryOptions - Retry configuration
 * @returns Promise with Response or error
 */
export async function retryFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const result = await retryWithBackoff(
    () => fetch(url, options),
    retryOptions
  );

  if (result.success && result.data) {
    return result.data;
  }

  throw result.error || new Error('Fetch failed after retries');
}

/**
 * Retry configuration presets for common use cases
 */
export const retryPresets = {
  // Quick retry for user-initiated actions
  quick: {
    maxAttempts: 2,
    initialDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
  },
  // Standard retry for API calls
  standard: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  // Aggressive retry for critical operations
  aggressive: {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },
  // Sync operations - more attempts, longer delays
  sync: {
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },
};

