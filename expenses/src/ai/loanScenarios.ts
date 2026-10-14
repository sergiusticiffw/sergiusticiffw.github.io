import {
  buildEventsFromApiPayments,
  buildLoanDataFromApiLoan,
  calculateAmortization,
  scheduleDateToFormDate,
} from '@features/loans/utils/amortization';
import type {
  PaydownEvent,
  PaydownInit,
  PaydownResult,
  PaymentLog,
} from '@features/loans/utils/amortization';
import {
  calculateAnnuity,
  calculateLinearPrincipal,
} from '@features/loans/utils/loanEngine';
import type { ApiLoan, ApiPaymentItem } from '@shared/type/types';
import { transformDateFormat } from '@shared/utils/utils';
import { localToday } from './data';

export interface LoanSource {
  loan: ApiLoan;
  items: ApiPaymentItem[];
}

/** One payment row of a schedule, dates as YYYY-MM-DD. */
export interface ScenarioRow {
  date: string;
  installment: number;
  principal: number;
  interest: number;
  remaining: number;
  fee: number;
  rate: number;
  paid: boolean;
  /** Early payment: actual, planned by the user or hypothetical. */
  extra: boolean;
  hypothetical: boolean;
}

export interface ScenarioResult {
  rows: ScenarioRow[];
  /** Interest over the whole life of the loan. */
  totalInterest: number;
  /** Interest on rows not paid yet, including interest accrued until the contract end. */
  futureInterest: number;
  /** Date of the last payment, or the contract end when a balance is left. */
  payoffDate: string;
  /** Principal still owed at the contract end (0 when fully amortized). */
  balloon: number;
  /** Unpaid regular installments. */
  regularLeft: number;
  /** Dates the hypothetical payments were applied on, in input order. */
  applied: string[];
  /** Date a hypothetical rate change took effect on. */
  rateDate?: string;
  /** Every hypothetical rate-change date, in the order they were applied. */
  rateDates?: string[];
  paydown: PaydownResult;
}

export interface HypotheticalPayment {
  date: string;
  amount: number;
}

export interface HypotheticalRateChange {
  date: string;
  rate: number;
  keepInstallment?: boolean;
}

export interface ScenarioInput {
  /** Keep payments the user only planned. Default true, same as the Loans page. */
  includePlanned?: boolean;
  excludeItem?: (item: ApiPaymentItem) => boolean;
  payments?: HypotheticalPayment[];
  rateChange?: HypotheticalRateChange;
  rateChanges?: HypotheticalRateChange[];
  recurringAmounts?: { date: string; amount: number }[];
}

export type ExtraStrategy = 'reduce_term' | 'reduce_installment';

export type SequenceEventType = 'extra_payment' | 'rate_change' | 'recurring_extra';

/** One future change in a chained what-if, already parsed to YYYY-MM-DD. */
export interface SequenceEvent {
  type: SequenceEventType;
  date: string;
  amount?: number;
  strategy?: ExtraStrategy;
  rate?: number;
  keepInstallment?: boolean;
  everyMonths?: number;
  until?: string | null;
}

export interface SequenceStep {
  type: SequenceEventType;
  date: string;
  appliedOn?: string;
  amount?: number;
  strategy?: ExtraStrategy;
  extraPaymentsMade?: number;
  rate?: number;
  keepInstallment?: boolean;
  remaining: number;
  nextInstallment: number | null;
  payoffDate: string;
  futureInterest: number;
}

const HYPOTHETICAL_ORDER = 1_000_000;

export const toIso = (ddmmyyyy: string) => scheduleDateToFormDate(ddmmyyyy);
export const toEngineDate = (iso: string) => transformDateFormat(iso);

export const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
};

/** Whole calendar months from a to b (negative when b is earlier). */
export const monthsBetween = (a: string, b: string) => {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  let months = (yb - ya) * 12 + (mb - ma);
  if (months > 0 && db < da) months--;
  if (months < 0 && db > da) months++;
  return months;
};

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export const isPlannedItem = (item: ApiPaymentItem) => Number(item.fisp ?? 0) !== 0;

const num = (value: unknown): number => {
  if (value == null || value === '-' || value === '') return NaN;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
};

const isSummaryRow = (row: PaymentLog) =>
  'type' in row && (row as { type?: string }).type === 'annual_summary';

