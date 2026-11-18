/**
 * AI tools for the family / shared-budget feature (read-only).
 * Uses prefetched RPC aggregates — no partner transaction row details.
 *
 * Data source rules mirror the Family charts (`useFamilySharedTotals`):
 * with encryption on, partner rows are unreadable on the server, so only the
 * user's own spend in shared categories is known, and every result says so.
 */
import { getStoredToken } from '@shared/utils/authStorage';
import {
  budgetStatus,
  monthPaceForView,
} from '@features/expenses/budgets/model';
import { sharedTotalsFromItems } from '@features/expenses/components/Charts/familyTotals';
import {
  getEncryptionSnapshot,
  getSession,
} from '../../crypto/encryptionState';
import {
  getDataProvider,
  getDataProviderKind,
  type FamilyCategoryDailyTotal,
  type FamilyCategoryMemberTotal,
  type FamilyCategoryTotal,
  type Household,
  type HouseholdActivityItem,
  type HouseholdCategoryGoal,
  type HouseholdInvite,
  type HouseholdMember,
} from '../../data';
import type { GeminiFunctionDeclaration } from '../client';
import {
  AiItem,
  categoryLabel,
  localToday,
  normalizeText,
  round,
} from '../data';

export type FamilyAiMember = {
  userId: string;
  label: string;
  role: string;
  isYou: boolean;
};

/** Where the family figures come from. */
export type FamilyAiSource = 'rpc' | 'personal_fallback' | 'encryption_local';

export type FamilyAiSnapshot = {
  householdId: string;
  name: string;
  myRole: string;
  myUid: string;
  sharedCategoryIds: string[];
  members: FamilyAiMember[];
  categoryTotals: FamilyCategoryTotal[];
  memberTotals: FamilyCategoryMemberTotal[];
  /** Combined shared income (months x category). Empty when unreadable. */
  incomeTotals: FamilyCategoryTotal[];
  incomeMemberTotals: FamilyCategoryMemberTotal[];
  goals: HouseholdCategoryGoal[];
  invites: HouseholdInvite[];
  activity: HouseholdActivityItem[];
  totalsSource: FamilyAiSource;
};

export interface FamilyToolContext {
  family: FamilyAiSnapshot | null;
}

type Args = Record<string, any>;
type ToolResult = Record<string, unknown>;

const CACHE_TTL_MS = 60_000;
const MAX_ACTIVITY = 50;
const MAX_DAILY_ROWS = 200;

/** Server data for the household; the local fallback is rebuilt on every call. */
type RemoteFamily = {
  household: Household;
  totals: FamilyCategoryTotal[] | null;
  memberTotals: FamilyCategoryMemberTotal[];
  incomeTotals: FamilyCategoryTotal[];
  incomeMemberTotals: FamilyCategoryMemberTotal[];
  activity: HouseholdActivityItem[];
};

/** Daily rows are fetched per month on demand, then kept briefly. */
const MAX_DAILY_MONTHS = 24;
let dailyCache = new Map<
  string,
  { at: number; rows: FamilyCategoryDailyTotal[] }
>();

let cache: {
  uid: string;
  encrypted: boolean;
  at: number;
  remote: RemoteFamily | null;
} | null = null;

/** Drop the prefetched household data (membership, shared categories or goals changed). */
export const clearFamilyAiCache = (): void => {
  cache = null;
  dailyCache = new Map();
};

const memberLabel = (m: HouseholdMember, myUid: string): FamilyAiMember => {
  const isYou = m.user_id === myUid;
  const display = (m.display_name || '').trim();
  const email = (m.email || '').trim();
  const name = (m.name || '').trim();
  return {
    userId: m.user_id,
    label: isYou
      ? 'You'
      : display || email || name || `${m.user_id.slice(0, 8)}…`,
    role: m.role,
    isYou,
  };
};

const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const ok = <T>(result: { success: boolean; data?: T }): T | null =>
  result.success && result.data ? result.data : null;

