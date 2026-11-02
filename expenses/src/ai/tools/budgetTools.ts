import { monthNames } from '@shared/utils/constants';
import {
  BudgetBaseline,
  BudgetRing,
  BudgetSummary,
  BudgetWindow,
  budgetChoices,
  budgetStatus,
  buildBudgetBaseline,
  buildBudgets,
  countCompleteExpenseMonths,
  monthKeyLabel,
  monthPaceForView,
  summarizeBudgets,
} from '@features/expenses/budgets/model';
import type { GeminiFunctionDeclaration } from '../client';
import {
  AiItem,
  categoryLabel,
  localToday,
  round,
  sumAmounts,
  visibleDescription,
} from '../data';

export interface BudgetToolContext {
  items: AiItem[];
  shareDescriptions: boolean;
}

type Args = Record<string, any>;
type ToolResult = Record<string, unknown>;

const WINDOW_VALUES = new Set(['1', '3', '6', '12', 'all']);

const parseWindow = (value: unknown, fallback: BudgetWindow): BudgetWindow => {
  if (value === 'all' || value === 1 || value === 3 || value === 6 || value === 12) {
    return value;
  }
  if (typeof value === 'string' && WINDOW_VALUES.has(value)) {
    return value === 'all' ? 'all' : (Number(value) as 1 | 3 | 6 | 12);
  }
  return fallback;
};

const parseMonth = (value: unknown): string | { error: string } => {
  const month = String(value || localToday().slice(0, 7)).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: 'month must be YYYY-MM' };
  return month;
};

const clampLimit = (value: unknown, fallback: number, max: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};

const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

type BaselineOk = {
  month: string;
  monthLabel: string;
  window: BudgetWindow;
  baselineMonths: string[];
  pace: number;
  isCurrentMonth: boolean;
  rings: BudgetRing[];
  summary: BudgetSummary;
  unbudgeted: BudgetBaseline['unbudgeted'];
  availableWindows: BudgetWindow[];
};

const resolveBaseline = (
  ctx: BudgetToolContext,
  args: Args
): BaselineOk | { error: string; month?: string; window?: BudgetWindow; completeMonths?: number } => {
  const monthOrError = parseMonth(args.month);
  if (typeof monthOrError !== 'string') return monthOrError;

  const complete = countCompleteExpenseMonths(ctx.items, monthOrError);
  const { options, defaultWindow } = budgetChoices(complete);
  if (!options.length) {
    return {
      error:
        'Not enough completed months to build budgets. Budgets unlock after at least one full month of expenses.',
      month: monthOrError,
      completeMonths: complete,
    };
  }

  const requested = parseWindow(args.window, defaultWindow);
  const window = options.includes(requested) ? requested : defaultWindow;
  const baseline = buildBudgetBaseline(ctx.items, monthOrError, window);
  if (!baseline) {
    return {
      error: 'No budget baseline for this month and window.',
      month: monthOrError,
      window,
      completeMonths: complete,
    };
  }

  const today = localToday();
  const pace = monthPaceForView(monthOrError, today);
  const rings = buildBudgets(baseline);
  const summary = summarizeBudgets(rings);

  return {
    month: monthOrError,
    monthLabel: monthKeyLabel(monthOrError),
    window,
    baselineMonths: baseline.months,
    pace: round(pace, 3),
    isCurrentMonth: today.slice(0, 7) === monthOrError,
    rings,
    summary,
    unbudgeted: baseline.unbudgeted,
    availableWindows: options,
  };
};

/** Same figures as the Budgets rings on Home: spent vs average budget per category. */
const getBudgetStatus = (ctx: BudgetToolContext, args: Args): ToolResult => {
  const resolved = resolveBaseline(ctx, args);
  if ('error' in resolved) return resolved;

  const {
    month,
    monthLabel,
    window,
    baselineMonths,
    pace,
    isCurrentMonth,
    rings,
    summary,
    unbudgeted,
    availableWindows,
  } = resolved;

  const cats = Array.isArray(args.categories)
    ? new Set(args.categories.map(String))
    : null;
  const filtered = cats ? rings.filter((ring) => cats.has(ring.id)) : rings;

  return {
    month: monthLabel,
    monthKey: month,
    window,
    baselineMonths: baselineMonths.join(', '),
    availableWindows: availableWindows.join(', '),
    pace,
    isCurrentMonth,
    overall: {
      spent: summary.spent,
      budget: summary.budget,
      left: round(summary.budget - summary.spent),
      ratio: round(summary.ratio, 3),
      status: budgetStatus(summary.ratio, pace),
      overCategories: summary.over,
    },
    categoriesColumns: 'category|spent|budget|left|ratio|status',
    categories: filtered
      .map((ring) => {
        const status = budgetStatus(ring.ratio, pace);
        return `${ring.label}|${ring.spent}|${ring.budget}|${ring.left}|${round(ring.ratio, 3)}|${status}`;
      })
      .join('\n'),
    unbudgetedColumns: 'category|spent',
    unbudgeted: unbudgeted
      .filter((row) => !cats || cats.has(row.id))
      .map((row) => `${row.label}|${row.spent}`)
      .join('\n'),
    note: 'budget = average spend in the baseline months (same as Home budgets). status: ok / ahead (faster than pace) / over.',
  };
};

