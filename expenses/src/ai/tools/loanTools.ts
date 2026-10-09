import { isEarlyPaymentFromApiItem } from '@features/loans/utils/amortization';
import type { ApiPaymentItem } from '@shared/type/types';
import type { GeminiFunctionDeclaration } from '../client';
import { AI_LIMITS } from '../config';
import { AiItem, localToday, round } from '../data';
import { AiLoanSnapshot, findLoans } from '../loans';
import {
  ExtraStrategy,
  HypotheticalPayment,
  LoanSimulator,
  LoanSource,
  ScenarioResult,
  addDays,
  daysBetween,
  getLoanSimulator,
  isPlannedItem,
  monthsBetween,
  nextRegular,
  regularAfter,
} from '../loanScenarios';

export interface LoanToolContext {
  items: AiItem[];
  loans: AiLoanSnapshot[];
  loanSources: Map<string, LoanSource>;
}

type Args = Record<string, any>;
type ToolResult = Record<string, unknown>;

const loanParam = {
  type: 'string',
  description: 'Loan name from LOANS. Optional when the user has a single active loan.',
};
const dateParam = (what: string) => ({
  type: 'string',
  description: `${what} YYYY-MM-DD or YYYY-MM. Default today.`,
});
const feeParams = {
  feePercent: {
    type: 'number',
    description: 'Early repayment commission as % of the amount, if the bank charges one.',
  },
  feeAmount: { type: 'number', description: 'Fixed early repayment commission.' },
};

export const loanToolDeclarations: GeminiFunctionDeclaration[] = [
  {
    name: 'simulate_extra_payment',
    description:
      'What-if for one early/extra payment: interest saved, new payoff date and months saved (reduce_term), or the new lower installment (reduce_installment). Use for "how much would I save if I prepay X".',
    parameters: {
      type: 'object',
      properties: {
        loan: loanParam,
        amount: { type: 'number', description: 'Extra payment amount.' },
        date: dateParam('Payment date'),
        strategy: {
          type: 'string',
          enum: ['compare', 'reduce_term', 'reduce_installment'],
          description: 'Default compare (both).',
        },
        ...feeParams,
      },
      required: ['amount'],
    },
  },
  {
    name: 'get_extra_payments_impact',
    description:
      'Effect of the early payments the user already made: interest saved, payoff date with vs without them, months/time saved, installment now vs without them, and the contribution of each extra payment.',
    parameters: {
      type: 'object',
      properties: {
        loan: { type: 'string', description: 'Loan name. Omit for every loan with extra payments.' },
        includePlanned: {
          type: 'boolean',
          description: 'Also count planned (not yet made) extra payments. Default false.',
        },
        perPayment: { type: 'boolean', description: 'List each extra payment. Default true.' },
      },
    },
  },
  {
    name: 'simulate_recurring_extra',
    description:
      'What-if for paying an extra amount with every installment (or every N months), optionally plus a one-time payment: new payoff date, months saved, interest saved, total extra paid.',
    parameters: {
      type: 'object',
      properties: {
        loan: loanParam,
        extraAmount: { type: 'number', description: 'Extra paid each time.' },
        everyMonths: {
          type: 'integer',
          description: '1 = with every installment (default), 3 = quarterly, 12 = yearly.',
        },
        from: dateParam('First extra payment on or after'),
        until: { type: 'string', description: 'Stop extra payments after YYYY-MM-DD or YYYY-MM.' },
        oneTimeAmount: { type: 'number' },
        oneTimeDate: dateParam('One-time payment date'),
        ...feeParams,
      },
      required: ['extraAmount'],
    },
  },
  {
    name: 'solve_loan_goal',
    description:
      'Finds the amount needed for a goal: finish by a date (payoff_by), bring the installment down to a value (target_installment, one-time payment), or keep future interest under a value (max_future_interest). Answers "how much extra per month to finish by 2030".',
    parameters: {
      type: 'object',
      properties: {
        loan: loanParam,
        goal: { type: 'string', enum: ['payoff_by', 'target_installment', 'max_future_interest'] },
        targetDate: { type: 'string', description: 'For payoff_by: YYYY-MM-DD or YYYY-MM.' },
        targetAmount: { type: 'number', description: 'For target_installment or max_future_interest.' },
        method: {
          type: 'string',
          enum: ['monthly_extra', 'one_time'],
          description: 'Default monthly_extra; target_installment always uses one_time.',
        },
        date: dateParam('One-time payment date / first monthly extra'),
      },
      required: ['goal'],
    },
  },
  {
    name: 'simulate_rate_change',
    description:
      'What-if for a new interest rate (variable rate change or refinancing): new installment, interest difference, payoff date; with refinanceFee also net saving and break-even months. keepInstallment keeps the current installment so the term changes instead.',
    parameters: {
      type: 'object',
      properties: {
        loan: loanParam,
        rate: { type: 'number', description: 'New annual rate in %, e.g. 7.5.' },
        date: dateParam('Effective date'),
        keepInstallment: { type: 'boolean' },
        refinanceFee: { type: 'number', description: 'One-time cost of refinancing.' },
      },
      required: ['rate'],
    },
  },
  {
    name: 'get_amortization_schedule',
    description:
      'Schedule rows (installment, principal, interest, remaining) per payment or per year, plus milestones (25/50/75/100% principal repaid), the month principal starts to exceed interest, and the next installment split. Use for "how much interest do I pay in 2027" or "how many installments are left".',
    parameters: {
      type: 'object',
      properties: {
        loan: loanParam,
        groupBy: { type: 'string', enum: ['payment', 'year'], description: 'Default payment.' },
        from: { type: 'string', description: 'YYYY-MM-DD or YYYY-MM. Without from/to only unpaid rows.' },
        to: { type: 'string', description: 'YYYY-MM-DD or YYYY-MM.' },
        limit: { type: 'integer', description: 'Max rows, default 50.' },
      },
    },
  },
  {
    name: 'allocate_extra_payment',
    description:
      'Ranks the active loans by the benefit of putting the same extra amount into each: interest saved, months saved, installment drop. Use for "which loan should I prepay".',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        date: dateParam('Payment date'),
      },
      required: ['amount'],
    },
  },
  {
    name: 'compare_prepay_vs_invest',
    description:
      'Prepaying a loan vs investing the same money at a given annual return until the original payoff date, the break-even return, and the user\'s average monthly surplus (income - expenses) for affordability.',
    parameters: {
      type: 'object',
      properties: {
        loan: loanParam,
        amount: { type: 'number' },
        annualReturn: { type: 'number', description: 'Expected yearly return in %, e.g. deposit 5.' },
        taxPercent: { type: 'number', description: 'Tax on investment gains in %. Default 0.' },
        date: dateParam('Payment/investment date'),
      },
      required: ['amount', 'annualReturn'],
    },
  },
];