const fetchRemote = async (
  encrypted: boolean
): Promise<RemoteFamily | null> => {
  const session = getSession();
  const token = getStoredToken() || session?.token;
  if (!session?.uid || !token) return null;

  const provider = getDataProvider();
  provider.configure(token);
  const house = await provider.getHousehold();
  if (!house.success || !house.data) return null;
  const household = house.data;

  const activityPromise = provider.listHouseholdActivity();
  // Encrypted rows have blank server amounts and categories: skip the RPCs.
  if (encrypted) {
    return {
      household,
      totals: null,
      memberTotals: [],
      incomeTotals: [],
      incomeMemberTotals: [],
      activity: ok(await activityPromise) ?? [],
    };
  }

  const [totals, members, income, incomeMembers, activity] = await Promise.all([
    provider.listFamilyCategoryTotals(),
    provider.listFamilyCategoryMemberTotals(),
    provider.listFamilyIncomeTotals(),
    provider.listFamilyIncomeMemberTotals(),
    activityPromise,
  ]);

  return {
    household,
    totals: ok(totals),
    memberTotals: ok(members) ?? [],
    incomeTotals: ok(income) ?? [],
    incomeMemberTotals: ok(incomeMembers) ?? [],
    activity: ok(activity) ?? [],
  };
};

/** Same decision table as `loadFamilySharedTotals` in the Family charts. */
const buildSnapshot = (
  remote: RemoteFamily,
  items: AiItem[],
  encrypted: boolean,
  myUid: string
): FamilyAiSnapshot => {
  const { household } = remote;
  const sharedCategoryIds = (household.shared_categories || []).map(String);
  const local: FamilyCategoryTotal[] = sharedTotalsFromItems(
    items,
    new Set(sharedCategoryIds)
  ).map((item) => ({
    category_id: item.cat,
    month: item.month,
    total: item.amount,
  }));

  let totalsSource: FamilyAiSource;
  let categoryTotals: FamilyCategoryTotal[];
  if (encrypted) {
    totalsSource = 'encryption_local';
    categoryTotals = local;
  } else {
    const rows = remote.totals;
    const hasRpcSpend = !!rows?.some((row) => Number(row.total) > 0);
    if (rows && (hasRpcSpend || (rows.length === 0 && local.length === 0))) {
      totalsSource = 'rpc';
      categoryTotals = rows.filter(
        (row) => row.month?.length === 7 && row.total > 0
      );
    } else {
      totalsSource = 'personal_fallback';
      categoryTotals = local;
    }
  }
  const rpc = totalsSource === 'rpc';

  return {
    householdId: household.id,
    name: household.name || 'Family',
    myRole: household.my_role || 'member',
    myUid,
    sharedCategoryIds,
    members: (household.members || []).map((m) => memberLabel(m, myUid)),
    categoryTotals,
    memberTotals: rpc ? remote.memberTotals : [],
    incomeTotals: encrypted ? [] : remote.incomeTotals,
    incomeMemberTotals: encrypted ? [] : remote.incomeMemberTotals,
    goals: household.goals || [],
    invites: (household.invites || []).filter(
      (invite) => invite.status === 'pending'
    ),
    activity: remote.activity,
    totalsSource,
  };
};

/**
 * Prefetch family aggregates for the AI (Supabase household only). The server
 * part is cached ~60s; the local fallback follows the current `items`.
 */
export const loadFamilyAiContext = async (
  items: AiItem[]
): Promise<FamilyAiSnapshot | null> => {
  if (getDataProviderKind() !== 'supabase') return null;
  const session = getSession();
  if (!session?.uid) return null;

  const encrypted = getEncryptionSnapshot().status === 'on';
  const now = Date.now();
  let remote: RemoteFamily | null;

  if (
    cache &&
    cache.uid === session.uid &&
    cache.encrypted === encrypted &&
    now - cache.at < CACHE_TTL_MS
  ) {
    remote = cache.remote;
  } else {
    try {
      remote = await fetchRemote(encrypted);
    } catch {
      remote = null;
    }
    cache = { uid: session.uid, encrypted, at: now, remote };
  }

  return remote ? buildSnapshot(remote, items, encrypted, session.uid) : null;
};

