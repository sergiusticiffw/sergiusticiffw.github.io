/**
 * AI tools for the emergency fund / Goals feature (read-only).
 */
import {
  NON_ESSENTIAL_CATEGORY_IDS,
  type Contribution,
  type EmergencyFundState,
  monthsCovered,
  monthsToGoal,
  progressRatio,
  resolveTarget,
} from '@features/goals/model';
import type { GeminiFunctionDeclaration } from '../client';
import { AI_LIMITS } from '../config';
import { AiItem, categoryLabel, localToday, round } from '../data';

export interface GoalToolContext {
  items: AiItem[];
  goalsEnabled: boolean;
  emergencyFund: EmergencyFundState | null;
}

type Args = Record<string, any>;
type ToolResult = Record<string, unknown>;

const MOVEMENT_COLUMNS = 'month|amount|createdAt|sign';

/** Stable English labels for excluded cats (ids 2,4,11,13). */
const EXCLUDED_ID_ORDER = ['2', '4', '11', '13'] as const;

const clampLimit = (value: unknown, fallback: number, max: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};

/** Essential monthly average from AI items — same rules as Goals page. */
export const averageEssentialSpendFromItems = (
  items: AiItem[],
  today = new Date()
): number => {
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const byMonth = new Map<string, number>();

  for (const item of items) {
    if (item.kind !== 'expense') continue;
    if (NON_ESSENTIAL_CATEGORY_IDS.has(String(item.cat ?? ''))) continue;
    if (!item.month || item.month >= current) continue;
    if (!Number.isFinite(item.amount) || item.amount <= 0) continue;
    byMonth.set(item.month, (byMonth.get(item.month) || 0) + item.amount);
  }

  if (!byMonth.size) return 0;
  let total = 0;
  for (const value of byMonth.values()) total += value;
  return total / byMonth.size;
};

const excludedLabels = () =>
  EXCLUDED_ID_ORDER.map((id) => categoryLabel(id)).filter(Boolean);

const ledgerTotals = (contributions: Contribution[]) => {
  let deposits = 0;
  let withdrawals = 0;
  for (const entry of contributions) {
    if (entry.amount > 0) deposits += entry.amount;
    else withdrawals += Math.abs(entry.amount);
  }
  return { deposits, withdrawals };
};

const requireFund = (
  ctx: GoalToolContext
): EmergencyFundState | { error: string } => {
  if (!ctx.goalsEnabled || !ctx.emergencyFund) {
    return { error: 'Emergency fund is disabled' };
  }
  return ctx.emergencyFund;
};

const getEmergencyFund = (ctx: GoalToolContext, _args: Args): ToolResult => {
  const fund = requireFund(ctx);
  if ('error' in fund) return fund;

  const avgSpend = averageEssentialSpendFromItems(ctx.items);
  const target = resolveTarget(fund, avgSpend);
  const covered = monthsCovered(fund.balance, avgSpend);
  const ratio = progressRatio(fund.balance, target);
  const eta = monthsToGoal(fund.balance, target, fund.monthlyContribution);
  const left = Math.max(0, target - fund.balance);
  const { deposits, withdrawals } = ledgerTotals(fund.contributions ?? []);

  return {
    balance: round(fund.balance),
    targetMonths: fund.targetMonths,
    target: round(target),
    averageEssentialMonthlySpend: round(avgSpend),
    monthsCovered: round(covered, 1),
    progress: round(ratio, 4),
    left: round(left),
    etaMonths: eta == null ? null : round(eta, 1),
    plannedMonthlyContribution:
      fund.monthlyContribution == null
        ? null
        : round(fund.monthlyContribution),
    movementCount: fund.contributions?.length ?? 0,
    depositsTotal: round(deposits),
    withdrawalsTotal: round(withdrawals),
    excludedCategories: excludedLabels(),
    updatedAt: fund.updatedAt,
    asOf: localToday(),
  };
};

const queryFundMovements = (ctx: GoalToolContext, args: Args): ToolResult => {
  const fund = requireFund(ctx);
  if ('error' in fund) return fund;

  const month =
    typeof args.month === 'string' && /^\d{4}-\d{2}$/.test(args.month)
      ? args.month
      : null;
  const kind = args.kind === 'deposit' || args.kind === 'withdrawal' ? args.kind : 'all';
  const limit = clampLimit(args.limit, AI_LIMITS.toolRowsDefault, AI_LIMITS.toolRowsMax);

  let rows = [...(fund.contributions ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  if (month) rows = rows.filter((entry) => entry.month === month);
  if (kind === 'deposit') rows = rows.filter((entry) => entry.amount > 0);
  if (kind === 'withdrawal') rows = rows.filter((entry) => entry.amount < 0);

  const shown = rows.slice(0, limit);
  const total = rows.reduce((sum, entry) => sum + entry.amount, 0);

  return {
    matched: rows.length,
    total: round(total),
    shown: shown.length,
    truncated: rows.length > shown.length,
    columns: MOVEMENT_COLUMNS,
    rows: shown
      .map((entry) => {
        const sign = entry.amount < 0 ? 'withdrawal' : 'deposit';
        return `${entry.month}|${round(entry.amount)}|${entry.createdAt}|${sign}`;
      })
      .join('\n'),
  };
};

/** Short DATA SUMMARY block when Goals is enabled. */
export const formatGoalsSummary = (
  fund: EmergencyFundState,
  items: AiItem[]
): string => {
  const avgSpend = averageEssentialSpendFromItems(items);
  const target = resolveTarget(fund, avgSpend);
  const covered = monthsCovered(fund.balance, avgSpend);
  const eta = monthsToGoal(fund.balance, target, fund.monthlyContribution);
  const movements = fund.contributions?.length ?? 0;
  const etaText =
    eta == null ? 'unknown (set a planned monthly contribution)' : `${round(eta, 1)} mo`;

  return [
    'EMERGENCY FUND',
    `Balance ${round(fund.balance)}; target ${round(target)} (${fund.targetMonths} mo essential spend); months covered ${round(covered, 1)}; time to goal ${etaText}; planned contribution ${fund.monthlyContribution == null ? 'none' : round(fund.monthlyContribution)}; ledger movements ${movements}.`,
    `Essential spend excludes: ${excludedLabels().join(', ') || 'none'}.`,
    'For exact ledger rows or fund status details, call get_emergency_fund or query_fund_movements.',
  ].join('\n');
};

export const goalToolDeclarations: GeminiFunctionDeclaration[] = [
  {
    name: 'get_emergency_fund',
    description:
      'Emergency fund / Goals status: current balance, target, months covered, progress, time-to-goal, planned contribution, and deposit/withdrawal totals. Prefer this for "how much have I saved" or fund overview questions.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'query_fund_movements',
    description:
      'Emergency fund ledger entries (deposits and withdrawals), newest first. Optional month and kind filters.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'YYYY-MM. Omit for all months.' },
        kind: {
          type: 'string',
          enum: ['all', 'deposit', 'withdrawal'],
          description: 'Default all.',
        },
        limit: { type: 'integer', description: 'Max rows, default 50.' },
      },
    },
  },
];

export const goalToolExecutors: Record<
  string,
  (ctx: GoalToolContext, args: Args) => ToolResult
> = {
  get_emergency_fund: getEmergencyFund,
  query_fund_movements: queryFundMovements,
};

export const GOAL_TOOL_LABELS: Record<string, string> = {
  get_emergency_fund: 'Checking the emergency fund',
  query_fund_movements: 'Looking up fund movements',
};