/** Last payment date of a schedule, or the contract end when principal is left. */
export const payoffDateOf = (schedule: PaymentLog[], endIso: string) => {
  let last = '';
  let remaining = 0;
  for (const row of schedule) {
    if (isSummaryRow(row) || !row.date) continue;
    const principal = num(row.principal);
    if (Number.isFinite(principal)) remaining = principal;
    if (num(row.installment) > 0) last = toIso(String(row.date));
  }
  return remaining > 1 || !last ? endIso : last;
};

/** Interest on rows not paid yet, including interest accrued until the contract end. */
export const futureInterestOf = (schedule: PaymentLog[]) =>
  schedule.reduce((sum, row) => {
    if (isSummaryRow(row) || row.was_payed === true) return sum;
    const interest = num(row.interest);
    return Number.isFinite(interest) ? sum + interest : sum;
  }, 0);

function toResult(
  paydown: PaydownResult,
  schedule: PaymentLog[],
  endIso: string,
  applied: string[]
): ScenarioResult {
  const appliedSet = new Set(applied);
  const rows: ScenarioRow[] = [];
  let futureInterest = 0;
  let balloon = 0;

  for (const row of schedule) {
    if (isSummaryRow(row) || !row.date) continue;
    const paid = row.was_payed === true;
    const interest = num(row.interest);
    if (!paid && Number.isFinite(interest)) futureInterest += interest;
    const remaining = num(row.principal);
    if (Number.isFinite(remaining)) balloon = remaining;

    const installment = num(row.installment);
    if (!(installment > 0)) continue;
    const date = toIso(String(row.date));
    const hypothetical = !paid && appliedSet.has(date);
    rows.push({
      date,
      installment,
      principal: num(row.reduction) || 0,
      interest: Number.isFinite(interest) ? interest : 0,
      remaining: Number.isFinite(remaining) ? remaining : 0,
      fee: num(row.fee) || 0,
      rate: num(row.rate) || 0,
      paid,
      extra: Boolean(row.isEarlyPayment) || hypothetical,
      hypothetical,
    });
  }

  const left = balloon > 1 ? balloon : 0;
  return {
    rows,
    totalInterest: paydown.sum_of_interests ?? 0,
    futureInterest,
    payoffDate: left || !rows.length ? endIso : rows[rows.length - 1].date,
    balloon: left,
    regularLeft: rows.filter((row) => !row.paid && !row.extra).length,
    applied,
    paydown,
  };
}

/** First unpaid regular installment due after a date. */
export const regularAfter = (result: ScenarioResult, date: string) =>
  result.rows.find((row) => !row.paid && !row.extra && row.date > date) || null;

export const nextRegular = (result: ScenarioResult) =>
  result.rows.find((row) => !row.paid && !row.extra) || null;

export class LoanSimulator {
  readonly loanData: PaydownInit;
  readonly startIso: string;
  readonly endIso: string;
  private baselines = new Map<boolean, ScenarioResult>();

  constructor(readonly source: LoanSource, loanData: PaydownInit) {
    this.loanData = loanData;
    this.startIso = toIso(loanData.start_date);
    this.endIso = toIso(loanData.end_date);
  }

  baseline(includePlanned = true): ScenarioResult {
    let result = this.baselines.get(includePlanned);
    if (!result) {
      result = this.run({ includePlanned });
      this.baselines.set(includePlanned, result);
    }
    return result;
  }

  /** Earliest sensible date for a hypothetical event: today, but inside the loan. */
  defaultDate() {
    const today = localToday();
    return today > this.startIso ? today : addDays(this.startIso, 1);
  }

  /** Payment method in effect on a date (method-change events included). */
  methodAt(date: string): 'equal_installment' | 'equal_principal' {
    let method: 'equal_installment' | 'equal_principal' =
      this.source.loan.fpm === 'equal_principal' ? 'equal_principal' : 'equal_installment';
    const changes = this.source.items
      .filter((item) => item.fpm === 'equal_principal' || item.fpm === 'equal_installment')
      .map((item) => ({ date: String(item.fdt || '').slice(0, 10), method: item.fpm as typeof method }))
      .filter((change) => change.date && change.date <= date)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (changes.length) method = changes[changes.length - 1].method;
    return method;
  }

