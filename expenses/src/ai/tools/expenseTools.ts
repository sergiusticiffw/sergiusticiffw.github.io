import { categories } from '@shared/utils/constants';
import { extractHashtags } from '@shared/utils/utils';
import { normalizeTag } from '@shared/hooks/useTags';
import {
  INCOME_TAG_KEY,
  activeTags,
  tagGroups,
} from '../../tags/catalog';
import { getTagCatalog } from '../../tags/store';
import type { GeminiFunctionDeclaration } from '../client';
import { AI_LIMITS } from '../config';
import {
  AiItem,
  categoryLabel,
  localToday,
  normalizeText,
  round,
  visibleDescription,
} from '../data';

export interface ExpenseToolContext {
  items: AiItem[];
  shareDescriptions: boolean;
}

type Args = Record<string, any>;
type ToolResult = Record<string, unknown>;

const CATEGORY_IDS = categories.map((c) => c.value).filter(Boolean);

/** Lightweight keyword hints when history has no strong match. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '1': ['haine', 'pantaloni', 'tricou', 'incaltaminte', 'pantofi', 'rochie', 'geaca', 'clothing', 'shoes'],
  '2': ['restaurant', 'cafea', 'cinema', 'concert', 'alcool', 'bere', 'vin', 'entertainment', 'happy hour'],
  '3': ['paine', 'lapte', 'market', 'mancare', 'alimente', 'glovo', 'lunch', 'apa', 'food', 'grocery'],
  '4': ['cadou', 'flori', 'gift', 'birthday', 'zi de nastere'],
  '5': [
    'covor',
    'carpet',
    'detergent',
    'curatenie',
    'lampa',
    'lamp',
    'mobilier',
    'perdele',
    'lenjerie',
    'farfurii',
    'household',
    'scutece',
  ],
  '6': ['chirie', 'rent', 'ipoteca', 'mortgage', 'rata', 'housing', 'apartament'],
  '7': ['farmacie', 'doctor', 'stomatolog', 'medic', 'asigurare', 'sport', 'pharmacy', 'dental'],
  '8': ['tunsoare', 'haircut', 'unghii', 'nails', 'abonament', 'netflix', 'spotify', 'beauty', 'subscription'],
  '9': ['benzina', 'motorina', 'taxi', 'parcare', 'troleibus', 'autobuz', 'fuel', 'car wash', 'service auto'],
  '10': ['gaz', 'lumina', 'curent', 'apa', 'orange', 'moldcell', 'internet', 'utilities', 'bloc'],
  '11': ['vacanta', 'concediu', 'travel', 'avion', 'hotel', 'romania'],
  '12': ['gradinita', 'jucarii', 'scoala', 'family', 'leo', 'copil'],
  '13': ['investitie', 'actiuni', 'fond', 'investment', 'broker'],
};

const clampLimit = (value: unknown, fallback: number, max: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};

const tokens = (text: string) =>
  text
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

const bareDescription = (search: string) =>
  search.replace(/\s*#\S+/g, '').trim() || search;

/** 0–1 similarity: substring and token overlap. */
export const textSimilarity = (query: string, haystack: string): number => {
  const q = normalizeText(query);
  const h = normalizeText(haystack);
  if (!q || !h) return 0;
  if (q === h) return 1;
  if (h.includes(q) || q.includes(h)) return 0.92;
  const qt = tokens(q);
  const ht = tokens(h);
  if (!qt.length || !ht.length) return 0;
  const hSet = new Set(ht);
  let hit = 0;
  for (const t of qt) {
    if (hSet.has(t)) {
      hit += 1;
      continue;
    }
    if ([...hSet].some((x) => x.includes(t) || t.includes(x))) hit += 0.7;
  }
  return Math.min(1, hit / qt.length);
};

const keywordVotes = (query: string): Map<string, number> => {
  const q = normalizeText(query);
  const votes = new Map<string, number>();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const word of words) {
      const w = normalizeText(word);
      if (q.includes(w) || tokens(q).some((t) => t === w || t.includes(w) || w.includes(t))) {
        score += w.length >= 5 ? 1.2 : 1;
      }
    }
    if (score) votes.set(cat, score);
  }
  return votes;
};

const tagsForCategory = (categoryId: string): string[] => {
  const catalog = getTagCatalog();
  return activeTags(catalog, categoryId).map((tag) => normalizeTag(tag));
};