const SOURCE_NOTES: Record<Exclude<FamilyAiSource, 'rpc'>, string> = {
  personal_fallback:
    "Family totals are not available from the server right now, so these figures only include the user's own spending in shared categories. Say so; do not present them as the household total.",
  encryption_local:
    "Encryption is on, so other members' amounts cannot be read. These figures only include the user's own spending in shared categories. Say so; do not present them as the household total.",
};

/** Adds the data source (and a caveat when it is not the household total) to a result. */
const withSource = (
  family: FamilyAiSnapshot,
  result: ToolResult
): ToolResult => {
  if (family.totalsSource === 'rpc') {
    return { dataSource: 'household', ...result };
  }
  return {
    dataSource: 'own_spend_only',
    dataSourceNote: SOURCE_NOTES[family.totalsSource],
    ...result,
  };
};

const labelFor = (family: FamilyAiSnapshot, userId: string) =>
  family.members.find((m) => m.userId === userId)?.label ||
  `${String(userId).slice(0, 8)}…`;

const categoryName = (id: string) =>
  categoryLabel(id) || (id && id !== '0' ? id : 'uncategorized');

type GoalRow = {
  categoryId: string;
  limit: number;
  spent: number;
  remaining: number;
  ratio: number;
  status: 'ok' | 'ahead' | 'over';
};

const monthSpendByCategory = (family: FamilyAiSnapshot, month: string) => {
  const byCat = new Map<string, number>();
  for (const row of family.categoryTotals) {
    if (row.month !== month) continue;
    byCat.set(row.category_id, (byCat.get(row.category_id) || 0) + row.total);
  }
  return byCat;
};