  run(input: ScenarioInput = {}): ScenarioResult {
    const includePlanned = input.includePlanned !== false;
    const items = this.source.items.filter(
      (item) => (includePlanned || !isPlannedItem(item)) && !input.excludeItem?.(item)
    );
    const events: PaydownEvent[] = buildEventsFromApiPayments(items);
    let order = HYPOTHETICAL_ORDER;

    const rateChanges = [
      ...(input.rateChanges || []),
      ...(input.rateChange ? [input.rateChange] : []),
    ];

    // A payment on a scheduled date would be merged into (and replace) the regular installment.
    const regularDates = new Set(
      input.payments?.length
        ? this.baseline(includePlanned)
            .rows.filter((row) => !row.paid && !row.extra)
            .map((row) => row.date)
        : []
    );
    const taken = new Set<string>();
    const applied: string[] = [];
    const rateDates: string[] = [];

    // Apply overlays in date order so a later rate change sees remaining after earlier extras.
    type Overlay =
      | { at: string; kind: 0; payment: HypotheticalPayment }
      | { at: string; kind: 1; recurring: { date: string; amount: number } }
      | { at: string; kind: 2; rate: HypotheticalRateChange };
    const overlays: Overlay[] = [];
    for (const payment of input.payments || []) {
      if (payment.amount > 0) overlays.push({ at: payment.date, kind: 0, payment });
    }
    for (const recurring of input.recurringAmounts || []) {
      overlays.push({ at: recurring.date, kind: 1, recurring });
    }
    for (const rate of rateChanges) overlays.push({ at: rate.date, kind: 2, rate });
    overlays.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.kind - b.kind));

    for (const overlay of overlays) {
      if (overlay.kind === 0) {
        let date = overlay.payment.date > this.startIso ? overlay.payment.date : addDays(this.startIso, 1);
        while (regularDates.has(date) || taken.has(date)) date = addDays(date, 1);
        taken.add(date);
        applied.push(date);
        events.push({
          date: toEngineDate(date),
          pay_installment: overlay.payment.amount,
          isEarlyPayment: true,
          isSimulatedPayment: true,
          event_order: order++,
        });
        continue;
      }
      if (overlay.kind === 1) {
        events.push({
          date: toEngineDate(overlay.recurring.date),
          recurring_amount: overlay.recurring.amount,
          event_order: order++,
        });
        continue;
      }

      const { paydown, schedule } = calculateAmortization(this.loanData, events);
      const current = toResult(paydown, schedule, this.endIso, applied);
      const scheduledDates = new Set(current.rows.filter((row) => !row.extra).map((row) => row.date));
      let date = overlay.rate.date > this.startIso ? overlay.rate.date : addDays(this.startIso, 1);
      while (scheduledDates.has(date) || taken.has(date)) date = addDays(date, 1);
      taken.add(date);
      rateDates.push(date);
      const event: PaydownEvent = {
        date: toEngineDate(date),
        rate: overlay.rate.rate,
        event_order: order++,
      };
      const prior = [...current.rows].reverse().find((row) => row.date < date);
      const principal = prior ? prior.remaining : this.loanData.principal;
      if (overlay.rate.keepInstallment) {
        const installment = regularAfter(current, date);
        if (installment) event.recurring_amount = installment.installment;
      } else if (principal > 1) {
        // The engine would spread a rate change over the contract term; banks keep the current maturity.
        event.recurring_amount = this.recurringFor(principal, overlay.rate.rate, date, current.payoffDate);
      }
      events.push(event);
    }

    const { paydown, schedule } = calculateAmortization(this.loanData, events);
    return {
      ...toResult(paydown, schedule, this.endIso, applied),
      rateDate: rateDates[rateDates.length - 1],
      ...(rateDates.length && { rateDates }),
    };
  }

  /** Recurring amount that repays `principal` from `date` until `untilIso`. */
  private recurringFor(principal: number, rate: number, date: string, untilIso: string) {
    const from = toEngineDate(date);
    const until = toEngineDate(untilIso > date ? untilIso : this.endIso);
    return this.methodAt(date) === 'equal_principal'
      ? calculateLinearPrincipal(principal, from, until)
      : calculateAnnuity(principal, rate, from, until);
  }

  /**
   * One extra payment. reduce_term keeps the installment (the engine's default);
   * reduce_installment recalculates it so the loan still ends on its current payoff date.
   */
  runExtra(
    payment: HypotheticalPayment,
    strategy: ExtraStrategy,
    input: ScenarioInput = {}
  ): ScenarioResult {
    const withPayment = { ...input, payments: [...(input.payments || []), payment] };
    const first = this.run(withPayment);
    if (strategy === 'reduce_term') return first;

    const date = first.applied[first.applied.length - 1];
    const row = first.rows.find((r) => r.hypothetical && r.date === date);
    if (!row || row.remaining <= 1) return first;
    const hasInput = Boolean(
      input.payments?.length ||
        input.rateChange ||
        input.rateChanges?.length ||
        input.recurringAmounts?.length ||
        input.excludeItem
    );
    const current = hasInput ? this.run(input) : this.baseline(input.includePlanned !== false);
    const amount = this.recurringFor(row.remaining, row.rate, date, current.payoffDate);
    return this.run({
      ...withPayment,
      recurringAmounts: [...(input.recurringAmounts || []), { date, amount }],
    });
  }

  /**
   * Several future extras and/or rate changes, applied in date order on one schedule.
   * Each extra's strategy is resolved before later events see the new remaining/installment.
   */
  runSequence(events: SequenceEvent[]): { result: ScenarioResult; steps: SequenceStep[] } {
    let input: ScenarioInput = {};
    const steps: SequenceStep[] = [];
    const sorted = [...events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const snapshot = (
      result: ScenarioResult,
      event: SequenceEvent,
      extra: Partial<SequenceStep> = {}
    ): SequenceStep => {
      const at = extra.appliedOn || result.rateDate || event.date;
      const row = [...result.rows].reverse().find((r) => r.date <= at);
      const next = regularAfter(result, at);
      return {
        type: event.type,
        date: event.date,
        remaining: row ? row.remaining : this.loanData.principal,
        nextInstallment: next ? next.installment : null,
        payoffDate: result.payoffDate,
        futureInterest: result.futureInterest,
        ...extra,
      };
    };

    for (const event of sorted) {
      if (event.type === 'extra_payment') {
        const amount = event.amount || 0;
        if (!(amount > 0)) continue;
        const strategy = event.strategy || 'reduce_term';
        const payment = { date: event.date, amount };
        const result = this.runExtra(payment, strategy, input);
        const appliedOn = result.applied[result.applied.length - 1];
        const row = result.rows.find((r) => r.hypothetical && r.date === appliedOn);
        input = {
          ...input,
          payments: [...(input.payments || []), payment],
          ...(strategy === 'reduce_installment' && row && row.remaining > 1
            ? {
                recurringAmounts: [
                  ...(input.recurringAmounts || []),
                  {
                    date: appliedOn,
                    amount: this.recurringFor(
                      row.remaining,
                      row.rate,
                      appliedOn,
                      this.run(input).payoffDate
                    ),
                  },
                ],
              }
            : {}),
        };
        steps.push(snapshot(result, event, { amount, strategy, appliedOn }));
        continue;
      }

      if (event.type === 'rate_change' && event.rate != null) {
        const change = {
          date: event.date,
          rate: event.rate,
          keepInstallment: event.keepInstallment,
        };
        input = { ...input, rateChanges: [...(input.rateChanges || []), change] };
        const result = this.run(input);
        steps.push(
          snapshot(result, event, {
            rate: event.rate,
            keepInstallment: Boolean(event.keepInstallment),
            appliedOn: result.rateDate || event.date,
          })
        );
        continue;
      }

      if (event.type === 'recurring_extra') {
        const amount = event.amount || 0;
        if (!(amount > 0)) continue;
        const everyMonths = Math.min(24, Math.max(1, Math.floor(event.everyMonths || 1)));
        const current = this.run(input);
        const extras = current.rows
          .filter(
            (row) =>
              !row.paid &&
              !row.extra &&
              row.date >= event.date &&
              (!event.until || row.date <= event.until)
          )
          .filter((_, index) => index % everyMonths === 0)
          .map((row) => ({ date: row.date, amount }));
        if (!extras.length) continue;
        input = { ...input, payments: [...(input.payments || []), ...extras] };
        const result = this.run(input);
        steps.push(
          snapshot(result, event, {
            amount,
            extraPaymentsMade: extras.length,
            appliedOn: result.applied[result.applied.length - extras.length] || extras[0].date,
          })
        );
      }
    }

    return { result: this.run(input), steps };
  }
}

const simulators = new WeakMap<LoanSource, LoanSimulator | null>();

export function getLoanSimulator(source: LoanSource): LoanSimulator | null {
  if (simulators.has(source)) return simulators.get(source)!;
  const loanData = buildLoanDataFromApiLoan(source.loan);
  const simulator = loanData ? new LoanSimulator(source, loanData) : null;
  simulators.set(source, simulator);
  return simulator;
}
