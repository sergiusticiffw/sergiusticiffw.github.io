/**
 * Logger utility that respects environment settings
 * Only logs in development mode to avoid console pollution in production
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;
// Allow forcing logs for debugging (e.g., OCR debugging)
const forceLogs = import.meta.env.VITE_FORCE_LOGS === 'true' || localStorage.getItem('forceLogs') === 'true';

/**
 * Logger that conditionally outputs based on environment
 * - Development: All logs are shown
 * - Production: Only errors are shown
 * - Force logs: Can be enabled via VITE_FORCE_LOGS or localStorage.setItem('forceLogs', 'true')
 */
export const logger: Logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment || forceLogs) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDevelopment || forceLogs) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    // Always log errors, even in production
    console.error(...args);
  },
  info: (...args: unknown[]) => {
    if (isDevelopment || forceLogs) {
      console.info(...args);
    }
  },
  debug: (...args: unknown[]) => {
    if (isDevelopment || forceLogs) {
      console.debug(...args);
    }
  },
};

/**
 * Performance logger for measuring execution time
 */
export const performanceLogger = {
  start: (label: string): void => {
    if (isDevelopment) {
      performance.mark(`${label}-start`);
    }
  },
  end: (label: string): void => {
    if (isDevelopment) {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
      const measure = performance.getEntriesByName(label)[0];
      logger.debug(`⏱️ ${label}: ${measure.duration.toFixed(2)}ms`);
    }
  },
};

/**
 * Group logger for organizing related logs
 */
export const groupLogger = {
  start: (label: string): void => {
    if (isDevelopment) {
      console.group(label);
    }
  },
  end: (): void => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },
  log: (...args: unknown[]): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
};

export default logger;