const whole = (value: number) => Math.round(value);

const clampLimit = (value: unknown, fallback: number, max: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};

const fail = (error: string, extra: ToolResult = {}) => ({ error, ...extra });

interface Resolved {
  snapshot: AiLoanSnapshot;
  sim: LoanSimulator;
}

function resolveLoan(
  ctx: LoanToolContext,
  name: unknown,
  { activeOnly = true } = {}
): Resolved | { error: ToolResult } {
  if (!ctx.loans.length) return { error: { loans: 0 } };
  const query = String(name || '').trim();
  let snapshot: AiLoanSnapshot | undefined;
  if (!query) {
    const active = ctx.loans.filter((loan) => loan.status === 'active');
    if (active.length === 1) snapshot = active[0];
    else if (ctx.loans.length === 1) snapshot = ctx.loans[0];
    else {
      return {
        error: fail(`Name the loan. Available: ${ctx.loans.map((loan) => loan.name).join(', ')}`),
      };
    }
  } else {
    const found = findLoans(ctx.loans, query);
    if (found.error || found.loans.length !== 1) {
      return {
        error: fail(found.error || 'Loan not found', {
          ...(found.loans.length > 1 && { matches: found.loans.map((loan) => loan.name) }),
        }),
      };
    }
    snapshot = found.loans[0];
  }
  if (activeOnly && snapshot.status === 'completed') {
    return { error: fail(`${snapshot.name} is already paid off.`) };
  }
  const source = ctx.loanSources.get(snapshot.id);
  const sim = source ? getLoanSimulator(source) : null;
  if (!sim) return { error: fail(`${snapshot.name} has no start/end date, cannot build its schedule.`) };
  return { snapshot, sim };
}

const isError = (value: Resolved | { error: ToolResult }): value is { error: ToolResult } =>
  'error' in value;

/** YYYY-MM-DD as is; YYYY-MM becomes that month's installment date, or the 1st. */
function parseDate(sim: LoanSimulator, value: unknown, fallback: string): string | null {
  if (value == null || value === '') return fallback;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}$/.test(text)) {
    const row = sim.baseline().rows.find((r) => !r.extra && r.date.startsWith(text));
    return row ? row.date : `${text}-01`;
  }
  return null;
}