const goalRows = (family: FamilyAiSnapshot, month: string): GoalRow[] => {
  const spent = monthSpendByCategory(family, month);
  const pace = monthPaceForView(month, localToday());
  return family.goals
    .map((goal) => {
      const limit = Number(goal.monthly_limit) || 0;
      const used = spent.get(goal.category_id) || 0;
      const ratio = limit > 0 ? used / limit : 0;
      return {
        categoryId: goal.category_id,
        limit,
        spent: used,
        remaining: limit - used,
        ratio,
        status: budgetStatus(ratio, pace),
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
};

export const formatFamilySummary = (family: FamilyAiSnapshot): string => {
  const cats = family.sharedCategoryIds
    .map((id) => categoryLabel(id) || id)
    .filter(Boolean);
  const month = localToday().slice(0, 7);
  let monthTotal = 0;
  for (const row of family.categoryTotals) {
    if (row.month === month) monthTotal += row.total;
  }
  const members = family.members
    .map((m) => `${m.label} (${m.role}${m.isYou ? ', you' : ''})`)
    .join('; ');
  const lines = [
    'FAMILY BUDGET (shared categories only — combined totals, no partner transaction details):',
    `Household: ${family.name}`,
    `Your role: ${family.myRole}`,
    `Members: ${members || '—'}`,
    `Shared categories: ${cats.join(', ') || 'none'}`,
    `This month (${month}) shared total: ${round(monthTotal)}${
      family.totalsSource === 'rpc' ? '' : ' (YOUR OWN spend only, see note)'
    }`,
  ];
  if (family.totalsSource !== 'rpc') {
    lines.push(`NOTE: ${SOURCE_NOTES[family.totalsSource]}`);
  }
  if (family.goals.length) {
    const rows = goalRows(family, month);
    const over = rows.filter((row) => row.status === 'over');
    lines.push(
      `Family goals (monthly limits): ${family.goals.length}; over the limit this month: ${
        over.length
          ? over.map((row) => categoryName(row.categoryId)).join(', ')
          : 'none'
      }. Use get_family_goals for details.`
    );
  }
  if (family.invites.length) {
    lines.push(`Pending invites: ${family.invites.length}.`);
  }
  return lines.join('\n');
};

const requireFamily = (
  ctx: FamilyToolContext
): FamilyAiSnapshot | { error: string } => {
  if (!ctx.family) {
    return {
      error:
        'Family budget is not active for this account (no household, or not using Supabase).',
    };
  }
  return ctx.family;
};

const MONTH = /^\d{4}-\d{2}$/;

const parseMonth = (
  value: unknown,
  fallback: string
): string | { error: string } => {
  if (value == null || value === '') return fallback;
  const month = String(value).slice(0, 7);
  if (!MONTH.test(month)) return { error: 'month must be YYYY-MM' };
  return month;
};

/** `month`, or `from`/`to` (either may be omitted), defaulting to the current month. */
const parseRange = (
  args: Args,
  current: string
): { start: string; end: string } | { error: string } => {
  if (args.from || args.to) {
    const start = String(args.from || args.to).slice(0, 7);
    const end = String(args.to || args.from).slice(0, 7);
    if (!MONTH.test(start) || !MONTH.test(end)) {
      return { error: 'from/to must be YYYY-MM' };
    }
    return start <= end ? { start, end } : { start: end, end: start };
  }
  const month = parseMonth(args.month, current);
  if (typeof month !== 'string') return month;
  return { start: month, end: month };
};

const resolveCategoryId = (
  family: FamilyAiSnapshot,
  raw: unknown
): string | { error: string } => {
  const needle = String(raw || '').trim();
  if (!needle) return { error: 'category is required' };
  const shared = new Set(family.sharedCategoryIds);
  if (shared.has(needle)) return needle;
  const norm = normalizeText(needle);
  for (const id of family.sharedCategoryIds) {
    const label = categoryLabel(id);
    if (normalizeText(label) === norm || normalizeText(label).includes(norm)) {
      return id;
    }
  }
  return {
    error: `Unknown shared category "${needle}". Use a shared category id or name. Available: ${family.sharedCategoryIds
      .map((id) => `${id}=${categoryLabel(id) || id}`)
      .join(', ')}`,
  };
};

const resolveMember = (
  family: FamilyAiSnapshot,
  raw: unknown
): FamilyAiMember | { error: string } => {
  const needle = normalizeText(String(raw || ''));
  const mine = ['me', 'my', 'you', 'eu', 'mine'];
  const found = family.members.find(
    (m) =>
      (mine.includes(needle) && m.isYou) ||
      normalizeText(m.label) === needle ||
      normalizeText(m.label).includes(needle)
  );
  if (found) return found;
  return {
    error: `Unknown member "${String(raw)}". Members: ${family.members
      .map((m) => m.label)
      .join(', ')}`,
  };
};

const getFamilyOverview = (ctx: FamilyToolContext, _args: Args): ToolResult => {
  const family = requireFamily(ctx);
  if ('error' in family) return family;
  const month = localToday().slice(0, 7);
  let monthTotal = 0;
  const byCat: Record<string, number> = {};
  for (const row of family.categoryTotals) {
    if (row.month !== month) continue;
    monthTotal += row.total;
    byCat[row.category_id] = (byCat[row.category_id] || 0) + row.total;
  }
  return withSource(family, {
    name: family.name,
    yourRole: family.myRole,
    members: family.members.map((m) => ({
      label: m.label,
      role: m.role,
      isYou: m.isYou,
    })),
    sharedCategories: family.sharedCategoryIds.map((id) => ({
      id,
      name: categoryLabel(id) || id,
    })),
    goalCount: family.goals.length,
    pendingInvites: family.invites.length,
    currentMonth: month,
    currentMonthTotal: round(monthTotal),
    currentMonthByCategory: Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([id, total]) => `${categoryLabel(id) || id}|${round(total)}`)
      .join('\n'),
    columns: 'category|amount',
  });
};

const getFamilySharedTotals = (
  ctx: FamilyToolContext,
  args: Args
): ToolResult => {
  const family = requireFamily(ctx);
  if ('error' in family) return family;

  const current = localToday().slice(0, 7);
  const range = parseRange(args, current);
  if ('error' in range) return range;
  const { start, end } = range;

  const cats =
    Array.isArray(args.categories) && args.categories.length
      ? new Set(args.categories.map(String))
      : null;
  const inRange = (month: string, category: string) =>
    month >= start && month <= end && (!cats || cats.has(category));

  const filtered = family.categoryTotals.filter((row) =>
    inRange(row.month, row.category_id)
  );
  const total = filtered.reduce((s, r) => s + r.total, 0);
  const months = new Set(filtered.map((row) => row.month));
  const monthCount = months.size;
  const base = {
    from: start,
    to: end,
    total: round(total),
    monthCount,
    monthlyAverage: monthCount ? round(total / monthCount) : 0,
  };

  const groupBy =
    args.groupBy === 'month' ||
    args.groupBy === 'category' ||
    args.groupBy === 'member'
      ? args.groupBy
      : start === end
        ? 'category'
        : 'monthCategory';

  if (groupBy === 'member') {
    if (!family.memberTotals.length) {
      return withSource(family, {
        ...base,
        columns: 'member|amount',
        rows: '',
        note: 'Per-member totals are not available for this data source.',
      });
    }
    const byMember = new Map<string, number>();
    for (const row of family.memberTotals) {
      if (!inRange(row.month, row.category_id)) continue;
      byMember.set(row.user_id, (byMember.get(row.user_id) || 0) + row.total);
    }
    return withSource(family, {
      ...base,
      columns: 'member|amount',
      rows: [...byMember.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([uid, amount]) => `${labelFor(family, uid)}|${round(amount)}`)
        .join('\n'),
    });
  }

  const group = new Map<string, number>();
  for (const row of filtered) {
    const key =
      groupBy === 'month'
        ? row.month
        : groupBy === 'category'
          ? categoryLabel(row.category_id) || row.category_id
          : `${row.month}|${categoryLabel(row.category_id) || row.category_id}`;
    group.set(key, (group.get(key) || 0) + row.total);
  }
  const entries = [...group.entries()];
  if (groupBy === 'category') entries.sort((a, b) => b[1] - a[1]);
  else entries.sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));

  return withSource(family, {
    ...base,
    columns:
      groupBy === 'month'
        ? 'month|amount'
        : groupBy === 'category'
          ? 'category|amount'
          : 'month|category|amount',
    rows: entries.map(([key, amount]) => `${key}|${round(amount)}`).join('\n'),
  });
};

