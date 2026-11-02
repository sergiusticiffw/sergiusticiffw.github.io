/** Constrained chart payload the assistant may emit inside ```chart fences. */

export type AiChartType = 'column' | 'bar' | 'line' | 'pie';

export interface AiChartSeries {
  name: string;
  data: number[];
}

export interface AiChartSpec {
  type: AiChartType;
  title?: string;
  unit?: string;
  /** Category labels for column/bar/line. */
  categories?: string[];
  /** Named series for column/bar/line. */
  series?: AiChartSeries[];
  /** Pie slices. */
  data?: { name: string; y: number }[];
}

const TYPES = new Set<AiChartType>(['column', 'bar', 'line', 'pie']);
const MAX_POINTS = 36;
const MAX_SERIES = 4;
const MAX_LABEL = 80;

const asNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const asLabel = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim().slice(0, MAX_LABEL);
  return text || null;
};

/** Parse and validate a ```chart JSON body. Returns null if invalid. */
export const parseChartSpec = (raw: string): AiChartSpec | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== 'string' || !TYPES.has(type as AiChartType)) return null;

  const title = asLabel(obj.title) || undefined;
  const unit = asLabel(obj.unit) || undefined;

  if (type === 'pie') {
    const rows = Array.isArray(obj.data) ? obj.data : null;
    if (!rows?.length) return null;
    const data: { name: string; y: number }[] = [];
    for (const row of rows.slice(0, MAX_POINTS)) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      const name = asLabel(item.name);
      const y = asNumber(item.y ?? item.value);
      if (name && y !== null) data.push({ name, y });
    }
    if (!data.length) return null;
    return { type: 'pie', title, unit, data };
  }

  const categoriesRaw = Array.isArray(obj.categories) ? obj.categories : null;
  const seriesRaw = Array.isArray(obj.series) ? obj.series : null;
  if (!categoriesRaw?.length || !seriesRaw?.length) return null;

  const categories = categoriesRaw
    .slice(0, MAX_POINTS)
    .map(asLabel)
    .filter((label): label is string => !!label);
  if (!categories.length) return null;

  const series: AiChartSeries[] = [];
  for (const entry of seriesRaw.slice(0, MAX_SERIES)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const name = asLabel(item.name) || 'Series';
    if (!Array.isArray(item.data)) continue;
    const data = item.data
      .slice(0, categories.length)
      .map((value) => asNumber(value))
      .map((value) => (value === null ? 0 : value));
    if (data.length) series.push({ name, data });
  }
  if (!series.length) return null;

  return { type: type as Exclude<AiChartType, 'pie'>, title, unit, categories, series };
};

export type AiMessagePart =
  | { kind: 'markdown'; text: string }
  | { kind: 'chart'; raw: string };

/**
 * Split assistant text into markdown and ```chart``` parts.
 * An unclosed chart fence (while streaming) is omitted until complete.
 */
export const splitAiMessageParts = (source: string): AiMessagePart[] => {
  const text = source.replace(/\r\n/g, '\n');
  const parts: AiMessagePart[] = [];
  const re = /```chart[^\n]*\n([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      parts.push({ kind: 'markdown', text: text.slice(last, match.index) });
    }
    parts.push({ kind: 'chart', raw: match[1] });
    last = match.index + match[0].length;
  }

  const rest = text.slice(last);
  if (!rest) return parts;

  const incomplete = rest.search(/```chart\b/);
  if (incomplete >= 0) {
    if (incomplete > 0) {
      parts.push({ kind: 'markdown', text: rest.slice(0, incomplete) });
    }
    return parts;
  }

  parts.push({ kind: 'markdown', text: rest });
  return parts;
};
