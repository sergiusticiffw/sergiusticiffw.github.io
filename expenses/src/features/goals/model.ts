import type { TransactionOrIncomeItem } from '@shared/type/types';

export type TargetMonths = 3 | 6 | 12;

export interface EmergencyFundState {
  balance: number;
  targetMonths: TargetMonths;
  /** Absolute target; when set, overrides months × avg spend. */
  customTarget: number | null;
  monthlyContribution: number | null;
  updatedAt: string | null;
}

export const TARGET_MONTH_OPTIONS: TargetMonths[] = [3, 6, 12];

export const defaultEmergencyFund = (): EmergencyFundState => ({
  balance: 0,
  targetMonths: 6,
  customTarget: null,
  monthlyContribution: null,
  updatedAt: null,
});

/** Normalize unknown JSON into a safe EmergencyFundState. */
export const normalizeEmergencyFund = (
  raw: Partial<EmergencyFundState> | null | undefined
): EmergencyFundState => {
  const base = defaultEmergencyFund();
  if (!raw || typeof raw !== 'object') return base;
  const targetMonths = [3, 6, 12].includes(Number(raw.targetMonths))
    ? (Number(raw.targetMonths) as TargetMonths)
    : base.targetMonths;
  return {
    balance:
      typeof raw.balance === 'number' && raw.balance >= 0
        ? raw.balance
        : base.balance,
    targetMonths,
    customTarget:
      typeof raw.customTarget === 'number' && raw.customTarget > 0
        ? raw.customTarget
        : null,
    monthlyContribution:
      typeof raw.monthlyContribution === 'number' &&
      raw.monthlyContribution > 0
        ? raw.monthlyContribution
        : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
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

/** Average monthly expense across completed months (excludes current month). */
export const averageMonthlySpend = (
  items: TransactionOrIncomeItem[],
  today = new Date()
): number => {
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const byMonth = new Map<string, number>();

  for (const item of items) {
    if (item.type === 'incomes') continue;
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
  if (fund.customTarget != null && fund.customTarget > 0) {
    return fund.customTarget;
  }
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