const getFamilyMemberContribution = (
  ctx: FamilyToolContext,
  args: Args
): ToolResult => {
  const family = requireFamily(ctx);
  if ('error' in family) return family;

  const catOrErr = resolveCategoryId(family, args.category);
  if (typeof catOrErr !== 'string') return catOrErr;
  const categoryId = catOrErr;

  const monthParsed = parseMonth(args.month, '');
  if (typeof monthParsed !== 'string') return monthParsed;
  const month = monthParsed; // empty = all time

  const totals = new Map<string, number>();
  if (family.totalsSource === 'rpc') {
    for (const row of family.memberTotals) {
      if (row.category_id !== categoryId) continue;
      if (month && row.month !== month) continue;
      totals.set(row.user_id, (totals.get(row.user_id) || 0) + row.total);
    }
  } else {
    // Only the user's own spend is known.
    for (const row of family.categoryTotals) {
      if (row.category_id !== categoryId) continue;
      if (month && row.month !== month) continue;
      totals.set(family.myUid, (totals.get(family.myUid) || 0) + row.total);
    }
  }

  const rows = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([uid, amount]) => `${labelFor(family, uid)}|${round(amount)}`);
  const total = [...totals.values()].reduce((s, n) => s + n, 0);

  return withSource(family, {
    categoryId,
    category: categoryLabel(categoryId) || categoryId,
    month: month || 'all',
    total: round(total),
    columns: 'member|amount',
    rows: rows.join('\n'),
  });
};

const getFamilyGoals = (ctx: FamilyToolContext, args: Args): ToolResult => {
  const family = requireFamily(ctx);
  if ('error' in family) return family;
  const month = parseMonth(args.month, localToday().slice(0, 7));
  if (typeof month !== 'string') return month;
  if (!family.goals.length) {
    return withSource(family, {
      goalCount: 0,
      note: 'The household has no family goals (monthly limits per shared category).',
    });
  }
  const rows = goalRows(family, month);
  return withSource(family, {
    month,
    goalCount: rows.length,
    overCount: rows.filter((row) => row.status === 'over').length,
    monthElapsed: round(monthPaceForView(month, localToday()), 2),
    columns: 'category|limit|spent|remaining|usedPercent|status',
    rows: rows
      .map(
        (row) =>
          `${categoryName(row.categoryId)}|${round(row.limit)}|${round(row.spent)}|${round(row.remaining)}|${round(row.ratio * 100, 0)}|${row.status}`
      )
      .join('\n'),
    statusMeaning:
      'ok = on track, ahead = spending faster than the month is passing, over = limit exceeded.',
  });
};

