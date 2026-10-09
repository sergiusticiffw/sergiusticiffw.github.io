import {
  buildEventsFromApiPayments,
  buildLoanDataFromApiLoan,
  calculateAmortization,
  calculateInterestSavings,
  getNextRegularPayment,
  isEarlyPaymentFromApiItem,
  scheduleDateToFormDate,
} from '@features/loans/utils/amortization';
import type { PaymentLog } from '@features/loans/utils/paydown-node';
import type { ApiLoan, ApiPaymentItem, LoanPaymentsEntry } from '@shared/type/types';
import { getLoanStatus } from '@shared/utils/utils';
import type { DataPrompt } from './dataPrompts';
import { normalizeText, round } from './data';

export interface AiLoanUpcoming {
  date: string;
  installment: number | string;
  principal: number | string;
  interest: number | string;
  remaining: number | string;
}

export interface AiLoanPayment {
  loanId: string;
  loan: string;
  date: string;
  installment: number;
  fee: number;
  extra: boolean;
  note: string;
}

export interface AiLoanSnapshot {
  id: string;
  name: string;
  search: string;
  status: 'active' | 'completed' | 'pending';
  start: string;
  end: string;
  principal: number;
  rate: number;
  method: string;
  paid: number;
  remainingPrincipal: number;
  interestPaid: number;
  unpaidInterest: number;
  fees: number;
  progress: number;
  nextDate: string;
  nextInstallment: number;
  interestSaved: number;
  upcoming: AiLoanUpcoming[];
}

const cleanName = (value: string) =>
  value.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

const isoDate = (value?: string) => (value || '').slice(0, 10);

const methodLabel = (value?: string) =>
  value === 'equal_principal' ? 'equal_principal' : 'annuity';