/** Ranked overspend / headroom vs budget, with optional end-of-month projection. */
const compareBudgetVsSpend = (ctx: BudgetToolContext, args: Args): ToolResult => {
  const resolved = resolveBaseline(ctx, args);
  if ('error' in resolved) return resolved;

  const {
    month,
    monthLabel,
    window,
    baselineMonths,
    pace,
    isCurrentMonth,
    rings,
    summary,
  } = resolved;

  const cats = Array.isArray(args.categories)
    ? new Set(args.categories.map(String))
    : null;
  const filtered = cats ? rings.filter((ring) => cats.has(ring.id)) : rings;

  const over = filtered
    .filter((ring) => ring.ratio > 1.001)
    .sort((a, b) => b.spent - b.budget - (a.spent - a.budget));
  const under = filtered
    .filter((ring) => ring.left > 0)
    .sort((a, b) => b.left - a.left);

  const result: ToolResult = {
    month: monthLabel,
    monthKey: month,
    window,
    baselineMonths: baselineMonths.join(', '),
    pace,
    isCurrentMonth,
    totalSpent: summary.spent,
    totalBudget: summary.budget,
    totalLeft: round(summary.budget - summary.spent),
    totalOverspend: round(
      over.reduce((sum, ring) => sum + Math.max(0, ring.spent - ring.budget), 0)
    ),
    overColumns: 'category|spent|budget|over|ratio',
    over: over
      .map(
        (ring) =>
          `${ring.label}|${ring.spent}|${ring.budget}|${round(ring.spent - ring.budget)}|${round(ring.ratio, 3)}`
      )
      .join('\n'),
    headroomColumns: 'category|spent|budget|left|ratio',
    headroom: under
      .slice(0, clampLimit(args.limit, 20, 60))
      .map(
        (ring) =>
          `${ring.label}|${ring.spent}|${ring.budget}|${ring.left}|${round(ring.ratio, 3)}`
      )
      .join('\n'),
  };

  if (isCurrentMonth && pace > 0) {
    const projected = filtered.map((ring) => {
      const endSpend = round(ring.spent / pace);
      return {
        label: ring.label,
        spent: ring.spent,
        budget: ring.budget,
        projected: endSpend,
        projectedOver: round(Math.max(0, endSpend - ring.budget)),
      };
    });
    const bust = projected
      .filter((row) => row.projected > row.budget * 1.001)
      .sort((a, b) => b.projectedOver - a.projectedOver);
    result.projectionNote =
      'Linear projection to month end from days elapsed so far (same pace idea as Home).';
    result.projectedOverallSpent = round(summary.spent / pace);
    result.projectedOverallLeft = round(summary.budget - summary.spent / pace);
    result.projectedOverColumns = 'category|spentSoFar|budget|projectedMonth|projectedOver';
    result.projectedOver = bust
      .map(
        (row) =>
          `${row.label}|${row.spent}|${row.budget}|${row.projected}|${row.projectedOver}`
      )
      .join('\n');
  }

  return result;
};