const getFamilyIncome = (ctx: FamilyToolContext, args: Args): ToolResult => {
  const family = requireFamily(ctx);
  if ('error' in family) return family;
  if (family.totalsSource === 'encryption_local') {
    return {
      error:
        "Family income is not readable while encryption is on (other members' amounts are encrypted).",
    };
  }
  const range = parseRange(args, localToday().slice(0, 7));
  if ('error' in range) return range;
  const { start, end } = range;

  const rows = family.incomeTotals.filter(
    (row) => row.month >= start && row.month <= end
  );
  const total = rows.reduce((s, r) => s + r.total, 0);
  const byCat = new Map<string, number>();
  for (const row of rows) {
    byCat.set(row.category_id, (byCat.get(row.category_id) || 0) + row.total);
  }

  const byMember = new Map<string, number>();
  for (const row of family.incomeMemberTotals) {
    if (row.month < start || row.month > end) continue;
    byMember.set(row.user_id, (byMember.get(row.user_id) || 0) + row.total);
  }
  const memberSum = [...byMember.values()].reduce((s, n) => s + n, 0);

  return withSource(family, {
    from: start,
    to: end,
    total: round(total),
    columns: 'category|amount',
    rows: [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, amount]) => `${categoryName(id)}|${round(amount)}`)
      .join('\n'),
    memberColumns: 'member|amount|sharePercent',
    memberRows: [...byMember.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(
        ([uid, amount]) =>
          `${labelFor(family, uid)}|${round(amount)}|${memberSum ? round((amount / memberSum) * 100, 1) : 0}`
      )
      .join('\n'),
  });
};

/** Months from `start` to `end` inclusive (YYYY-MM). */
const monthsBetween = (start: string, end: string): string[] => {
  const months: string[] = [];
  for (let m = start; m <= end && months.length <= MAX_DAILY_MONTHS;) {
    months.push(m);
    m = shiftMonth(m, 1);
  }
  return months;
};

/** Daily household rows for the given months, fetched on demand and cached briefly. */
const loadDailyRows = async (
  family: FamilyAiSnapshot,
  months: string[]
): Promise<{ rows: FamilyCategoryDailyTotal[]; failed: string[] }> => {
  const provider = getDataProvider();
  const token = getStoredToken() || getSession()?.token;
  if (token) provider.configure(token);
  const now = Date.now();
  const failed: string[] = [];
  const results = await Promise.all(
    months.map(async (month) => {
      const key = `${family.myUid}|${month}`;
      const hit = dailyCache.get(key);
      if (hit && now - hit.at < CACHE_TTL_MS) return hit.rows;
      try {
        const result = await provider.listFamilyCategoryDailyTotals(month);
        const rows = ok(result);
        if (!rows) {
          failed.push(month);
          return [];
        }
        dailyCache.set(key, { at: now, rows });
        return rows;
      } catch {
        failed.push(month);
        return [];
      }
    })
  );
  return { rows: results.flat(), failed };
};