const amount = (value: unknown) => {
  const n = parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

const isScheduleRow = (
  row: PaymentLog
): boolean => !('type' in row && (row as { type?: string }).type === 'annual_summary');

const cell = (value: number | string | undefined) =>
  value == null || value === '' ? '-' : value;

export interface LoanAiContext {
  snapshots: AiLoanSnapshot[];
  payments: AiLoanPayment[];
  summary: string;
}

export function buildLoanContext(
  loans: ApiLoan[] | null | undefined,
  paymentEntries: LoanPaymentsEntry[] | null | undefined,
  shareDescriptions: boolean
): LoanAiContext {
  const list = loans || [];
  const entries = paymentEntries || [];
  const payments: AiLoanPayment[] = [];
  const snapshots: AiLoanSnapshot[] = [];

  for (const loan of list) {
    const name = cleanName(loan.title || 'Loan');
    const status = getLoanStatus(loan.fls as string | undefined);
    const items = (entries.find((entry) => entry.loanId === loan.id)?.data ||
      []) as ApiPaymentItem[];
    const actual = items.filter((item) => Number(item.fisp ?? 0) === 0);
    let paidInstallments = 0;
    let paidFees = 0;
    for (const item of actual) {
      const installment = amount(item.fpi);
      const fee = amount(item.fpsf);
      paidInstallments += installment;
      paidFees += fee;
      const date = isoDate(item.fdt);
      if (date.length !== 10) continue;
      payments.push({
        loanId: loan.id,
        loan: name,
        date,
        installment: round(installment),
        fee: round(fee),
        extra: isEarlyPaymentFromApiItem(item),
        note: shareDescriptions ? cleanName(item.title || '') : '',
      });
    }

    const snapshot: AiLoanSnapshot = {
      id: loan.id,
      name,
      search: normalizeText(name),
      status,
      start: isoDate(loan.sdt),
      end: isoDate(loan.edt),
      principal: round(amount(loan.fp)),
      rate: round(amount(loan.fr), 4),
      method: methodLabel(loan.fpm),
      paid: round(paidInstallments + paidFees),
      remainingPrincipal: 0,
      interestPaid: 0,
      unpaidInterest: 0,
      fees: round(paidFees),
      progress: status === 'completed' ? 100 : 0,
      nextDate: '',
      nextInstallment: 0,
      interestSaved: 0,
      upcoming: [],
    };

    if (status === 'active') {
      try {
        const loanData = buildLoanDataFromApiLoan(loan);
        if (loanData) {
          const events = buildEventsFromApiPayments(items);
          const { paydown, schedule } = calculateAmortization(loanData, events);
          const total =
            (paydown.sum_of_installments ?? 0) +
            (paydown.remaining_principal ?? 0) +
            (paydown.unpaid_interest ?? 0);
          snapshot.remainingPrincipal = round(paydown.remaining_principal ?? 0);
          snapshot.interestPaid = round(paydown.interest_paid ?? 0);
          snapshot.unpaidInterest = round(paydown.unpaid_interest ?? 0);
          snapshot.progress =
            total > 0
              ? round(Math.min(100, (paidInstallments / total) * 100), 1)
              : 0;
          const next = getNextRegularPayment(schedule);
          if (next) {
            snapshot.nextDate = scheduleDateToFormDate(next.date);
            snapshot.nextInstallment = round(next.installment);
          }
          snapshot.upcoming = schedule
            .filter((row) => isScheduleRow(row) && row.was_payed !== true)
            .slice(0, 6)
            .map((row) => ({
              date: row.date ? scheduleDateToFormDate(String(row.date)) : '',
              installment: cell(row.installment),
              principal: cell(row.reduction),
              interest: cell(row.interest),
              remaining: cell(row.principal),
            }));
          const saved = calculateInterestSavings(loan, items);
          snapshot.interestSaved = Number.isFinite(saved) ? round(saved) : 0;
        }
      } catch {
        snapshot.progress = 0;
      }
    }

    snapshots.push(snapshot);
  }

  payments.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return {
    snapshots,
    payments,
    summary: formatLoansSummary(snapshots),
  };
}

const whole = (value: number) => Math.round(value);

export function formatLoansSummary(snapshots: AiLoanSnapshot[]): string {
  if (!snapshots.length) return '';
  const remaining = snapshots.reduce((sum, loan) => sum + loan.remainingPrincipal, 0);
  const next = snapshots.reduce((sum, loan) => sum + loan.nextInstallment, 0);
  const lines = [
    `LOANS ${snapshots.length} | remaining principal ${whole(remaining)} | next installments ${whole(next)}`,
    'loan|status|start|end|principal|rate%|method|paid|remaining principal|interest paid|unpaid interest|next date|next installment|progress%',
    ...snapshots.map(
      (loan) =>
        `${loan.name}|${loan.status}|${loan.start}|${loan.end}|${whole(loan.principal)}|${loan.rate}|${loan.method}|${whole(loan.paid)}|${whole(loan.remainingPrincipal)}|${whole(loan.interestPaid)}|${whole(loan.unpaidInterest)}|${loan.nextDate || '-'}|${whole(loan.nextInstallment)}|${loan.progress}`
    ),
  ];
  return lines.join('\n');
}

const monthName = (date: string) => {
  if (!date || date.length < 7) return date;
  const name = new Date(`${date.slice(0, 7)}-15T12:00:00`).toLocaleDateString(
    'ro-RO',
    { month: 'long', year: 'numeric' }
  );
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const fmt = (value: number) => Math.round(value).toLocaleString('ro-RO');

export function buildLoanPrompts(snapshots: AiLoanSnapshot[]): DataPrompt[] {
  const active = snapshots.filter((loan) => loan.status === 'active');
  if (!active.length) return [];
  const prompts: DataPrompt[] = [];
  const biggest = [...active].sort(
    (a, b) => b.nextInstallment - a.nextInstallment
  )[0];
  if (biggest?.nextInstallment) {
    prompts.push({
      priority: 9,
      kind: 'loan',
      text: `Rata din ${monthName(biggest.nextDate)} la ${biggest.name} e ${fmt(biggest.nextInstallment)}. Cum se compară cu cheltuielile mele?`,
    });
  }
  if (active.length > 1) {
    prompts.push({
      priority: 8,
      kind: 'loan',
      text: 'La care credit plătesc cea mai mare rată și cât mai am de dat în total?',
    });
  } else {
    prompts.push({
      priority: 8,
      kind: 'loan',
      text: `Cât mai am de plătit la ${active[0].name} și când se termină?`,
    });
  }
  const saved = active.find((loan) => loan.interestSaved > 0);
  if (saved) {
    prompts.push({
      priority: 7,
      kind: 'loan',
      text: `Cât dobândă am economisit cu plățile anticipate la ${saved.name}?`,
    });
  }
  return prompts;
}

export function findLoans(
  snapshots: AiLoanSnapshot[],
  query: string
): { loans: AiLoanSnapshot[]; error?: string } {
  const needle = normalizeText(query || '');
  if (!needle) {
    if (snapshots.length === 1) return { loans: snapshots };
    return {
      loans: [],
      error: `Name the loan. Available: ${snapshots.map((loan) => loan.name).join(', ') || 'none'}`,
    };
  }
  const exact = snapshots.filter(
    (loan) => loan.id === query || loan.search === needle
  );
  const matches = exact.length
    ? exact
    : snapshots.filter((loan) => {
        if (!loan.search || !needle) return false;
        if (loan.search.includes(needle)) return true;
        return loan.search.length >= 4 && needle.includes(loan.search);
      });
  if (!matches.length) {
    return {
      loans: [],
      error: `No loan matches "${query}". Available: ${snapshots.map((loan) => loan.name).join(', ') || 'none'}`,
    };
  }
  if (matches.length > 1 && !exact.length) {
    return {
      loans: matches,
      error: `Several loans match. Pick one: ${matches.map((loan) => loan.name).join(', ')}`,
    };
  }
  return { loans: matches };
}
