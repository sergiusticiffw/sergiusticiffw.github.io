const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const LOCALES: Record<string, string> = { en: 'en-US', ro: 'ro-RO' };

/**
 * Month keys are stored as English "October 2026" (they are data keys used for
 * grouping and budgets, so they must not change). This returns the same month
 * for display in the user's language, e.g. "Octombrie 2026". Unknown formats
 * are returned unchanged.
 */
export function localizeMonthKey(key: string, language: string): string {
  const match = /^([A-Za-z]+) (\d{4})$/.exec(key || '');
  if (!match) return key;
  const monthIndex = ENGLISH_MONTHS.indexOf(match[1]);
  if (monthIndex === -1) return key;
  const date = new Date(Number(match[2]), monthIndex, 1);
  const label = date.toLocaleDateString(LOCALES[language] || 'en-US', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