const endOfPeriod = (value: unknown): string | null => {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}$/.test(text)) {
    const [y, m] = text.split('-').map(Number);
    return `${text}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  }
  if (/^\d{4}$/.test(text)) return `${text}-12-31`;
  return null;
};

const startOfPeriod = (value: unknown): string | null => {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  if (/^\d{4}$/.test(text)) return `${text}-01-01`;
  return null;
};

const feeOf = (args: Args, amount: number) => {
  if (typeof args.feeAmount === 'number' && args.feeAmount > 0) return args.feeAmount;
  if (typeof args.feePercent === 'number' && args.feePercent > 0) return (amount * args.feePercent) / 100;
  return 0;
};

const summarize = (result: ScenarioResult, after?: string) => {
  const next = after ? regularAfter(result, after) : nextRegular(result);
  return {
    payoffDate: result.payoffDate,
    installmentsLeft: result.regularLeft,
    nextInstallment: next ? whole(next.installment) : null,
    futureInterest: whole(result.futureInterest),
    lifetimeInterest: whole(result.totalInterest),
    ...(result.balloon > 0 && { principalLeftAtContractEnd: whole(result.balloon) }),
  };
};

const timeSaved = (base: ScenarioResult, scenario: ScenarioResult) => ({
  monthsSaved: monthsBetween(scenario.payoffDate, base.payoffDate),
  daysSaved: daysBetween(scenario.payoffDate, base.payoffDate),
  installmentsSaved: base.regularLeft - scenario.regularLeft,
});

const hypotheticalPaid = (result: ScenarioResult) =>
  result.rows.filter((row) => row.hypothetical).reduce((sum, row) => sum + row.installment, 0);

const remainingNow = (sim: LoanSimulator) => {
  const base = sim.baseline();
  const firstUnpaid = base.rows.find((row) => !row.paid);
  return firstUnpaid ? firstUnpaid.remaining + firstUnpaid.principal : 0;
};

const simulateExtraPayment = (ctx: LoanToolContext, args: Args): ToolResult => {
  const resolved = resolveLoan(ctx, args.loan);
  if (isError(resolved)) return resolved.error;
  const { snapshot, sim } = resolved;
  const amount = Number(args.amount);
  if (!(amount > 0)) return fail('amount must be positive');
  const date = parseDate(sim, args.date, sim.defaultDate());
  if (!date) return fail('date must be YYYY-MM-DD or YYYY-MM');

  const strategy = String(args.strategy || 'compare');
  const fee = feeOf(args, amount);
  const base = sim.baseline();
  const payment: HypotheticalPayment = { date, amount };

  const describe = (s: ExtraStrategy) => {
    const result = sim.runExtra(payment, s);
    const applied = result.applied[0];
    const row = result.rows.find((r) => r.hypothetical && r.date === applied);
    const saved = base.totalInterest - result.totalInterest;
    const after = regularAfter(result, applied);
    const before = regularAfter(base, applied);
    return {
      applied,
      paysOffLoan: Boolean(row && row.remaining <= 1),
      amountApplied: row ? whole(row.installment) : 0,
      out: {
        ...summarize(result, applied),
        interestSaved: whole(saved),
        ...(fee > 0 && { netSaving: whole(saved - fee) }),
        ...timeSaved(base, result),
        ...(s === 'reduce_installment' && {
          installmentDrop: before && after ? whole(before.installment - after.installment) : null,
        }),
      },
    };
  };

  const strategies: ExtraStrategy[] =
    strategy === 'reduce_term' || strategy === 'reduce_installment' ? [strategy] : ['reduce_term', 'reduce_installment'];
  const results = strategies.map((s) => [s, describe(s)] as const);
  const first = results[0][1];

  return {
    loan: snapshot.name,
    currentRate: snapshot.currentRate,
    amount: whole(amount),
    appliedOn: first.applied,
    ...(first.applied !== date && { note: 'Moved one day after the scheduled installment, as banks apply it.' }),
    paysOffLoan: first.paysOffLoan,
    ...(first.paysOffLoan && { amountNeededToCloseLoan: first.amountApplied }),
    ...(fee > 0 && { fee: whole(fee) }),
    withoutExtraPayment: summarize(base, first.applied),
    ...Object.fromEntries(results.map(([s, r]) => [s, r.out])),
  };
};

const extraPaymentsImpact = (ctx: LoanToolContext, args: Args): ToolResult => {
  if (!ctx.loans.length) return { loans: 0 };
  const includePlanned = args.includePlanned === true;
  let targets: Resolved[];
  if (args.loan) {
    const resolved = resolveLoan(ctx, args.loan, { activeOnly: false });
    if (isError(resolved)) return resolved.error;
    targets = [resolved];
  } else {
    targets = ctx.loans
      .map((loan) => resolveLoan(ctx, loan.name, { activeOnly: false }))
      .filter((r): r is Resolved => !isError(r));
  }

  const loans = targets.map(({ snapshot, sim }) => {
    const actual = sim.run({ includePlanned });
    const engineExtras = new Set(
      actual.rows.filter((row) => row.extra).map((row) => `${row.date}|${whole(row.installment)}`)
    );
    const isExtra = (item: ApiPaymentItem) => {
      const amount = Number(item.fpi);
      if (!(amount > 0) || (!includePlanned && isPlannedItem(item))) return false;
      const key = `${String(item.fdt || '').slice(0, 10)}|${whole(amount)}`;
      return isEarlyPaymentFromApiItem(item) || engineExtras.has(key);
    };
    const extras = sim.source.items.filter(isExtra);
    if (!extras.length) return { loan: snapshot.name, extraPayments: 0 };

    const without = sim.run({ includePlanned, excludeItem: isExtra });
    const firstExtra = extras.map((item) => String(item.fdt || '').slice(0, 10)).sort()[0];
    const changesAfter = sim.source.items.some(
      (item) =>
        String(item.fdt || '').slice(0, 10) >= firstExtra &&
        ((item.fnra != null && item.fnra !== '') || (item.fnp != null && item.fnp !== ''))
    );
    const nowNext = nextRegular(actual);
    const withoutNext = nextRegular(without);

    let perPayment: string | undefined;
    if (args.perPayment !== false && extras.length <= 40) {
      perPayment = extras
        .map((item) => {
          const run = sim.run({ includePlanned, excludeItem: (i) => i === item });
          return [
            String(item.fdt || '').slice(0, 10),
            whole(Number(item.fpi)),
            whole(run.totalInterest - actual.totalInterest),
            monthsBetween(actual.payoffDate, run.payoffDate),
            isPlannedItem(item) ? 'planned' : 'paid',
          ].join('|');
        })
        .sort()
        .join('\n');
    }

    const regularTotal = (r: ScenarioResult) => r.rows.filter((row) => !row.extra).length;
    return {
      loan: snapshot.name,
      status: snapshot.status,
      extraPayments: extras.length,
      totalExtraPaid: whole(extras.reduce((sum, item) => sum + Number(item.fpi), 0)),
      interestSaved: whole(without.totalInterest - actual.totalInterest),
      contractEnd: sim.endIso,
      payoffWithExtras: actual.payoffDate,
      payoffWithoutExtras: without.payoffDate,
      monthsSaved: monthsBetween(actual.payoffDate, without.payoffDate),
      daysSaved: daysBetween(actual.payoffDate, without.payoffDate),
      installmentsSaved: regularTotal(without) - regularTotal(actual),
      ...(snapshot.status !== 'completed' && {
        nextInstallmentNow: nowNext ? whole(nowNext.installment) : null,
        nextInstallmentWithoutExtras: withoutNext ? whole(withoutNext.installment) : null,
      }),
      ...(perPayment && {
        perPaymentColumns: 'date|amount|interest saved by this payment alone|months saved by it alone|status',
        perPayment,
      }),
      ...(changesAfter && {
        note: 'There are installment/principal changes after the first extra payment; they are kept in both scenarios, so part of the benefit may show as a lower installment instead of a shorter term.',
      }),
    };
  });

  return {
    countsPlanned: includePlanned,
    loans: loans.filter((loan) => args.loan || loan.extraPayments),
    ...(!args.loan && loans.every((loan) => !loan.extraPayments) && { note: 'No extra payments found.' }),
  };
};

function recurringPayments(
  sim: LoanSimulator,
  amount: number,
  everyMonths: number,
  from: string,
  until: string | null
): HypotheticalPayment[] {
  return sim
    .baseline()
    .rows.filter((row) => !row.paid && !row.extra && row.date >= from && (!until || row.date <= until))
    .filter((_, index) => index % everyMonths === 0)
    .map((row) => ({ date: row.date, amount }));
}

/** Average income, expenses and surplus over the last complete months. */
function cashFlow(items: AiItem[]) {
  if (!items.length) return null;
  const current = localToday().slice(0, 7);
  const first = items[items.length - 1].month;
  const byMonth = new Map<string, { income: number; expenses: number }>();
  for (const item of items) {
    const entry = byMonth.get(item.month) || { income: 0, expenses: 0 };
    if (item.kind === 'income') entry.income += item.amount;
    else entry.expenses += item.amount;
    byMonth.set(item.month, entry);
  }
  const average = (count: number) => {
    let income = 0;
    let expenses = 0;
    let months = 0;
    const [y, m] = current.split('-').map(Number);
    for (let i = 1; i <= count; i++) {
      const d = new Date(y, m - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key < first) break;
      const entry = byMonth.get(key);
      income += entry?.income || 0;
      expenses += entry?.expenses || 0;
      months++;
    }
    if (!months) return null;
    return {
      months,
      avgIncome: whole(income / months),
      avgExpenses: whole(expenses / months),
      avgSurplus: whole((income - expenses) / months),
    };
  };
  return { last3Months: average(3), last12Months: average(12) };
}

const simulateRecurringExtra = (ctx: LoanToolContext, args: Args): ToolResult => {
  const resolved = resolveLoan(ctx, args.loan);
  if (isError(resolved)) return resolved.error;
  const { snapshot, sim } = resolved;
  const amount = Number(args.extraAmount);
  if (!(amount > 0)) return fail('extraAmount must be positive');
  const from = parseDate(sim, args.from, sim.defaultDate());
  const until = endOfPeriod(args.until);
  if (!from || (args.until && !until)) return fail('dates must be YYYY-MM-DD or YYYY-MM');
  const everyMonths = clampLimit(args.everyMonths, 1, 24);

  const payments = recurringPayments(sim, amount, everyMonths, from, until);
  const oneTime = Number(args.oneTimeAmount);
  if (oneTime > 0) {
    const date = parseDate(sim, args.oneTimeDate, from);
    if (!date) return fail('oneTimeDate must be YYYY-MM-DD or YYYY-MM');
    payments.unshift({ date, amount: oneTime });
  }
  if (!payments.length) return fail('No installments left in that period.');

  const base = sim.baseline();
  const result = sim.run({ payments });
  const extraPaid = hypotheticalPaid(result);
  const saved = base.totalInterest - result.totalInterest;
  const fee = feeOf(args, extraPaid);
  const flow = cashFlow(ctx.items);

  return {
    loan: snapshot.name,
    extraAmount: whole(amount),
    everyMonths,
    firstExtraOn: result.applied[oneTime > 0 ? 1 : 0] || result.applied[0],
    ...(oneTime > 0 && { oneTimeAmount: whole(oneTime), oneTimeOn: result.applied[0] }),
    extraPaymentsMade: result.rows.filter((row) => row.hypothetical).length,
    totalExtraPaid: whole(extraPaid),
    withoutExtra: summarize(base),
    withExtra: summarize(result),
    interestSaved: whole(saved),
    ...(fee > 0 && { fee: whole(fee), netSaving: whole(saved - fee) }),
    ...timeSaved(base, result),
    ...(flow?.last12Months && {
      monthlyExtraVsAvgSurplus12m: flow.last12Months.avgSurplus
        ? `${round((amount / everyMonths / flow.last12Months.avgSurplus) * 100, 1)}%`
        : 'n/a',
      cashFlow: flow,
    }),
  };
};

const solveLoanGoal = (ctx: LoanToolContext, args: Args): ToolResult => {
  const resolved = resolveLoan(ctx, args.loan);
  if (isError(resolved)) return resolved.error;
  const { snapshot, sim } = resolved;
  const goal = String(args.goal || '');
  const method = goal === 'target_installment' ? 'one_time' : String(args.method || 'monthly_extra');
  const date = parseDate(sim, args.date, sim.defaultDate());
  if (!date) return fail('date must be YYYY-MM-DD or YYYY-MM');

  const targetDate = endOfPeriod(args.targetDate);
  const targetAmount = Number(args.targetAmount);
  if (goal === 'payoff_by' && !targetDate) return fail('payoff_by needs targetDate');
  if (goal !== 'payoff_by' && !(targetAmount >= 0 && args.targetAmount != null)) {
    return fail(`${goal} needs targetAmount`);
  }
  if (!['payoff_by', 'target_installment', 'max_future_interest'].includes(goal)) {
    return fail('goal must be payoff_by, target_installment or max_future_interest');
  }

  const base = sim.baseline();
  const evaluate = (x: number): ScenarioResult => {
    if (x <= 0) return base;
    if (method === 'one_time') {
      return sim.runExtra({ date, amount: x }, goal === 'target_installment' ? 'reduce_installment' : 'reduce_term');
    }
    return sim.run({ payments: recurringPayments(sim, x, 1, date, null) });
  };
  const installmentOf = (result: ScenarioResult) => {
    const after = regularAfter(result, result.applied[0] || addDays(date, -1));
    return after ? after.installment : 0;
  };
  const met = (result: ScenarioResult) => {
    if (goal === 'payoff_by') return result.payoffDate <= targetDate!;
    if (goal === 'target_installment') return installmentOf(result) <= targetAmount;
    return result.futureInterest <= targetAmount;
  };

  const current = {
    payoffDate: base.payoffDate,
    nextInstallment: installmentOf(base) ? whole(installmentOf(base)) : null,
    futureInterest: whole(base.futureInterest),
  };
  if (met(base)) return { loan: snapshot.name, goal, alreadyMet: true, current };

  let lo = 0;
  let hi = Math.max(1, remainingNow(sim));
  if (!met(evaluate(hi))) {
    return {
      loan: snapshot.name,
      goal,
      feasible: false,
      current,
      note:
        method === 'monthly_extra'
          ? 'Not reachable even by paying the whole balance with the first extra payment (target date too early).'
          : 'Not reachable with a single payment on that date.',
    };
  }
  for (let i = 0; i < 32 && hi - lo > 1; i++) {
    const mid = (lo + hi) / 2;
    if (met(evaluate(mid))) hi = mid;
    else lo = mid;
  }
  const step = hi > 1000 ? 10 : 1;
  const required = Math.ceil(hi / step) * step;
  const result = evaluate(required);

  return {
    loan: snapshot.name,
    goal,
    method,
    feasible: true,
    requiredAmount: required,
    ...(method === 'monthly_extra' && {
      meaning: 'extra paid with every installment',
      totalExtraPaid: whole(hypotheticalPaid(result)),
    }),
    from: result.applied[0],
    current,
    withPlan: {
      payoffDate: result.payoffDate,
      nextInstallment: installmentOf(result) ? whole(installmentOf(result)) : null,
      futureInterest: whole(result.futureInterest),
    },
    interestSaved: whole(base.totalInterest - result.totalInterest),
    ...timeSaved(base, result),
  };
};

const simulateRateChange = (ctx: LoanToolContext, args: Args): ToolResult => {
  const resolved = resolveLoan(ctx, args.loan);
  if (isError(resolved)) return resolved.error;
  const { snapshot, sim } = resolved;
  const rate = Number(args.rate);
  if (!(rate >= 0) || args.rate == null) return fail('rate must be a number >= 0');
  const date = parseDate(sim, args.date, sim.defaultDate());
  if (!date) return fail('date must be YYYY-MM-DD or YYYY-MM');
  const keepInstallment = args.keepInstallment === true;
  const fee = Number(args.refinanceFee) > 0 ? Number(args.refinanceFee) : 0;

  const base = sim.baseline();
  const result = sim.run({ rateChange: { date, rate, keepInstallment } });
  const effective = result.rateDate || date;
  const before = regularAfter(base, effective);
  const after = regularAfter(result, effective);
  const interestChange = result.totalInterest - base.totalInterest;
  const monthlyChange = before && after ? after.installment - before.installment : 0;

  return {
    loan: snapshot.name,
    currentRate: snapshot.currentRate,
    newRate: rate,
    effectiveFrom: effective,
    keepInstallment,
    ...(!keepInstallment && { note: 'Installment recalculated so the loan still ends on its current payoff date.' }),
    current: summarize(base, effective),
    withNewRate: summarize(result, effective),
    installmentChange: whole(monthlyChange),
    interestChange: whole(interestChange),
    ...(keepInstallment && { monthsChange: monthsBetween(base.payoffDate, result.payoffDate) }),
    ...(fee > 0 && {
      refinanceFee: whole(fee),
      netSaving: whole(-interestChange - fee),
      breakEvenMonths: monthlyChange < 0 ? Math.ceil(fee / -monthlyChange) : null,
    }),
  };
};

const amortizationSchedule = (ctx: LoanToolContext, args: Args): ToolResult => {
  const resolved = resolveLoan(ctx, args.loan, { activeOnly: false });
  if (isError(resolved)) return resolved.error;
  const { snapshot, sim } = resolved;
  const base = sim.baseline();
  const from = startOfPeriod(args.from);
  const to = endOfPeriod(args.to);
  if ((args.from && !from) || (args.to && !to)) return fail('from/to must be YYYY, YYYY-MM or YYYY-MM-DD');
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
  const rows = base.rows.filter((row) =>
    from || to ? inRange(row.date) : !row.paid
  );
  const limit = clampLimit(args.limit, AI_LIMITS.toolRowsDefault, AI_LIMITS.toolRowsMax);

  const regular = base.rows.filter((row) => !row.extra);
  const principal = snapshot.principal || (base.rows[0] ? base.rows[0].remaining + base.rows[0].principal : 0);
  const milestones = [25, 50, 75, 100].map((percent) => {
    const row = base.rows.find((r) => r.remaining <= Math.max(1, principal * (1 - percent / 100)));
    return `${percent}%|${row ? row.date : '-'}|${row ? (row.paid ? 'reached' : 'forecast') : '-'}`;
  });
  const crossover = regular.find((row) => row.principal >= row.interest);
  const next = nextRegular(base);

  let table: ToolResult;
  if (args.groupBy === 'year') {
    const years = new Map<string, { n: number; inst: number; p: number; i: number; fee: number; paid: number; end: number }>();
    for (const row of rows) {
      const key = row.date.slice(0, 4);
      const y = years.get(key) || { n: 0, inst: 0, p: 0, i: 0, fee: 0, paid: 0, end: 0 };
      y.n++;
      y.inst += row.installment;
      y.p += row.principal;
      y.i += row.interest;
      y.fee += row.fee;
      if (row.paid) y.paid++;
      y.end = row.remaining;
      years.set(key, y);
    }
    table = {
      columns: 'year|payments|paid total|principal|interest|fees|status|remaining at year end',
      rows: [...years.entries()]
        .slice(0, limit)
        .map(([year, y]) =>
          [year, y.n, whole(y.inst), whole(y.p), whole(y.i), whole(y.fee),
            y.paid === y.n ? 'paid' : y.paid ? 'partly paid' : 'forecast', whole(y.end)].join('|')
        )
        .join('\n'),
    };
  } else {
    const shown = rows.slice(0, limit);
    table = {
      matched: rows.length,
      truncated: rows.length > shown.length,
      columns: 'date|installment|principal|interest|remaining|rate%|status',
      rows: shown
        .map((row) =>
          [row.date, whole(row.installment), whole(row.principal), whole(row.interest), whole(row.remaining),
            row.rate, `${row.paid ? 'paid' : 'forecast'}${row.extra ? ' extra' : ''}`].join('|')
        )
        .join('\n'),
    };
  }

  return {
    loan: snapshot.name,
    contractEnd: sim.endIso,
    projectedPayoff: base.payoffDate,
    installmentsLeft: base.regularLeft,
    interestPaidSoFar: whole(base.rows.filter((r) => r.paid).reduce((s, r) => s + r.interest, 0)),
    futureInterest: whole(base.futureInterest),
    lifetimeInterest: whole(base.totalInterest),
    ...(next && {
      nextInstallmentSplit: `${next.date}: ${whole(next.installment)} = principal ${whole(next.principal)} + interest ${whole(next.interest)} (${round((next.interest / next.installment) * 100, 1)}% interest)`,
    }),
    principalExceedsInterestFrom: crossover
      ? `${crossover.date} (${crossover.paid ? 'reached' : 'forecast'})`
      : 'never in the current schedule',
    milestonesColumns: 'principal repaid|date|status',
    milestones: milestones.join('\n'),
    ...table,
  };
};

const allocateExtraPayment = (ctx: LoanToolContext, args: Args): ToolResult => {
  const amount = Number(args.amount);
  if (!(amount > 0)) return fail('amount must be positive');
  const active = ctx.loans.filter((loan) => loan.status === 'active');
  if (!active.length) return fail('No active loans.');

  const rows = active
    .map((loan) => resolveLoan(ctx, loan.name))
    .filter((r): r is Resolved => !isError(r))
    .map(({ snapshot, sim }) => {
      const date = parseDate(sim, args.date, sim.defaultDate()) || sim.defaultDate();
      const base = sim.baseline();
      const term = sim.runExtra({ date, amount }, 'reduce_term');
      const inst = sim.runExtra({ date, amount }, 'reduce_installment');
      const applied = term.applied[0];
      const before = regularAfter(base, applied);
      const after = regularAfter(inst, applied);
      const balance = remainingNow(sim);
      return {
        name: snapshot.name,
        rate: snapshot.currentRate,
        balance,
        termSaved: base.totalInterest - term.totalInterest,
        months: monthsBetween(term.payoffDate, base.payoffDate),
        instSaved: base.totalInterest - inst.totalInterest,
        drop: before && after ? before.installment - after.installment : 0,
        paysOff: amount >= balance,
      };
    })
    .sort((a, b) => b.termSaved - a.termSaved);

  return {
    amount: whole(amount),
    columns:
      'loan|current rate%|remaining principal|interest saved (shorter term)|months saved|interest saved (lower installment)|installment drop|pays off loan',
    rows: rows
      .map((r) =>
        [r.name, r.rate, whole(r.balance), whole(r.termSaved), r.months, whole(r.instSaved), whole(r.drop), r.paysOff ? 'yes' : 'no'].join('|')
      )
      .join('\n'),
    bestForInterest: rows[0]?.name,
    bestForMonthlyCashFlow: [...rows].sort((a, b) => b.drop - a.drop)[0]?.name,
    highestRate: [...rows].sort((a, b) => b.rate - a.rate)[0]?.name,
    note: 'Total interest saved favours long loans; the highest-rate loan gives the best saving per year. Mention both when they differ.',
  };
};

const comparePrepayVsInvest = (ctx: LoanToolContext, args: Args): ToolResult => {
  const resolved = resolveLoan(ctx, args.loan);
  if (isError(resolved)) return resolved.error;
  const { snapshot, sim } = resolved;
  const amount = Number(args.amount);
  const annualReturn = Number(args.annualReturn);
  if (!(amount > 0)) return fail('amount must be positive');
  if (!Number.isFinite(annualReturn)) return fail('annualReturn must be a number');
  const tax = Math.min(100, Math.max(0, Number(args.taxPercent) || 0)) / 100;
  const date = parseDate(sim, args.date, sim.defaultDate());
  if (!date) return fail('date must be YYYY-MM-DD or YYYY-MM');

  const base = sim.baseline();
  const prepay = sim.runExtra({ date, amount }, 'reduce_term');
  const horizon = base.payoffDate;
  const horizonMonths = Math.max(0, monthsBetween(date, horizon));
  // Installments the prepayment removes; they can be invested once the loan is closed.
  const freed = base.rows.filter((row) => !row.paid && !row.extra && row.date > prepay.payoffDate);

  const grow = (value: number, months: number, yearly: number) => {
    const gross = value * Math.pow(1 + yearly / 100 / 12, months);
    return value + (gross - value) * (1 - tax);
  };
  const prepayWealth = (yearly: number) =>
    freed.reduce((sum, row) => sum + grow(row.installment, Math.max(0, monthsBetween(row.date, horizon)), yearly), 0);
  const investWealth = (yearly: number) => grow(amount, horizonMonths, yearly);

  let breakEven: number | null = null;
  if (prepayWealth(0) > investWealth(0) && prepayWealth(100) < investWealth(100)) {
    let lo = 0;
    let hi = 100;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (prepayWealth(mid) > investWealth(mid)) lo = mid;
      else hi = mid;
    }
    breakEven = round((lo + hi) / 2, 2);
  }

  const a = prepayWealth(annualReturn);
  const b = investWealth(annualReturn);
  return {
    loan: snapshot.name,
    loanRate: snapshot.currentRate,
    amount: whole(amount),
    annualReturn,
    taxPercent: tax * 100,
    horizon: `${date}..${horizon} (${horizonMonths} months, original payoff)`,
    prepay: {
      interestSaved: whole(base.totalInterest - prepay.totalInterest),
      newPayoffDate: prepay.payoffDate,
      monthsSaved: monthsBetween(prepay.payoffDate, horizon),
      wealthAtHorizon: whole(a),
      explanation: 'freed installments invested at the same return after the loan closes',
    },
    invest: { wealthAtHorizon: whole(b) },
    better: a >= b ? 'prepay' : 'invest',
    difference: whole(Math.abs(a - b)),
    breakEvenReturnPercent: breakEven,
    cashFlow: cashFlow(ctx.items),
    caveat: 'Prepaid money is no longer available; keep an emergency fund. Investment returns are not guaranteed.',
  };
};

export const loanToolExecutors: Record<string, (ctx: LoanToolContext, args: Args) => ToolResult> = {
  simulate_extra_payment: simulateExtraPayment,
  get_extra_payments_impact: extraPaymentsImpact,
  simulate_recurring_extra: simulateRecurringExtra,
  solve_loan_goal: solveLoanGoal,
  simulate_rate_change: simulateRateChange,
  get_amortization_schedule: amortizationSchedule,
  allocate_extra_payment: allocateExtraPayment,
  compare_prepay_vs_invest: comparePrepayVsInvest,
};

export const LOAN_TOOL_LABELS: Record<string, string> = {
  simulate_extra_payment: 'Simulating an extra payment',
  get_extra_payments_impact: 'Measuring extra payments',
  simulate_recurring_extra: 'Simulating extra payments',
  solve_loan_goal: 'Solving the loan goal',
  simulate_rate_change: 'Simulating a rate change',
  get_amortization_schedule: 'Reading the schedule',
  allocate_extra_payment: 'Comparing loans',
  compare_prepay_vs_invest: 'Comparing prepay and invest',
};
