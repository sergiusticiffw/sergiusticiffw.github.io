import type { TransactionOrIncomeItem } from '@shared/type/types';

export type TargetMonths = 3 | 6 | 12;

export interface Contribution {
  id: string;
  /** Calendar month the saving belongs to, YYYY-MM. */
  month: string;
  amount: number;
  createdAt: string;
}

export interface MonthContributionGroup {
  month: string;
  total: number;
  entries: Contribution[];
}

export interface EmergencyFundState {
  balance: number;
  targetMonths: TargetMonths;
  /** Planned monthly amount for ETA only — not the ledger. */
  monthlyContribution: number | null;
  /** Ledger of amounts actually added to the fund. */
  contributions: Contribution[];
  updatedAt: string | null;
}

export const TARGET_MONTH_OPTIONS: TargetMonths[] = [3, 6, 12];

export const defaultEmergencyFund = (): EmergencyFundState => ({
  balance: 0,
  targetMonths: 6,
  monthlyContribution: null,
  contributions: [],
  updatedAt: null,
});

const normalizeContribution = (raw: unknown): Contribution | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<Contribution>;
  const month = String(item.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const amount = Number(item.amount);
  // Positive = deposit, negative = withdrawal from the fund.
  if (!Number.isFinite(amount) || amount === 0) return null;
  const id =
    typeof item.id === 'string' && item.id
      ? item.id
      : `c_${month}_${amount}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt =
    typeof item.createdAt === 'string' && item.createdAt
      ? item.createdAt
      : new Date().toISOString();
  return { id, month, amount, createdAt };
};

const normalizeContributions = (raw: unknown): Contribution[] => {
  if (!Array.isArray(raw)) return [];
  const list: Contribution[] = [];
  for (const item of raw) {
    const next = normalizeContribution(item);
    if (next) list.push(next);
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/** Balance is always the sum of ledger entries. */
export const contributionsTotal = (contributions: Contribution[]): number =>
  contributions.reduce((sum, entry) => sum + entry.amount, 0);

/** Normalize unknown JSON into a safe EmergencyFundState. */
export const normalizeEmergencyFund = (
  raw: Partial<EmergencyFundState> | null | undefined
): EmergencyFundState => {
  const base = defaultEmergencyFund();
  if (!raw || typeof raw !== 'object') return base;
  const targetMonths = [3, 6, 12].includes(Number(raw.targetMonths))
    ? (Number(raw.targetMonths) as TargetMonths)
    : base.targetMonths;
  const contributions = normalizeContributions(
    (raw as { contributions?: unknown }).contributions
  );
  const storedBalance =
    typeof raw.balance === 'number' && raw.balance >= 0
      ? raw.balance
      : base.balance;
  // Ledger is source of truth once any contribution exists (fixes doubled
  // balances left over from the old standalone Balance field).
  const balance =
    contributions.length > 0 ? contributionsTotal(contributions) : storedBalance;
  return {
    balance,
    targetMonths,
    monthlyContribution:
      typeof raw.monthlyContribution === 'number' &&
      raw.monthlyContribution > 0
        ? raw.monthlyContribution
        : null,
    contributions,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
};

export const currentMonthKey = (today = new Date()) =>
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

export const createContribution = (
  amount: number,
  month: string,
  now = new Date()
): Contribution => ({
  id: `c_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
  month,
  amount,
  createdAt: now.toISOString(),
});

/** Append a ledger entry; balance = sum of contributions. */
export const applyContribution = (
  state: EmergencyFundState,
  amount: number,
  month: string
): EmergencyFundState => {
  const entry = createContribution(amount, month);
  const contributions = [entry, ...state.contributions];
  return {
    ...state,
    balance: contributionsTotal(contributions),
    contributions,
    updatedAt: entry.createdAt,
  };
};

/** Update a ledger entry; balance = sum of contributions. */
export const updateContribution = (
  state: EmergencyFundState,
  id: string,
  patch: { amount: number; month: string }
): EmergencyFundState | null => {
  const existing = state.contributions.find((entry) => entry.id === id);
  if (!existing) return null;
  if (patch.amount === 0 || !Number.isFinite(patch.amount)) return null;
  if (!/^\d{4}-\d{2}$/.test(patch.month)) return null;
  const now = new Date().toISOString();
  const contributions = state.contributions
    .map((entry) =>
      entry.id === id
        ? { ...entry, amount: patch.amount, month: patch.month }
        : entry
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    ...state,
    balance: contributionsTotal(contributions),
    contributions,
    updatedAt: now,
  };
};

