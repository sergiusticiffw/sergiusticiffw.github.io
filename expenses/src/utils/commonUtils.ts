import { useState } from 'react';
import { notificationType } from './constants';
import { AuthState, DataState, NodeData } from '../type/types';

// Form validation utilities
export const validateRequired = (value: string | number): boolean => {
  return value !== null && value !== undefined && value !== '';
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateNumber = (value: string | number): boolean => {
  return !isNaN(Number(value)) && Number(value) >= 0;
};

// Date utilities
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().slice(0, 10);
};

export const getCurrentDate = (): string => {
  return formatDate(new Date());
};

export const formatDateForDisplay = (
  date: string
): { day: number; month: string } => {
  const dateObj = new Date(date);
  return {
    day: dateObj.getDate(),
    month: dateObj.toLocaleDateString('en-US', { month: 'short' }),
  };
};

// Number formatting
export const formatNumber = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString();
};

export const formatCurrency = (
  value: number | string,
  currency: string = 'RON'
): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${num.toLocaleString()} ${currency}`;
};

// API request utilities
export const createApiHeaders = (token: string): Headers => {
  return new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'JWT-Authorization': `Bearer ${token}`,
  });
};

export const createApiRequest = (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  token: string,
  body?: any
): RequestInit => {
  const options: RequestInit = {
    method,
    headers: createApiHeaders(token),
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return options;
};

// Form submission utilities
export const handleFormSubmission = async (
  url: string,
  method: 'POST' | 'PATCH',
  data: any,
  token: string,
  dataDispatch: any,
  dispatch: any,
  onSuccess: () => void,
  showNotification: (message: string, type: string) => void,
  successMessage: string = 'Success!',
  errorMessage: string = 'Something went wrong, please try again.'
): Promise<void> => {
  try {
    const options = createApiRequest(method, token, data);
    const response = await fetch(url, options);
    const result: NodeData = await response.json();

    if (result.nid) {
      onSuccess();
      showNotification(successMessage, notificationType.SUCCESS);
    } else {
      showNotification(errorMessage, notificationType.ERROR);
    }
  } catch (error) {
    console.error('Form submission error:', error);
    showNotification(errorMessage, notificationType.ERROR);
  }
};

// Loading state utilities
export const createLoadingState = () => {
  const [isLoading, setIsLoading] = useState(false);

  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(false);

  return { isLoading, startLoading, stopLoading };
};

// Local storage utilities
export const getFromLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return defaultValue;
  }
};

export const setToLocalStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
  }
};

// Array utilities
export const sortByDate = <T extends { dt?: string; cr?: number }>(
  items: T[]
): T[] => {
  return items.sort((a, b) => {
    const dateComparison =
      new Date(b.dt || '').getTime() - new Date(a.dt || '').getTime();
    if (dateComparison !== 0) {
      return dateComparison;
    }
    return (b.cr || 0) - (a.cr || 0);
  });
};

export const filterByDateRange = <T extends { dt?: string }>(
  items: T[],
  startDate: string,
  endDate: string
): T[] => {
  return items.filter((item) => {
    if (!item.dt) return false;
    const itemDate = new Date(item.dt);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return itemDate >= start && itemDate <= end;
  });
};

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utility
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Error handling utilities
export const handleApiError = (
  error: any,
  showNotification: (message: string, type: string) => void,
  customMessage?: string
): void => {
  console.error('API Error:', error);
  const message = customMessage || 'An error occurred. Please try again.';
  showNotification(message, notificationType.ERROR);
};

// Validation utilities
export const validateForm = (
  formData: Record<string, any>,
  requiredFields: string[]
): string[] => {
  const errors: string[] = [];

  requiredFields.forEach((field) => {
    if (!validateRequired(formData[field])) {
      errors.push(`${field} is required`);
    }
  });

  return errors;
};
