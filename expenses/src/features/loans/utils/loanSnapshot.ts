/**
 * Loan schedule rate helpers.
 */
import type { PaymentLog } from './paydown-node';

function parseScheduleDateToUtcMs(date: string): number | null {
  const parts = (date ?? '').split('.');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map((p) => Number(p));
  if (!dd || !mm || !yyyy) return null;
  return Date.UTC(yyyy, mm - 1, dd);
}

function isScheduleRow(row: PaymentLog | { type?: string }): row is PaymentLog {
  return !('type' in row && (row as { type?: string }).type === 'annual_summary');
}

function parseRateFromRow(row: PaymentLog): number | null {
  const rateRaw = row.rate;
  if (rateRaw === '-' || rateRaw == null || rateRaw === '') return null;
  const r = typeof rateRaw === 'number' ? rateRaw : Number(rateRaw);
  return Number.isFinite(r) && r >= 0 ? r : null;
}

/** Latest effective rate in the schedule on or before asOfDate (defaults to today). */
export function getEffectiveRateFromSchedule(
  schedule: PaymentLog[],
  asOfDate?: Date
): number | null {
  if (!schedule.length) return null;

  const todayUtc = asOfDate
    ? Date.UTC(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate())
    : Date.UTC(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate()
      );

  for (let i = schedule.length - 1; i >= 0; i--) {
    const row = schedule[i];
    if (!isScheduleRow(row) || !row.date) continue;
    const rowUtc = parseScheduleDateToUtcMs(row.date);
    if (rowUtc == null || rowUtc > todayUtc) continue;
    const r = parseRateFromRow(row);
    if (r != null) return r;
  }

  for (let i = schedule.length - 1; i >= 0; i--) {
    const row = schedule[i];
    if (!isScheduleRow(row)) continue;
    const r = parseRateFromRow(row);
    if (r != null) return r;
  }

  return null;
}
