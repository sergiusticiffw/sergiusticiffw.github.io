import { AiItem, categoryLabel, round } from '../../../ai/data';
import { monthNames } from '@shared/utils/constants';

export type BudgetWindow = 1 | 3 | 6 | 12 | 'all';

export const monthKeyLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) return key;
  return `${monthNames[month - 1]} ${year}`;
};

/** Convert Home month label ("October 2026") to YYYY-MM. */
export const labelToMonthKey = (label: string): string | null => {
  const match = /^([A-Za-z]+) (\d{4})$/.exec(label.trim());
  if (!match) return null;
  const index = monthNames.indexOf(match[1]);
  if (index < 0) return null;
  return `${match[2]}-${String(index + 1).padStart(2, '0')}`;
};

/** Share of a month that has elapsed for the viewed month. */
export const monthPaceForView = (viewedKey: string, today: string): number => {
  const current = today.slice(0, 7);
  if (viewedKey < current) return 1;
  if (viewedKey > current) return 0;
  const [year, month, day] = today.split('-').map(Number);
  return Math.min(1, day / new Date(year, month, 0).getDate());
};

export type BudgetStatus = 'ok' | 'ahead' | 'over';

export const budgetStatus = (ratio: number, pace: number): BudgetStatus => {
  if (ratio > 1.001) return 'over';
  if (ratio > pace + 0.15) return 'ahead';
  return 'ok';
};

export const budgetChoices = (
  completeMonths: number
): { options: BudgetWindow[]; defaultWindow: BudgetWindow } => {
  if (completeMonths <= 0) return { options: [], defaultWindow: 1 };

  const options: BudgetWindow[] = [];
  if (completeMonths >= 3) options.push(3);
  if (completeMonths >= 6) options.push(6);
  if (completeMonths >= 12) options.push(12);
  if (completeMonths >= 1 && completeMonths < 3) options.push(1);
  options.push('all');

  const defaultWindow: BudgetWindow =
    completeMonths >= 12
      ? 12
      : completeMonths >= 6
        ? 6
        : completeMonths >= 3
          ? 3
          : completeMonths >= 1
            ? 1
            : 'all';

  return { options, defaultWindow };
};

/** First day of the month after `viewedKey` (YYYY-MM), e.g. "November 1, 2026". */
export const budgetUnlockLabel = (viewedKey: string) => {
  const [year, month] = viewedKey.split('-').map(Number);
  const next = new Date(year, month, 1);
  return `${monthNames[next.getMonth()]} 1, ${next.getFullYear()}`;
};

export interface BudgetCategory {
  id: string;
  label: string;
  average: number;
}

export interface BudgetBaseline {
  months: string[];
  categories: BudgetCategory[];
  spentByCategory: Record<string, number>;
  /** Categories spent in the viewed month that have no average to compare against. */
  unbudgeted: { id: string; label: string; spent: number }[];
}

export interface BudgetRing {
  id: string;
  label: string;
  spent: number;
  budget: number;
  ratio: number;
  left: number;
}

export interface BudgetSummary {
  spent: number;
  budget: number;
  ratio: number;
  over: number;
}

const labelFor = (id: string) =>
  id === '0' || id === '' ? 'Uncategorized' : categoryLabel(id) || 'Category';

/** Completed months that contain expenses, oldest first. The viewed month is excluded. */
const expenseMonthsBefore = (items: AiItem[], viewedKey: string) =>
  [
    ...new Set(
      items
        .filter((item) => item.kind === 'expense' && item.month < viewedKey)
        .map((item) => item.month)
    ),
  ].sort();

export const countCompleteExpenseMonths = (
  items: AiItem[],
  viewedKey: string
) => expenseMonthsBefore(items, viewedKey).length;

export const buildBudgetBaseline = (
  items: AiItem[],
  viewedKey: string,
  windowSize: BudgetWindow
): BudgetBaseline | null => {
  const before = expenseMonthsBefore(items, viewedKey);
  const months =
    windowSize === 'all' ? before : before.slice(-windowSize);
  if (!months.length) return null;

  const monthSet = new Set(months);
  const totals = new Map<string, number>();
  const spentByCategory: Record<string, number> = {};

  for (const item of items) {
    if (item.kind !== 'expense') continue;
    const id = item.cat || '0';
    if (item.month === viewedKey) {
      spentByCategory[id] = (spentByCategory[id] || 0) + item.amount;
    }
    if (monthSet.has(item.month)) {
      totals.set(id, (totals.get(id) || 0) + item.amount);
    }
  }

  const categories = [...totals.entries()]
    .map(([id, total]) => ({
      id,
      label: labelFor(id),
      average: round(total / months.length),
    }))
    .filter((category) => category.average > 1)
    .sort((a, b) => b.average - a.average || a.label.localeCompare(b.label));

  if (!categories.length) return null;

  const budgeted = new Set(categories.map((category) => category.id));
  const unbudgeted = Object.entries(spentByCategory)
    .filter(([id, spent]) => !budgeted.has(id) && spent > 0)
    .map(([id, spent]) => ({ id, label: labelFor(id), spent: round(spent) }))
    .sort((a, b) => b.spent - a.spent);

  return {
    months,
    categories,
    spentByCategory: Object.fromEntries(
      Object.entries(spentByCategory).map(([id, value]) => [id, round(value)])
    ),
    unbudgeted,
  };
};

export const buildBudgets = (baseline: BudgetBaseline): BudgetRing[] =>
  baseline.categories
    .map((category) => {
      const spent = baseline.spentByCategory[category.id] || 0;
      return {
        id: category.id,
        label: category.label,
        spent,
        budget: category.average,
        ratio: spent / category.average,
        left: round(category.average - spent),
      };
    })
    .sort((a, b) => b.ratio - a.ratio || b.spent - a.spent);

export const summarizeBudgets = (rings: BudgetRing[]): BudgetSummary => {
  const spent = round(rings.reduce((sum, ring) => sum + ring.spent, 0));
  const budget = round(rings.reduce((sum, ring) => sum + ring.budget, 0));
  return {
    spent,
    budget,
    ratio: budget > 0 ? spent / budget : 0,
    over: rings.filter((ring) => ring.ratio > 1.001).length,
  };
};
