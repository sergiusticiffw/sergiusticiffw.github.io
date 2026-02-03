/**
 * Input Sanitization Utilities
 * Provides secure input sanitization using DOMPurify
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize text input - removes HTML tags and dangerous content
 * Use for: text inputs, descriptions, titles, etc.
 */
export const sanitizeText = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove all HTML tags and return plain text
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content but remove tags
  });
};

/**
 * Sanitize HTML content - allows safe HTML tags
 * Use for: rich text editors, content that needs HTML formatting
 */
export const sanitizeHTML = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Allow only safe HTML tags
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ],
    ALLOWED_ATTR: ['class'],
    ALLOW_DATA_ATTR: false,
  });
};

/**
 * Sanitize URL - validates and sanitizes URLs
 * Use for: links, image sources, etc.
 */
export const sanitizeURL = (url: string | null | undefined): string => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Remove dangerous protocols and sanitize
  const sanitized = DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  // Validate URL format
  try {
    const urlObj = new URL(sanitized);
    // Only allow http, https protocols
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      return sanitized;
    }
    return '';
  } catch {
    // If URL is relative, just return sanitized string
    return sanitized;
  }
};

/**
 * Sanitize number input - ensures only valid numbers
 * Use for: amount, quantity, etc.
 */
export const sanitizeNumber = (
  input: string | number | null | undefined
): string => {
  if (input === null || input === undefined) {
    return '';
  }

  if (typeof input === 'number') {
    return input.toString();
  }

  if (typeof input !== 'string') {
    return '';
  }

  // Remove all non-numeric characters except decimal point and minus sign
  const cleaned = input.replace(/[^\d.-]/g, '');

  // Validate number format
  if (cleaned === '' || cleaned === '-' || cleaned === '.') {
    return cleaned; // Allow partial input during typing
  }

  // Check if it's a valid number
  const num = parseFloat(cleaned);
  if (isNaN(num)) {
    return '';
  }

  return cleaned;
};

/**
 * Sanitize date input - ensures valid date format
 * Use for: date fields
 */
export const sanitizeDate = (input: string | null | undefined): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove all non-date characters (keep only digits, dashes, slashes)
  const cleaned = input.replace(/[^\d/-]/g, '');

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateRegex.test(cleaned)) {
    // Validate that it's a real date
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return cleaned;
    }
  }

  // Return cleaned input (might be partial during typing)
  return cleaned;
};

/**
 * Sanitize form field value based on field type
 */
export const sanitizeFormField = (
  value: string | number | null | undefined,
  fieldType: 'text' | 'number' | 'date' | 'email' | 'url' | 'textarea' = 'text'
): string => {
  if (value === null || value === undefined) {
    return '';
  }

  switch (fieldType) {
    case 'number':
      return sanitizeNumber(value);
    case 'date':
      return sanitizeDate(String(value));
    case 'email':
      // For email, just sanitize text and validate format
      const sanitized = sanitizeText(String(value));
      // Basic email validation (can be enhanced)
      if (sanitized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
        return sanitized;
      }
      return sanitized; // Return even if invalid (user might be typing)
    case 'url':
      return sanitizeURL(String(value));
    case 'textarea':
    case 'text':
    default:
      return sanitizeText(String(value));
  }
};

/**
 * Sanitize object with form data
 * Recursively sanitizes all string values in an object
 */
export const sanitizeFormData = <T extends Record<string, any>>(
  data: T,
  fieldTypes?: Record<string, 'text' | 'number' | 'date' | 'email' | 'url'>
): T => {
  const sanitized = { ...data };

  for (const key in sanitized) {
    if (sanitized.hasOwnProperty(key)) {
      const value = sanitized[key];
      const fieldType = fieldTypes?.[key] || 'text';

      if (typeof value === 'string') {
        sanitized[key] = sanitizeFormField(value, fieldType);
      } else if (typeof value === 'number') {
        // Keep numbers as-is, but validate
        sanitized[key] = isNaN(value) ? 0 : value;
      } else if (Array.isArray(value)) {
        // Sanitize array elements if they are strings
        sanitized[key] = value.map((item) =>
          typeof item === 'string' ? sanitizeText(item) : item
        );
      } else if (value && typeof value === 'object') {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeFormData(value, fieldTypes);
      }
    }
  }

  return sanitized;
};

/**
 * Sanitize data from API before displaying
 * Use this when rendering user-generated content from the server
 */
export const sanitizeForDisplay = (
  content: string | null | undefined
): string => {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // For display, we can allow some safe HTML if needed
  // But by default, just sanitize to plain text for security
  return sanitizeText(content);
};