/** Deterministic category and transaction spend spikes vs recent history. */
const detectSpendSpikes = (ctx: BudgetToolContext, args: Args): ToolResult => {
  const monthOrError = parseMonth(args.month);
  if (typeof monthOrError !== 'string') return monthOrError;

  const lookback = clampLimit(args.lookbackMonths, 12, 36);
  const minRatio = typeof args.minRatio === 'number' && args.minRatio > 1 ? args.minRatio : 1.5;
  const limit = clampLimit(args.limit, 10, 40);
  const lastMonth = shiftMonth(monthOrError, -1);
  const fromMonth = shiftMonth(monthOrError, -lookback);

  const expenses = ctx.items.filter((i) => i.kind === 'expense');
  const current = expenses.filter((i) => i.month === monthOrError);
  const history = expenses.filter(
    (i) => i.month >= fromMonth && i.month <= lastMonth
  );

  if (!current.length) {
    return {
      month: monthKeyLabel(monthOrError),
      monthKey: monthOrError,
      spikes: 0,
      note: 'No expenses in this month.',
    };
  }

  const historyMonths = [
    ...new Set(history.map((i) => i.month)),
  ].sort();
  const monthCount = historyMonths.length || 1;

  const histByCat = new Map<string, number>();
  const histAmountsByCat = new Map<string, number[]>();
  for (const item of history) {
    histByCat.set(item.cat, (histByCat.get(item.cat) || 0) + item.amount);
    const list = histAmountsByCat.get(item.cat) || [];
    list.push(item.amount);
    histAmountsByCat.set(item.cat, list);
  }

  const currentByCat = new Map<string, number>();
  for (const item of current) {
    currentByCat.set(item.cat, (currentByCat.get(item.cat) || 0) + item.amount);
  }

  const categorySpikes = [...currentByCat.entries()]
    .map(([cat, spent]) => {
      const avg = (histByCat.get(cat) || 0) / monthCount;
      const ratio = avg > 0 ? spent / avg : 0;
      return {
        cat,
        label: categoryLabel(cat) || 'Uncategorized',
        spent: round(spent),
        avg: round(avg),
        ratio: round(ratio, 2),
        over: round(Math.max(0, spent - avg)),
      };
    })
    .filter(
      (row) =>
        row.avg > 0 &&
        row.ratio >= minRatio &&
        row.spent >= 50 &&
        (categoryLabel(row.cat) || row.cat === '0' || row.cat === '')
    )
    .sort((a, b) => b.ratio - a.ratio || b.over - a.over)
    .slice(0, limit);

  const transactionSpikes = current
    .map((item) => {
      const historyAmounts = histAmountsByCat.get(item.cat) || [];
      const typical = median(historyAmounts);
      const max = historyAmounts.length ? Math.max(...historyAmounts) : 0;
      const ratio = typical > 0 ? item.amount / typical : 0;
      return { item, typical, max, ratio, historyCount: historyAmounts.length };
    })
    .filter(
      (row) =>
        row.historyCount >= 5 &&
        row.typical > 0 &&
        row.ratio >= Math.max(minRatio, 2.5) &&
        row.item.amount >= row.max * 0.75
    )
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, limit);

  const histMonthTotals = historyMonths.map((m) =>
    sumAmounts(history.filter((i) => i.month === m))
  );
  const avgMonth = histMonthTotals.length
    ? histMonthTotals.reduce((a, b) => a + b, 0) / histMonthTotals.length
    : 0;
  const monthSpent = sumAmounts(current);
  const monthRatio = avgMonth > 0 ? monthSpent / avgMonth : 0;

  return {
    month: monthKeyLabel(monthOrError),
    monthKey: monthOrError,
    lookbackMonths: lookback,
    baselineMonths: historyMonths.length,
    minRatio,
    monthTotal: monthSpent,
    avgMonthTotal: round(avgMonth),
    monthVsAvgRatio: avgMonth > 0 ? round(monthRatio, 2) : null,
    monthSpike: avgMonth > 0 && monthRatio >= minRatio,
    categorySpikesColumns: 'category|spent|avgPrevMonths|ratio|overAvg',
    categorySpikes: categorySpikes
      .map(
        (row) =>
          `${row.label}|${row.spent}|${row.avg}|${row.ratio}|${row.over}`
      )
      .join('\n'),
    transactionSpikesColumns: 'date|amount|category|median|ratio|description',
    transactionSpikes: transactionSpikes
      .map(({ item, typical, ratio }) => {
        const label = categoryLabel(item.cat) || 'Uncategorized';
        const desc = visibleDescription(item.desc, ctx.shareDescriptions);
        return `${item.date}|${round(item.amount)}|${label}|${round(typical)}|${round(ratio, 2)}|${desc}`;
      })
      .join('\n'),
    note: 'Spikes are deterministic: category total vs average of prior months, and single expenses vs category median.',
  };
};

