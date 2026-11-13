/**
 * AI tools for family / shared-category aggregates (read-only).
 * Uses prefetched RPC aggregates — no partner transaction row details.
 */
import { getStoredToken } from '@shared/utils/authStorage';
import { getSession } from '../../crypto/encryptionState';
import {
  getDataProvider,
  getDataProviderKind,
  type FamilyCategoryMemberTotal,
  type FamilyCategoryTotal,
  type Household,
  type HouseholdMember,
} from '../../data';
import type { GeminiFunctionDeclaration } from '../client';
import { categoryLabel, localToday, normalizeText, round } from '../data';

export type FamilyAiMember = {
  userId: string;
  label: string;
  role: string;
  isYou: boolean;
};

export type FamilyAiSnapshot = {
  householdId: string;
  name: string;
  myRole: string;
  myUid: string;
  sharedCategoryIds: string[];
  members: FamilyAiMember[];
  categoryTotals: FamilyCategoryTotal[];
  memberTotals: FamilyCategoryMemberTotal[];
};

export interface FamilyToolContext {
  family: FamilyAiSnapshot | null;
}

type Args = Record<string, any>;
type ToolResult = Record<string, unknown>;

const CACHE_TTL_MS = 60_000;
let cache: { uid: string; at: number; snapshot: FamilyAiSnapshot | null } | null =
  null;

const memberLabel = (m: HouseholdMember, myUid: string): FamilyAiMember => {
  const isYou = m.user_id === myUid;
  const email = (m.email || '').trim();
  const name = (m.name || '').trim();
  return {
    userId: m.user_id,
    label: isYou
      ? 'You'
      : email || name || `${m.user_id.slice(0, 8)}…`,
    role: m.role,
    isYou,
  };
};

const fromHousehold = (
  household: Household,
  myUid: string,
  categoryTotals: FamilyCategoryTotal[],
  memberTotals: FamilyCategoryMemberTotal[]
): FamilyAiSnapshot => ({
  householdId: household.id,
  name: household.name || 'Family',
  myRole: household.my_role || 'member',
  myUid,
  sharedCategoryIds: (household.shared_categories || []).map(String),
  members: (household.members || []).map((m) => memberLabel(m, myUid)),
  categoryTotals,
  memberTotals,
});

/** Prefetch family aggregates for AI (Supabase household only). Cached ~60s. */
export const loadFamilyAiContext = async (): Promise<FamilyAiSnapshot | null> => {
  if (getDataProviderKind() !== 'supabase') return null;
  const session = getSession();
  const token = getStoredToken() || session?.token;
  if (!session?.uid || !token) return null;

  const now = Date.now();
  if (
    cache &&
    cache.uid === session.uid &&
    now - cache.at < CACHE_TTL_MS
  ) {
    return cache.snapshot;
  }

  try {
    const provider = getDataProvider();
    provider.configure(token);
    const house = await provider.getHousehold();
    if (!house.success || !house.data) {
      cache = { uid: session.uid, at: now, snapshot: null };
      return null;
    }

    const [totalsResult, memberResult] = await Promise.all([
      provider.listFamilyCategoryTotals(),
      provider.listFamilyCategoryMemberTotals(),
    ]);

    const snapshot = fromHousehold(
      house.data,
      session.uid,
      totalsResult.success && totalsResult.data ? totalsResult.data : [],
      memberResult.success && memberResult.data ? memberResult.data : []
    );
    cache = { uid: session.uid, at: now, snapshot };
    return snapshot;
  } catch {
    cache = { uid: session.uid, at: now, snapshot: null };
    return null;
  }
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
  return [
    'FAMILY BUDGET (shared categories only — combined totals, no partner transaction details):',
    `Household: ${family.name}`,
    `Your role: ${family.myRole}`,
    `Members: ${members || '—'}`,
    `Shared categories: ${cats.join(', ') || 'none'}`,
    `This month (${month}) shared total: ${round(monthTotal)}`,
  ].join('\n');
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

const parseMonth = (value: unknown, fallback: string): string | { error: string } => {
  if (value == null || value === '') return fallback;
  const month = String(value).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: 'month must be YYYY-MM' };
  return month;
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
  return {
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
    currentMonth: month,
    currentMonthTotal: round(monthTotal),
    currentMonthByCategory: Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([id, total]) => `${categoryLabel(id) || id}|${round(total)}`)
      .join('\n'),
    columns: 'category|amount',
  };
};