const pickTagsForQuery = (query: string, categoryId: string, limit = 2): string[] => {
  const q = normalizeText(query);
  const tags = tagsForCategory(categoryId);
  const scored = tags
    .map((tag) => ({ tag, score: textSimilarity(q, tag) }))
    .filter((row) => row.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((row) => row.tag);
};

const confidenceOf = (score: number): 'high' | 'medium' | 'low' => {
  if (score >= 3) return 'high';
  if (score >= 1.2) return 'medium';
  return 'low';
};

const suggestCategory = (ctx: ExpenseToolContext, args: Args): ToolResult => {
  const query = String(args.query || args.description || args.item || '').trim();
  if (query.length < 2) return { error: 'query must be at least 2 characters' };

  const q = normalizeText(query);
  const expenses = ctx.items.filter((i) => i.kind === 'expense');
  const historyVotes = new Map<string, number>();
  const similar: {
    date: string;
    amount: number;
    categoryId: string;
    category: string;
    description: string;
    score: number;
  }[] = [];

  for (const item of expenses) {
    const score = textSimilarity(q, bareDescription(item.search));
    if (score < 0.35) continue;
    const weight = score * (1 + Math.min(2, Math.abs(item.amount) / 1000));
    historyVotes.set(item.cat, (historyVotes.get(item.cat) || 0) + weight);
    similar.push({
      date: item.date,
      amount: round(item.amount),
      categoryId: item.cat,
      category: categoryLabel(item.cat) || item.cat,
      description: visibleDescription(item.desc, ctx.shareDescriptions),
      score: round(score, 2),
    });
  }

  similar.sort((a, b) => b.score - a.score || (a.date < b.date ? 1 : -1));
  const topSimilar = similar.slice(0, clampLimit(args.limit, 5, 15));

  const keyword = keywordVotes(query);
  const combined = new Map<string, number>();
  for (const id of CATEGORY_IDS) {
    const h = historyVotes.get(id) || 0;
    const k = keyword.get(id) || 0;
    const total = h * 1.6 + k;
    if (total > 0) combined.set(id, total);
  }

  const ranked = [...combined.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) {
    return {
      query,
      categoryId: '8',
      category: categoryLabel('8') || 'Personal',
      confidence: 'low',
      reason: 'No strong history or keyword match; Personal is the fallback category.',
      suggestedTags: [],
      similar: topSimilar,
      prefill: { categoryId: '8', description: query, tags: [] },
    };
  }

  const [bestId, bestScore] = ranked[0];
  const alt = ranked[1];
  const fromHistory = (historyVotes.get(bestId) || 0) >= (keyword.get(bestId) || 0);
  const suggestedTags = pickTagsForQuery(query, bestId);
  const description =
    topSimilar[0] && topSimilar[0].score >= 0.85 && ctx.shareDescriptions
      ? topSimilar[0].description.replace(/\s*#\S+/g, '').trim() || query
      : query;

  return {
    query,
    categoryId: bestId,
    category: categoryLabel(bestId) || bestId,
    confidence: confidenceOf(bestScore),
    reason: fromHistory
      ? `Based on similar past expenses (${topSimilar.length} match${topSimilar.length === 1 ? '' : 'es'}).`
      : 'Based on product keywords; little matching history found.',
    ...(alt
      ? {
          alternative: {
            categoryId: alt[0],
            category: categoryLabel(alt[0]) || alt[0],
            reason: 'Next-closest match',
          },
        }
      : {}),
    suggestedTags,
    similar: topSimilar,
    prefill: {
      categoryId: bestId,
      description,
      tags: suggestedTags,
    },
  };
};

const listCategoryTags = (_ctx: ExpenseToolContext, args: Args): ToolResult => {
  const catalog = getTagCatalog();
  const only = args.category ? String(args.category) : '';
  const groups = tagGroups()
    .filter((group) => group.key !== INCOME_TAG_KEY)
    .filter((group) => !only || group.key === only)
    .map((group) => {
      const tags = activeTags(catalog, group.key).map((tag) => normalizeTag(tag));
      return {
        categoryId: group.key,
        category: categoryLabel(group.key) || group.label,
        tags,
      };
    })
    .filter((group) => group.tags.length > 0);

  if (only && !groups.length) {
    return {
      categoryId: only,
      category: categoryLabel(only) || only,
      tags: [],
      note: 'No tags configured for this category.',
    };
  }

  return {
    mode: catalog.mode,
    groupCount: groups.length,
    groups,
  };
};

const findSimilarExpenses = (ctx: ExpenseToolContext, args: Args): ToolResult => {
  const query = String(args.query || args.description || '').trim();
  if (query.length < 2) return { error: 'query must be at least 2 characters' };
  if (!ctx.shareDescriptions) {
    return {
      error: 'The user disabled sharing descriptions. Use hashtag filters via aggregate instead.',
    };
  }

  const minScore = typeof args.minScore === 'number' ? args.minScore : 0.35;
  const limit = clampLimit(args.limit, 10, AI_LIMITS.toolRowsMax);
  const cats = Array.isArray(args.categories)
    ? new Set(args.categories.map(String))
    : null;

  const rows = ctx.items
    .filter((i) => i.kind === 'expense')
    .filter((i) => !cats || cats.has(i.cat))
    .map((item) => ({
      item,
      score: textSimilarity(query, bareDescription(item.search)),
    }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score || (a.item.date < b.item.date ? 1 : -1))
    .slice(0, limit);

  return {
    query,
    matched: rows.length,
    columns: 'date|amount|category|description|score',
    rows: rows
      .map(
        ({ item, score }) =>
          `${item.date}|${round(item.amount)}|${categoryLabel(item.cat) || item.cat}|${visibleDescription(item.desc, true)}|${round(score, 2)}`
      )
      .join('\n'),
  };
};

const monthGap = (a: string, b: string) => {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return Math.abs(ay * 12 + am - (by * 12 + bm));
};

const detectRecurring = (ctx: ExpenseToolContext, args: Args): ToolResult => {
  const minMonths = clampLimit(args.minMonths, 3, 12);
  const lookback = clampLimit(args.months, 18, 60);
  const limit = clampLimit(args.limit, 15, 40);
  const today = localToday().slice(0, 7);
  const [ty, tm] = today.split('-').map(Number);
  const earliestDate = new Date(ty, tm - 1 - lookback, 1);
  const earliest = `${earliestDate.getFullYear()}-${String(earliestDate.getMonth() + 1).padStart(2, '0')}`;

  type Bucket = {
    key: string;
    label: string;
    cat: string;
    amounts: number[];
    months: Set<string>;
    lastDate: string;
  };

  const buckets = new Map<string, Bucket>();
  for (const item of ctx.items) {
    if (item.kind !== 'expense' || item.month < earliest) continue;
    if (!ctx.shareDescriptions && !extractHashtags(item.desc).length) continue;

    const bare = bareDescription(item.search);
    const tags = extractHashtags(item.desc).map((t) => normalizeText(t)).sort();
    const key = bare.length >= 3 ? `d:${bare}` : tags.length ? `t:${item.cat}:${tags.join(',')}` : '';
    if (!key) continue;

    const bucket =
      buckets.get(key) ||
      ({
        key,
        label: ctx.shareDescriptions
          ? item.desc.replace(/\s*#\S+/g, '').trim() || bare
          : tags.map((t) => `#${t}`).join(' ') || bare,
        cat: item.cat,
        amounts: [],
        months: new Set<string>(),
        lastDate: item.date,
      } as Bucket);

    bucket.amounts.push(item.amount);
    bucket.months.add(item.month);
    if (item.date > bucket.lastDate) bucket.lastDate = item.date;
    if (!bucket.cat && item.cat) bucket.cat = item.cat;
    buckets.set(key, bucket);
  }

  const candidates = [...buckets.values()]
    .filter((b) => b.months.size >= minMonths)
    .map((b) => {
      const amounts = [...b.amounts].sort((a, c) => a - c);
      const median = amounts[Math.floor(amounts.length / 2)] || 0;
      const within = amounts.filter(
        (a) => median === 0 || Math.abs(a - median) / Math.max(Math.abs(median), 1) <= 0.2
      ).length;
      const stableAmount = within / amounts.length >= 0.7;
      const months = [...b.months].sort();
      const gaps: number[] = [];
      for (let i = 1; i < months.length; i++) gaps.push(monthGap(months[i - 1], months[i]));
      const avgGap = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0;
      const cadence =
        avgGap > 0 && avgGap <= 1.4 ? 'monthly' : avgGap <= 3.5 ? 'quarterly' : 'irregular';
      return {
        description: b.label.replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 80),
        categoryId: b.cat,
        category: categoryLabel(b.cat) || b.cat,
        count: b.amounts.length,
        months: b.months.size,
        avgAmount: round(b.amounts.reduce((s, a) => s + a, 0) / b.amounts.length),
        medianAmount: round(median),
        stableAmount,
        cadence,
        lastDate: b.lastDate,
        score: b.months.size * (stableAmount ? 1.4 : 1) * (cadence === 'monthly' ? 1.3 : 1),
      };
    })
    .filter((c) => c.stableAmount || c.cadence === 'monthly')
    .sort((a, b) => b.score - a.score || b.avgAmount - a.avgAmount)
    .slice(0, limit)
    .map(({ score: _score, ...rest }) => rest);

  return {
    lookbackMonths: lookback,
    minMonths,
    matched: candidates.length,
    columns:
      'description|category|count|months|avgAmount|medianAmount|stableAmount|cadence|lastDate',
    rows: candidates
      .map(
        (c) =>
          `${c.description}|${c.category}|${c.count}|${c.months}|${c.avgAmount}|${c.medianAmount}|${c.stableAmount}|${c.cadence}|${c.lastDate}`
      )
      .join('\n'),
    note: 'Candidates with similar amounts across multiple months — likely subscriptions or repeating bills.',
  };
};

export const expenseToolDeclarations: GeminiFunctionDeclaration[] = [
  {
    name: 'suggest_category',
    description:
      'Suggest the best expense category for a product or purchase description, using the user\'s history when possible. Prefer this for "where should I put X" / categorization questions. Returns category, confidence, alternative, suggested tags and a prefill payload.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Product or purchase description, e.g. "covor" or "detergent de rufe".',
        },
        limit: { type: 'integer', description: 'Max similar past expenses to include, default 5.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_category_tags',
    description:
      'Active hashtag/tag suggestions per expense category (or one category). Use when suggesting tags to attach, or when the user asks which tags exist for a category.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Optional category id from CATEGORIES. Omit for every category that has tags.',
        },
      },
    },
  },
  {
    name: 'find_similar_expenses',
    description:
      'Find past expenses similar to a description (fuzzy match). Use for "have I bought something like this" or to ground a category suggestion in concrete rows.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Description to match, e.g. "covor" or "kaufland".' },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional category ids to restrict the search.',
        },
        minScore: { type: 'number', description: 'Minimum similarity 0–1, default 0.35.' },
        limit: { type: 'integer', description: 'Max rows, default 10.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'detect_recurring',
    description:
      'Detect likely recurring expenses / subscriptions: same description or tags repeating across months with a stable amount. Prefer this over guessing from aggregate.',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'integer', description: 'Lookback window in months, default 18.' },
        minMonths: {
          type: 'integer',
          description: 'Minimum distinct months required, default 3.',
        },
        limit: { type: 'integer', description: 'Max candidates, default 15.' },
      },
    },
  },
];

