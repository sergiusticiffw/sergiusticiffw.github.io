/**
 * Loan schedule helpers: upcoming payments, milestones, interest totals.
 */
import type { PaydownResult, PaymentLog } from './paydown-node';

export interface UpcomingPayment {
  date: string;
  installment: number;
  daysUntil: number;
  isOverdue: boolean;
}

export interface LoanMilestone {
  id: '25' | '50' | '75' | '100';
  label: string;
  percent: number;
  date: string | null;
  completed: boolean;
}

function parseScheduleInstallment(
  value: number | string | undefined
): number | null {
  if (value == null || value === '-' || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

function parseScheduleDateToUtcMs(date: string): number | null {
  const parts = (date ?? '').split('.');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map((p) => Number(p));
  if (!dd || !mm || !yyyy) return null;
  return Date.UTC(yyyy, mm - 1, dd);
}

function parseSchedulePrincipal(value: number | string | undefined): number {
  if (value == null || value === '-' || value === '') return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function isScheduleRow(row: PaymentLog | { type?: string }): row is PaymentLog {
  return !('type' in row && (row as { type?: string }).type === 'annual_summary');
}

export function getTotalInterest(paydown: PaydownResult | null): number {
  if (!paydown) return 0;
  return (paydown.sum_of_interests ?? 0) + (paydown.unpaid_interest ?? 0);
}

function todayDdMmYyyy(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function getDaysUntil(date: string): number {
  const targetMs = parseScheduleDateToUtcMs(date);
  const todayMs = parseScheduleDateToUtcMs(todayDdMmYyyy());
  if (targetMs == null || todayMs == null) return 0;
  return Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}

export function getUpcomingPayments(
  schedule: PaymentLog[],
  count = 4
): UpcomingPayment[] {
  const results: UpcomingPayment[] = [];

  for (const row of schedule) {
    if (!isScheduleRow(row)) continue;
    if (row.was_payed === true) continue;
    const installment = parseScheduleInstallment(row.installment);
    if (installment == null || !row.date) continue;

    const daysUntil = getDaysUntil(row.date);
    results.push({
      date: row.date,
      installment,
      daysUntil,
      isOverdue: daysUntil < 0,
    });

    if (results.length >= count) break;
  }

  return results;
}

export function calculateMilestones(
  schedule: PaymentLog[],
  totalPrincipal: number,
  principalPaid: number,
  remainingPrincipal?: number
): LoanMilestone[] {
  const thresholds: Array<{ id: LoanMilestone['id']; percent: number }> = [
    { id: '25', percent: 25 },
    { id: '50', percent: 50 },
    { id: '75', percent: 75 },
    { id: '100', percent: 100 },
  ];

  if (totalPrincipal <= 0) {
    return thresholds.map((t) => ({
      id: t.id,
      label: `${t.percent}%`,
      percent: t.percent,
      date: null,
      completed: false,
    }));
  }

  const progressPercent = Math.min(100, (principalPaid / totalPrincipal) * 100);

  const loanPaidOff =
    (remainingPrincipal != null && remainingPrincipal <= 0.01) ||
    schedule.some(
      (row) =>
        isScheduleRow(row) &&
        row.was_payed === true &&
        parseSchedulePrincipal(row.principal) <= 0.01
    );

  const milestoneDates: Record<string, string | null> = {};
  let cumulativePrincipalPaid = 0;
  const initialPrincipal = totalPrincipal;

  for (const row of schedule) {
    if (!isScheduleRow(row)) continue;
    const rowPrincipal = parseSchedulePrincipal(row.principal);

    if (row.was_payed === true) {
      cumulativePrincipalPaid = Math.max(
        cumulativePrincipalPaid,
        initialPrincipal - rowPrincipal
      );

      for (const t of thresholds) {
        const target = (t.percent / 100) * totalPrincipal;
        if (milestoneDates[t.id] == null && cumulativePrincipalPaid >= target) {
          milestoneDates[t.id] = row.date ?? null;
        }
      }
    } else if (row.date) {
      const paidAtRow = initialPrincipal - rowPrincipal;

      for (const t of thresholds) {
        const target = (t.percent / 100) * totalPrincipal;
        if (milestoneDates[t.id] == null && paidAtRow >= target) {
          milestoneDates[t.id] = row.date;
        }
      }
    }
  }

  return thresholds.map((t) => ({
    id: t.id,
    label: `${t.percent}%`,
    percent: t.percent,
    date: milestoneDates[t.id] ?? null,
    completed: loanPaidOff || progressPercent >= t.percent,
  }));
}
