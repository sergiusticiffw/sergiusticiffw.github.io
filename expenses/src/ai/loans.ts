import {
  buildEventsFromApiPayments,
  buildLoanDataFromApiLoan,
  calculateAmortization,
  calculateInterestSavings,
  getNextRegularPayment,
  isEarlyPaymentFromApiItem,
  scheduleDateToFormDate,
} from '@features/loans/utils/amortization';
import { getEffectiveRateFromSchedule } from '@features/loans/utils/loanSnapshot';
import type { PaymentLog } from '@features/loans/utils/paydown-node';
import type { ApiLoan, ApiPaymentItem, LoanPaymentsEntry } from '@shared/type/types';
import { getLoanStatus } from '@shared/utils/utils';
import type { DataPrompt } from './dataPrompts';
import { normalizeText, round } from './data';
import { LoanSource, futureInterestOf, monthsBetween, payoffDateOf } from './loanScenarios';

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
  /** Set only when this event changes the interest rate. */
  rate: number | null;
  /** Set only when this event refinances the remaining principal. */
  newPrincipal: number | null;
  /** Set only when this event changes the recurring installment. */
  recurring: number | null;
  /** Set only when this event changes equal_installment / equal_principal. */
  method: string;
  extra: boolean;
  simulated: boolean;
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
  /** Rate on the loan contract. Later changes are events. */
  rate: number;
  /** Rate in effect today, after rate-change events. */
  currentRate: number;
  method: string;
  paymentDay: string;
  initialFee: number;
  firstPayment: string;
  paid: number;
  remainingPrincipal: number;
  interestPaid: number;
  unpaidInterest: number;
  fees: number;
  progress: number;
  nextDate: string;
  nextInstallment: number;
  interestSaved: number;
  /** Payoff date in the current schedule (earlier than end after extra payments). */
  projectedEnd: string;
  /** Months between projectedEnd and the contract end. */
  monthsAheadOfContract: number;
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
  /** Raw loan and payment records by loan id, for simulations. */
  sources: Map<string, LoanSource>;
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
  const sources = new Map<string, LoanSource>();

  for (const loan of list) {
    const name = cleanName(loan.title || 'Loan');
    const status = getLoanStatus(loan.fls as string | undefined);
    const items = (entries.find((entry) => entry.loanId === loan.id)?.data ||
      []) as ApiPaymentItem[];
    sources.set(loan.id, { loan, items });
    let paidInstallments = 0;
    let paidFees = 0;
    for (const item of items) {
      const simulated = Number(item.fisp ?? 0) !== 0;
      const installment = amount(item.fpi);
      const fee = amount(item.fpsf);
      const rate =
        item.fr != null && item.fr !== '' ? round(amount(item.fr), 4) : null;
      const newPrincipal =
        item.fnp != null && item.fnp !== '' ? round(amount(item.fnp)) : null;
      const recurring =
        item.fnra != null && item.fnra !== '' ? round(amount(item.fnra)) : null;
      const method =
        item.fpm === 'equal_principal' || item.fpm === 'equal_installment'
          ? item.fpm
          : '';
      const isChange =
        rate != null || newPrincipal != null || recurring != null || method !== '';
      const isMoney = installment > 0 || fee > 0;
      // Simulated rows that only repeat the future schedule stay out of the event log.
      if (simulated && !isChange) continue;
      if (!isMoney && !isChange) continue;
      if (!simulated) {
        paidInstallments += installment;
        paidFees += fee;
      }
      const date = isoDate(item.fdt);
      if (date.length !== 10) continue;
      payments.push({
        loanId: loan.id,
        loan: name,
        date,
        installment: round(installment),
        fee: round(fee),
        rate,
        newPrincipal,
        recurring,
        method,
        extra: isEarlyPaymentFromApiItem(item),
        simulated,
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
      currentRate: round(amount(loan.fr), 4),
      method: methodLabel(loan.fpm),
      paymentDay: loan.frpd == null || loan.frpd === '' ? '' : String(loan.frpd),
      initialFee: round(amount(loan.fif)),
      firstPayment: isoDate(loan.pdt),
      paid: round(paidInstallments + paidFees),
      remainingPrincipal: 0,
      interestPaid: 0,
      unpaidInterest: 0,
      fees: round(paidFees),
      progress: status === 'completed' ? 100 : 0,
      nextDate: '',
      nextInstallment: 0,
      interestSaved: 0,
      projectedEnd: '',
      monthsAheadOfContract: 0,
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
          snapshot.remainingPrincipal = round(
            paydown.remaining_principal_after_paid ?? paydown.remaining_principal ?? 0
          );
          snapshot.interestPaid = round(paydown.interest_paid ?? 0);
          snapshot.unpaidInterest = round(futureInterestOf(schedule));
          snapshot.progress =
            total > 0
              ? round(Math.min(100, (paidInstallments / total) * 100), 1)
              : 0;
          const effective = getEffectiveRateFromSchedule(schedule);
          if (effective != null) snapshot.currentRate = round(effective, 4);
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
          if (snapshot.end) {
            snapshot.projectedEnd = payoffDateOf(schedule, snapshot.end);
            snapshot.monthsAheadOfContract = Math.max(
              0,
              monthsBetween(snapshot.projectedEnd, snapshot.end)
            );
          }
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
    sources,
    summary: formatLoansSummary(snapshots, payments),
  };
}

const whole = (value: number) => Math.round(value);

const eventCell = (value: number) => (value > 0 ? String(whole(value)) : '-');

export const LOAN_EVENT_COLUMNS =
  'date|loan|installment|fee|rate%|new principal|new recurring|method|extra|planned|note';

export const formatLoanEvent = (event: AiLoanPayment) =>
  [
    event.date,
    event.loan,
    eventCell(event.installment),
    eventCell(event.fee),
    event.rate == null ? '-' : String(event.rate),
    event.newPrincipal == null ? '-' : String(whole(event.newPrincipal)),
    event.recurring == null ? '-' : String(whole(event.recurring)),
    event.method || '-',
    event.extra ? 'extra' : '-',
    event.simulated ? 'planned' : '-',
    event.note || '-',
  ].join('|');

/** Keep every rate, principal, installment and method change. Drop only the oldest plain payments if the log is huge. */
const eventsForSummary = (payments: AiLoanPayment[]) => {
  const chronological = [...payments].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const limit = 400;
  if (chronological.length <= limit) return chronological;
  const isChange = (event: AiLoanPayment) =>
    event.rate != null ||
    event.newPrincipal != null ||
    event.recurring != null ||
    event.method !== '' ||
    event.extra;
  const changes = chronological.filter(isChange);
  const room = Math.max(0, limit - changes.length);
  const recentPayments = chronological.filter((event) => !isChange(event)).slice(-room);
  const kept = new Set([...changes, ...recentPayments]);
  return chronological.filter((event) => kept.has(event));
};

export function formatLoansSummary(
  snapshots: AiLoanSnapshot[],
  payments: AiLoanPayment[] = []
): string {
  if (!snapshots.length) return '';
  const remaining = snapshots.reduce((sum, loan) => sum + loan.remainingPrincipal, 0);
  const next = snapshots.reduce((sum, loan) => sum + loan.nextInstallment, 0);
  const events = eventsForSummary(payments);
  const lines = [
    `LOANS ${snapshots.length} | remaining principal ${whole(remaining)} | next installments ${whole(next)}`,
    'loan|status|start|end|projected payoff|principal|initial rate%|current rate%|method|payment day|initial fee|first payment|paid|remaining principal|interest paid|unpaid interest|next date|next installment|progress%',
    ...snapshots.map(
      (loan) =>
        `${loan.name}|${loan.status}|${loan.start}|${loan.end}|${loan.projectedEnd || '-'}|${whole(loan.principal)}|${loan.rate}|${loan.currentRate}|${loan.method}|${loan.paymentDay || '-'}|${whole(loan.initialFee)}|${loan.firstPayment || '-'}|${whole(loan.paid)}|${whole(loan.remainingPrincipal)}|${whole(loan.interestPaid)}|${whole(loan.unpaidInterest)}|${loan.nextDate || '-'}|${whole(loan.nextInstallment)}|${loan.progress}`
    ),
  ];
  if (events.length) {
    lines.push(
      '',
      `LOAN EVENTS ${events.length}${events.length < payments.length ? ` of ${payments.length}` : ''} | ${LOAN_EVENT_COLUMNS}`,
      'A value other than - is a change on that date. planned = not yet an actual payment. extra = payment before the schedule.',
      ...events.map(formatLoanEvent)
    );
  }
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

/** Round to 2 significant digits so suggested amounts look natural (12.345 → 12.000). */
const roundNice = (value: number) => {
  if (value <= 0) return 0;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.round(value / step) * step;
};

export function buildLoanPrompts(snapshots: AiLoanSnapshot[]): DataPrompt[] {
  const active = snapshots.filter((loan) => loan.status === 'active');
  if (!active.length) return [];
  const prompts: DataPrompt[] = [];
  const add = (text: string) => prompts.push({ priority: 5, kind: 'loan', text });

  const remaining = active.reduce((sum, loan) => sum + loan.remainingPrincipal, 0);
  const next = active.reduce((sum, loan) => sum + loan.nextInstallment, 0);
  if (active.length > 1 && next > 0) {
    add(
      `Pe toate creditele plătesc ${fmt(next)} luna asta și mai am ${fmt(remaining)} de dat. Care mă apasă cel mai tare?`
    );
  }

  for (const loan of active) {
    if (loan.nextInstallment) {
      add(
        `Rata din ${monthName(loan.nextDate)} la ${loan.name} e ${fmt(loan.nextInstallment)}. Cum se compară cu cheltuielile mele?`
      );
    }
    if (loan.remainingPrincipal > 0) {
      const until = loan.end ? `, până în ${monthName(loan.end)}` : '';
      add(`La ${loan.name} mai am ${fmt(loan.remainingPrincipal)} de plătit${until}. E un ritm bun?`);
    }
    if (loan.interestPaid > 0 || loan.unpaidInterest > 0) {
      add(
        `La ${loan.name} am plătit ${fmt(loan.interestPaid)} dobândă și mai urmează cam ${fmt(loan.unpaidInterest)}. Merită o plată anticipată?`
      );
    }
    if (loan.interestSaved > 0) {
      add(
        `Cu plățile anticipate la ${loan.name} am economisit ${fmt(loan.interestSaved)} dobândă. Cât aș mai putea tăia?`
      );
    }
    if (loan.progress > 0 && loan.progress < 100) {
      add(
        `${loan.name} e achitat în proporție de ${Math.round(loan.progress)}%. Cât mai durează în ritmul actual?`
      );
    }
    if (loan.remainingPrincipal > 0) {
      const lump = roundNice(loan.remainingPrincipal * 0.1);
      add(`Cât aș salva la ${loan.name} dacă fac o plată anticipată de ${fmt(lump)}?`);
      if (loan.nextInstallment > 0) {
        add(
          `Dacă la ${loan.name} plătesc ${fmt(roundNice(loan.nextInstallment * 0.25))} în plus la fiecare rată, cu cât termin mai repede?`
        );
      }
      add(`Ce s-ar întâmpla cu rata la ${loan.name} dacă dobânda devine ${round(loan.currentRate + 1, 2)}%?`);
    }
    if (loan.interestSaved > 0 || loan.monthsAheadOfContract > 0) {
      add(`Cât timp am câștigat la ${loan.name} datorită plăților anticipate?`);
    }
  }
  if (active.length > 1 && remaining > 0) {
    add(`Am ${fmt(roundNice(remaining * 0.05))} în plus. La care credit să-i pun ca să economisesc cel mai mult?`);
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