export const expenseToolExecutors: Record<
  string,
  (ctx: ExpenseToolContext, args: Args) => ToolResult
> = {
  suggest_category: suggestCategory,
  list_category_tags: listCategoryTags,
  find_similar_expenses: findSimilarExpenses,
  detect_recurring: detectRecurring,
};

export const EXPENSE_TOOL_LABELS: Record<string, string> = {
  suggest_category: 'Suggesting a category',
  list_category_tags: 'Listing category tags',
  find_similar_expenses: 'Finding similar expenses',
  detect_recurring: 'Detecting recurring expenses',
};

/** Compact one-line notes for follow-up context. */
export const summarizeToolResult = (
  name: string,
  args: Args | undefined,
  result: ToolResult
): string => {
  if (result.error) return `${name} -> error: ${String(result.error).slice(0, 80)}`;
  switch (name) {
    case 'suggest_category':
      return `suggest_category(${JSON.stringify(args?.query || '')}) -> ${result.category} (${result.categoryId}) ${result.confidence}`;
    case 'list_category_tags':
      return `list_category_tags(${args?.category || 'all'}) -> ${result.groupCount ?? 0} groups`;
    case 'find_similar_expenses':
      return `find_similar_expenses(${JSON.stringify(args?.query || '')}) -> ${result.matched ?? 0} rows`;
    case 'detect_recurring':
      return `detect_recurring -> ${result.matched ?? 0} candidates`;
    case 'aggregate':
      return `aggregate(${args?.groupBy || '?'}) -> ${result.groupCount ?? '?'} groups, total=${result.total ?? '?'}`;
    case 'query_transactions':
      return `query_transactions -> ${result.shown ?? '?'}/${result.matched ?? '?'} rows`;
    case 'get_month_summary':
      return `get_month_summary(${args?.month || ''}) -> spent=${result.spent ?? '?'}`;
    case 'compare_periods':
      return `compare_periods -> Δ=${result.change ?? '?'}`;
    case 'get_budget_status':
      return `get_budget_status(${args?.month || 'current'})`;
    case 'compare_budget_vs_spend':
      return `compare_budget_vs_spend(${args?.month || 'current'})`;
    case 'detect_spend_spikes':
      return `detect_spend_spikes(${args?.month || 'current'})`;
    case 'get_savings_rate_trend':
      return `get_savings_rate_trend`;
    default:
      if (name.startsWith('simulate_') || name.startsWith('get_') || name.startsWith('solve_') || name.startsWith('allocate_') || name.startsWith('compare_') || name.startsWith('list_') || name.startsWith('query_')) {
        const loan = args?.loan ? ` loan=${args.loan}` : '';
        return `${name}${loan}`;
      }
      return name;
  }
};
