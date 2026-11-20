const pad = (n: number) => String(n).padStart(2, '0');

/** Format a Date as YYYY-MM-DD using the device's local calendar (not UTC). */
export const toLocalDateString = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export const localTodayString = (): string => toLocalDateString(new Date());