const getFamilyDailySpend = async (
  ctx: FamilyToolContext,
  args: Args
): Promise<ToolResult> => {
  const family = requireFamily(ctx);
  if ('error' in family) return family;
  if (family.totalsSource !== 'rpc') {
    return withSource(family, {
      error:
        'Daily family spend needs the household totals, which are unavailable for this data source.',
    });
  }

  const day =
    typeof args.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.day)
      ? args.day
      : '';
  const current = localToday().slice(0, 7);
  const range = day
    ? { start: day.slice(0, 7), end: day.slice(0, 7) }
    : parseRange(args, current);
  if ('error' in range) return range;
  const months = monthsBetween(range.start, range.end);
  if (months.length > MAX_DAILY_MONTHS) {
    return {
      error: `Daily data is limited to ${MAX_DAILY_MONTHS} months at a time. Narrow from/to.`,
    };
  }

  let member: FamilyAiMember | null = null;
  if (args.member) {
    const found = resolveMember(family, args.member);
    if ('error' in found) return found;
    member = found;
  }
  let categoryId = '';
  if (args.category) {
    const found = resolveCategoryId(family, args.category);
    if (typeof found !== 'string') return found;
    categoryId = found;
  }

  const loaded = await loadDailyRows(family, months);
  if (loaded.failed.length === months.length) {
    return {
      error: `Daily family data could not be loaded for ${loaded.failed.join(', ')}.`,
    };
  }

  const rows = loaded.rows.filter(
    (row) =>
      (!day || row.day === day) &&
      (!member || row.user_id.toLowerCase() === member.userId.toLowerCase()) &&
      (!categoryId || row.category_id === categoryId)
  );
  const groupBy =
    args.groupBy === 'member' || args.groupBy === 'category'
      ? args.groupBy
      : 'day';

  const grouped = new Map<string, number>();
  const perDay = new Map<string, number>();
  for (const row of rows) {
    const key =
      groupBy === 'member'
        ? labelFor(family, row.user_id)
        : groupBy === 'category'
          ? categoryName(row.category_id)
          : row.day;
    grouped.set(key, (grouped.get(key) || 0) + row.total);
    perDay.set(row.day, (perDay.get(row.day) || 0) + row.total);
  }
  const total = rows.reduce((s, r) => s + r.total, 0);
  const busiest = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const entries = [...grouped.entries()].sort((a, b) =>
    groupBy === 'day' ? (a[0] < b[0] ? 1 : -1) : b[1] - a[1]
  );

  return withSource(family, {
    from: months[0],
    to: months[months.length - 1],
    day: day || null,
    total: round(total),
    daysWithSpend: perDay.size,
    busiestDay: busiest ? `${busiest[0]}|${round(busiest[1])}` : null,
    groupedBy: groupBy,
    columns: `${groupBy}|amount`,
    truncated: entries.length > MAX_DAILY_ROWS,
    ...(loaded.failed.length && {
      note: `Could not load ${loaded.failed.join(', ')}; those months are missing from the figures.`,
    }),
    rows: entries
      .slice(0, MAX_DAILY_ROWS)
      .map(([key, amount]) => `${key}|${round(amount)}`)
      .join('\n'),
  });
};

const detailOf = (payload: Record<string, unknown> | undefined) => {
  if (!payload) return '';
  return Object.entries(payload)
    .filter(([, value]) =>
      ['string', 'number', 'boolean'].includes(typeof value)
    )
    .slice(0, 4)
    .map(
      ([key, value]) =>
        `${key}=${String(value).slice(0, 40).replace(/\|/g, '/')}`
    )
    .join(' ');
};

const getFamilyActivity = (ctx: FamilyToolContext, args: Args): ToolResult => {
  const family = requireFamily(ctx);
  if ('error' in family) return family;
  const n = Math.floor(Number(args.limit));
  const limit = Number.isFinite(n) && n > 0 ? Math.min(n, MAX_ACTIVITY) : 20;
  const events = [...family.activity]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
  return {
    eventColumns: 'date|event|actor|detail',
    events: events
      .map(
        (event) =>
          `${event.created_at.slice(0, 16)}|${event.event_type}|${
            event.actor_id ? labelFor(family, event.actor_id) : 'system'
          }|${detailOf(event.payload)}`
      )
      .join('\n'),
    pendingInviteCount: family.invites.length,
    inviteColumns: 'email|invitedBy|created|expires',
    pendingInvites: family.invites
      .map(
        (invite) =>
          `${invite.email}|${labelFor(family, invite.invited_by)}|${(invite.created_at || '').slice(0, 10)}|${(invite.expires_at || '').slice(0, 10)}`
      )
      .join('\n'),
  };
};