const getFamilySharedTotals = (ctx: FamilyToolContext, args: Args): ToolResult => {
  const family = requireFamily(ctx);
  if ('error' in family) return family;

  const current = localToday().slice(0, 7);
  const hasRange = !!(args.from || args.to);
  const fromRaw = hasRange ? String(args.from || args.to).slice(0, 7) : '';
  const toRaw = hasRange ? String(args.to || args.from).slice(0, 7) : '';
  const monthParsed = hasRange
    ? null
    : parseMonth(args.month, current);
  if (monthParsed && typeof monthParsed !== 'string') return monthParsed;

  const start = hasRange ? fromRaw : (monthParsed as string);
  const end = hasRange ? toRaw : (monthParsed as string);
  if (hasRange && (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end))) {
    return { error: 'from/to must be YYYY-MM' };
  }

  let cats: Set<string> | null = null;
  if (Array.isArray(args.categories) && args.categories.length) {
    cats = new Set(args.categories.map(String));
  }

  const filtered = family.categoryTotals.filter((row) => {
    if (row.month < start || row.month > end) return false;
    if (cats && !cats.has(row.category_id)) return false;
    return true;
  });

  const multiMonth = start !== end;
  if (multiMonth) {
    const map = new Map<string, number>();
    for (const row of filtered) {
      const key = `${row.month}|${categoryLabel(row.category_id) || row.category_id}`;
      map.set(key, (map.get(key) || 0) + row.total);
    }
    const rows = [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([key, total]) => `${key}|${round(total)}`);
    const total = filtered.reduce((s, r) => s + r.total, 0);
    return {
      from: start,
      to: end,
      total: round(total),
      columns: 'month|category|amount',
      rows: rows.join('\n'),
    };
  }

  const byCat = new Map<string, number>();
  for (const row of filtered) {
    byCat.set(
      row.category_id,
      (byCat.get(row.category_id) || 0) + row.total
    );
  }
  const rows = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, total]) => `${categoryLabel(id) || id}|${round(total)}`);
  const total = filtered.reduce((s, r) => s + r.total, 0);
  return {
    month: start,
    total: round(total),
    columns: 'category|amount',
    rows: rows.join('\n'),
  };
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

  const labelByUser = new Map(
    family.members.map((m) => [m.userId, m.label] as const)
  );
  const totals = new Map<string, number>();
  for (const row of family.memberTotals) {
    if (row.category_id !== categoryId) continue;
    if (month && row.month !== month) continue;
    totals.set(row.user_id, (totals.get(row.user_id) || 0) + row.total);
  }

  const rows = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([uid, amount]) =>
        `${labelByUser.get(uid) || uid.slice(0, 8)}|${round(amount)}`
    );
  const total = [...totals.values()].reduce((s, n) => s + n, 0);

  return {
    categoryId,
    category: categoryLabel(categoryId) || categoryId,
    month: month || 'all',
    total: round(total),
    columns: 'member|amount',
    rows: rows.join('\n'),
  };
};

export const familyToolDeclarations: GeminiFunctionDeclaration[] = [
  {
    name: 'get_family_overview',
    description:
      'Family / household budget overview: household name, your role, members, shared category names, and this month\'s combined shared spend. Prefer for "what is our family budget" questions.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_family_shared_totals',
    description:
      'Combined family spend on shared categories only (aggregates). Optional month (YYYY-MM, default current), or from/to months, and optional category ids. Prefer this for family totals by category.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'YYYY-MM. Default current month.' },
        from: { type: 'string', description: 'Start month YYYY-MM (range).' },
        to: { type: 'string', description: 'End month YYYY-MM (range).' },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional shared category ids.',
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
];

export const familyToolExecutors: Record<
  string,
  (ctx: FamilyToolContext, args: Args) => ToolResult
> = {
  get_family_overview: getFamilyOverview,
  get_family_shared_totals: getFamilySharedTotals,
  get_family_member_contribution: getFamilyMemberContribution,
};

export const FAMILY_TOOL_LABELS: Record<string, string> = {
  get_family_overview: 'Checking family budget',
  get_family_shared_totals: 'Calculating family shared totals',
  get_family_member_contribution: 'Checking member contributions',
};