/** Remove a ledger entry; balance = sum of contributions. */
export const removeContribution = (
  state: EmergencyFundState,
  id: string
): EmergencyFundState | null => {
  const existing = state.contributions.find((entry) => entry.id === id);
  if (!existing) return null;
  const contributions = state.contributions.filter((entry) => entry.id !== id);
  return {
    ...state,
    balance: contributionsTotal(contributions),
    contributions,
    updatedAt: new Date().toISOString(),
  };
};

/** Group ledger entries by month, newest months first. */
export const groupContributionsByMonth = (
  contributions: Contribution[]
): MonthContributionGroup[] => {
  const map = new Map<string, Contribution[]>();
  for (const entry of contributions) {
    const list = map.get(entry.month) || [];
    list.push(entry);
    map.set(entry.month, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, entries]) => ({
      month,
      total: entries.reduce((sum, entry) => sum + entry.amount, 0),
      entries: entries
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }));
};

/** "October 2026" from YYYY-MM using English month names array. */
export const formatContributionMonth = (
  month: string,
  names: string[]
): string => {
  const [year, mo] = month.split('-').map(Number);
  if (!year || !mo || mo < 1 || mo > 12) return month;
  return `${names[mo - 1]} ${year}`;
};

/** Prefer the state with the newer updatedAt; ties keep `preferred`. */
export const newerEmergencyFund = (
  preferred: EmergencyFundState,
  other: EmergencyFundState | null
): EmergencyFundState => {
  if (!other) return preferred;
  if (!preferred.updatedAt) return other.updatedAt ? other : preferred;
  if (!other.updatedAt) return preferred;
  return other.updatedAt > preferred.updatedAt ? other : preferred;
};

const monthKey = (dt: string) => {
  const date = new Date(dt);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/**
 * Categories excluded from "essential" emergency-fund spend:
 * Entertainment (2), Gifts (4), Travel (11), Investment (13).
 */
export const NON_ESSENTIAL_CATEGORY_IDS = new Set(['2', '4', '11', '13']);

/** Localization keys for excluded categories (stable display order). */
export const NON_ESSENTIAL_CATEGORY_LABEL_KEYS = [
  'category.entertainment',
  'category.gifts',
  'category.travel',
  'category.investment',
] as const;

const isEssentialExpense = (item: TransactionOrIncomeItem) => {
  if (item.type === 'incomes') return false;
  const cat = String(item.cat ?? '');
  return !NON_ESSENTIAL_CATEGORY_IDS.has(cat);
};

/**
 * Average monthly *essential* expense across completed months
 * (excludes current month plus entertainment, gifts, travel, and investments).
 */
export const averageMonthlySpend = (
  items: TransactionOrIncomeItem[],
  today = new Date()
): number => {
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const byMonth = new Map<string, number>();

  for (const item of items) {
    if (!isEssentialExpense(item)) continue;
    const key = monthKey(item.dt);
    if (!key || key >= current) continue;
    const amount = parseFloat(item.sum);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    byMonth.set(key, (byMonth.get(key) || 0) + amount);
  }

  if (!byMonth.size) return 0;
  let total = 0;
  for (const value of byMonth.values()) total += value;
  return total / byMonth.size;
};

export const resolveTarget = (
  fund: EmergencyFundState,
  avgSpend: number
): number => {
  if (avgSpend > 0) return avgSpend * fund.targetMonths;
  return 0;
};

export const monthsCovered = (balance: number, avgSpend: number): number => {
  if (avgSpend <= 0 || balance <= 0) return 0;
  return balance / avgSpend;
};

export const progressRatio = (balance: number, target: number): number => {
  if (target <= 0) return 0;
  return Math.max(0, balance / target);
};

/** Months to reach target at the given contribution pace; null if unreachable. */
export const monthsToGoal = (
  balance: number,
  target: number,
  contribution: number | null
): number | null => {
  if (target <= 0) return null;
  const remaining = target - balance;
  if (remaining <= 0) return 0;
  if (contribution == null || contribution <= 0) return null;
  return remaining / contribution;
};

export const parseAmount = (value: string): number | null => {
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Ledger amount: deposit (+) or withdrawal (−); zero rejected. */
export const parseLedgerAmount = (value: string): number | null => {
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') {
    return null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) && n !== 0 ? n : null;
};