export const familyToolDeclarations: GeminiFunctionDeclaration[] = [
  {
    name: 'get_family_overview',
    description:
      'Family / household budget overview: household name, your role, members, shared category names, number of family goals and pending invites, and this month\'s combined shared spend. Prefer for "what is our family budget" questions.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_family_shared_totals',
    description:
      'Combined family spend on shared categories only (aggregates). Optional month (YYYY-MM, default current), or from/to months, and optional category ids. Returns the total, number of months and the monthly average. groupBy: category (default for one month), month, member, or omit for month x category over a range. Prefer this for family totals, averages and trends.',
    parameters: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          description: 'YYYY-MM. Default current month.',
        },
        from: { type: 'string', description: 'Start month YYYY-MM (range).' },
        to: { type: 'string', description: 'End month YYYY-MM (range).' },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional shared category ids.',
        },
        groupBy: {
          type: 'string',
          enum: ['category', 'month', 'member'],
          description: 'How to group the rows.',
        },
      },
    },
  },
  {
    name: 'get_family_member_contribution',
    description:
      'Per-member contribution to a shared category (aggregates only — no transaction details). Requires category id or name. Optional month YYYY-MM (omit for all time).',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Shared category id or name.',
        },
        month: { type: 'string', description: 'YYYY-MM. Omit for all-time.' },
      },
      required: ['category'],
    },
  },
  {
    name: 'get_family_goals',
    description:
      'Family goals: the household monthly limit per shared category versus the combined spend, with remaining amount, percent used and status (ok, ahead, over). Use for "did we go over the family limit", "how much can we still spend on X as a family". Not the personal budget (use get_budget_status for that).',
    parameters: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          description: 'YYYY-MM. Default current month.',
        },
      },
    },
  },
  {
    name: 'get_family_income',
    description:
      'Combined household income (shared income aggregates) by category, plus each member\'s amount and share of it. Optional month or from/to months, default current month. Use for "who contributes more income" or "my share of the family income".',
    parameters: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          description: 'YYYY-MM. Default current month.',
        },
        from: { type: 'string', description: 'Start month YYYY-MM (range).' },
        to: { type: 'string', description: 'End month YYYY-MM (range).' },
      },
    },
  },
  {
    name: 'get_family_daily_spend',
    description:
      'Shared-category spend per day (aggregates, no transaction details) for ANY month, e.g. "the busiest family day in August". Optional month (YYYY-MM, default current) or from/to months (max 24), day (YYYY-MM-DD), member (name or "me"), category, and groupBy day (default), member or category. Also returns the busiest day. Use for "what did my partner spend yesterday" or "which day did we spend most".',
    parameters: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          description: 'YYYY-MM. Default current month.',
        },
        from: { type: 'string', description: 'Start month YYYY-MM (range).' },
        to: { type: 'string', description: 'End month YYYY-MM (range).' },
        day: { type: 'string', description: 'YYYY-MM-DD.' },
        member: { type: 'string', description: 'Member name, or "me".' },
        category: {
          type: 'string',
          description: 'Shared category id or name.',
        },
        groupBy: { type: 'string', enum: ['day', 'member', 'category'] },
      },
    },
  },
  {
    name: 'get_family_activity',
    description:
      'Recent household events (members joined or left, role changes, shared categories or goals changed, ownership transfer) and pending invites. Use for "who changed the limit" or "who is invited".',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Max events, default 20, max 50.',
        },
      },
    },
  },
];

export const familyToolExecutors: Record<
  string,
  (ctx: FamilyToolContext, args: Args) => ToolResult | Promise<ToolResult>
> = {
  get_family_overview: getFamilyOverview,
  get_family_shared_totals: getFamilySharedTotals,
  get_family_member_contribution: getFamilyMemberContribution,
  get_family_goals: getFamilyGoals,
  get_family_income: getFamilyIncome,
  get_family_daily_spend: getFamilyDailySpend,
  get_family_activity: getFamilyActivity,
};

export const FAMILY_TOOL_LABELS: Record<string, string> = {
  get_family_overview: 'Checking family budget',
  get_family_shared_totals: 'Calculating family shared totals',
  get_family_member_contribution: 'Checking member contributions',
  get_family_goals: 'Checking family goals',
  get_family_income: 'Checking family income',
  get_family_daily_spend: 'Checking daily family spend',
  get_family_activity: 'Reading family activity',
};