/** Monthly savings rate (income - expenses) / income over a range. */
const getSavingsRateTrend = (ctx: BudgetToolContext, args: Args): ToolResult => {
  const today = localToday();
  const defaultTo = today.slice(0, 7);
  const monthsBack = clampLimit(args.months, 12, 36);
  const to = String(args.to || defaultTo).slice(0, 7);
  const from = String(args.from || shiftMonth(to, -(monthsBack - 1))).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    return { error: 'from and to must be YYYY-MM' };
  }
  if (from > to) return { error: 'from must be <= to' };

  const keys: string[] = [];
  for (let m = from; m <= to; m = shiftMonth(m, 1)) {
    keys.push(m);
    if (keys.length > 48) break;
  }

  const rows = keys.map((month) => {
    const inMonth = ctx.items.filter((i) => i.month === month);
    const income = sumAmounts(inMonth.filter((i) => i.kind === 'income'));
    const spent = sumAmounts(inMonth.filter((i) => i.kind === 'expense'));
    const saved = round(income - spent);
    const rate = income > 0 ? round((saved / income) * 100, 1) : null;
    const [y, mo] = month.split('-').map(Number);
    return {
      month,
      label: `${monthNames[mo - 1]} ${y}`,
      income,
      spent,
      saved,
      rate,
    };
  });

  const withIncome = rows.filter((row) => row.rate !== null);
  const rates = withIncome.map((row) => row.rate as number);
  const avgRate = rates.length
    ? round(rates.reduce((a, b) => a + b, 0) / rates.length, 1)
    : null;

  const half = Math.floor(withIncome.length / 2);
  const earlier = withIncome.slice(0, half);
  const later = withIncome.slice(half);
  const avg = (list: typeof withIncome) =>
    list.length
      ? round(list.reduce((sum, row) => sum + (row.rate as number), 0) / list.length, 1)
      : null;
  const earlierAvg = avg(earlier);
  const laterAvg = avg(later);

  let direction: 'improving' | 'worsening' | 'flat' | 'n/a' = 'n/a';
  if (earlierAvg !== null && laterAvg !== null) {
    const delta = laterAvg - earlierAvg;
    direction = Math.abs(delta) < 1 ? 'flat' : delta > 0 ? 'improving' : 'worsening';
  }

  const best = withIncome.slice().sort((a, b) => (b.rate as number) - (a.rate as number))[0];
  const worst = withIncome.slice().sort((a, b) => (a.rate as number) - (b.rate as number))[0];

  return {
    from,
    to,
    months: rows.length,
    monthsWithIncome: withIncome.length,
    averageSavingsRatePercent: avgRate,
    earlierHalfAvgPercent: earlierAvg,
    laterHalfAvgPercent: laterAvg,
    direction,
    bestMonth: best
      ? `${best.label}|${best.rate}%|saved ${best.saved}`
      : null,
    worstMonth: worst
      ? `${worst.label}|${worst.rate}%|saved ${worst.saved}`
      : null,
    columns: 'month|income|spent|saved|savingsRate%',
    rows: rows
      .map(
        (row) =>
          `${row.label}|${row.income}|${row.spent}|${row.saved}|${row.rate === null ? 'n/a' : row.rate}`
      )
      .join('\n'),
    note: 'savingsRate% = (income - expenses) / income * 100. Months with no income show n/a.',
  };
};

export const budgetToolDeclarations: GeminiFunctionDeclaration[] = [
  {
    name: 'get_budget_status',
    description:
      'Home-style monthly budgets: spent vs average budget per category, remaining, and ok/ahead/over status vs month pace. Prefer this for "am I on budget" questions.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'YYYY-MM. Default current month.' },
        window: {
          type: 'string',
          enum: ['1', '3', '6', '12', 'all'],
          description:
            'Baseline window in completed months (same as Home). Default picks a sensible window.',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional category ids to include.',
        },
      },
    },
  },
  {
    name: 'compare_budget_vs_spend',
    description:
      'Ranked overspend and remaining headroom vs budget for a month. For the current month also projects end-of-month overspend at current pace.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'YYYY-MM. Default current month.' },
        window: {
          type: 'string',
          enum: ['1', '3', '6', '12', 'all'],
          description: 'Baseline window. Default picks a sensible window.',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional category ids to include.',
        },
        limit: { type: 'integer', description: 'Max headroom rows, default 20.' },
      },
    },
  },
  {
    name: 'detect_spend_spikes',
    description:
      'Deterministic spend anomalies: categories well above their recent monthly average, and single expenses far above the category median. Prefer this over guessing from DATA SUMMARY.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'YYYY-MM to inspect. Default current month.' },
        lookbackMonths: {
          type: 'integer',
          description: 'Prior months used as baseline, default 12.',
        },
        minRatio: {
          type: 'number',
          description: 'Minimum multiple of average to count as a spike, default 1.5.',
        },
        limit: { type: 'integer', description: 'Max spikes per list, default 10.' },
      },
    },
  },
  {
    name: 'get_savings_rate_trend',
    description:
      'Month-by-month savings rate ((income - expenses) / income), averages, and whether the rate is improving or worsening. Prefer this for savings / "where does the money go" trend questions.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start month YYYY-MM.' },
        to: { type: 'string', description: 'End month YYYY-MM. Default current.' },
        months: {
          type: 'integer',
          description: 'If from is omitted, how many months back from to (default 12).',
        },
      },
    },
  },
];

export const budgetToolExecutors: Record<
  string,
  (ctx: BudgetToolContext, args: Args) => ToolResult
> = {
  get_budget_status: getBudgetStatus,
  compare_budget_vs_spend: compareBudgetVsSpend,
  detect_spend_spikes: detectSpendSpikes,
  get_savings_rate_trend: getSavingsRateTrend,
};

export const BUDGET_TOOL_LABELS: Record<string, string> = {
  get_budget_status: 'Checking budgets',
  compare_budget_vs_spend: 'Comparing budget and spend',
  detect_spend_spikes: 'Detecting spend spikes',
  get_savings_rate_trend: 'Tracking savings rate',
};
