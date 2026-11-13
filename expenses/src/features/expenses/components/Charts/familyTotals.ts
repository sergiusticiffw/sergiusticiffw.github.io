import type { AiItem } from '../../../../ai/data';
import type { FamilyCategoryTotal } from '../../../../data';

/** Turn RPC month×category totals into AiItems (no partner row details). */
export const totalsToAiItems = (totals: FamilyCategoryTotal[]): AiItem[] =>
  totals
    .filter((row) => row.month?.length === 7 && row.total > 0)
    .map((row) => ({
      date: `${row.month}-01`,
      month: row.month,
      amount: row.total,
      kind: 'expense' as const,
      cat: row.category_id,
      desc: '',
      search: '',
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/** Own expenses in shared categories (works offline / with encryption). */
export const sharedTotalsFromItems = (
  items: AiItem[],
  shared: Set<string>
): AiItem[] => {
  const map = new Map<string, number>();
  for (const item of items) {
    const cat = item.cat != null ? String(item.cat) : '';
    if (item.kind !== 'expense' || !cat || !shared.has(cat)) continue;
    if (item.month.length !== 7) continue;
    const key = `${item.month}\0${cat}`;
    map.set(key, (map.get(key) || 0) + item.amount);
  }
  return [...map.entries()]
    .map(([key, amount]) => {
      const [month, cat] = key.split('\0');
      return {
        date: `${month}-01`,
        month,
        amount,
        kind: 'expense' as const,
        cat,
        desc: '',
        search: '',
      };
    })
    .filter((row) => row.amount > 0)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
};

export type SharedCategorySpend = {
  id: string;
  label: string;
  amount: number;
  color?: string;
};

/** Collapse AiItems to category spend for one YYYY-MM month. */
export const categorySpendForMonth = (
  items: AiItem[],
  monthKey: string,
  labelFor: (id: string) => string,
  colorFor?: (id: string) => string | undefined
): SharedCategorySpend[] => {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== 'expense' || item.month !== monthKey) continue;
    const id = item.cat || '0';
    totals.set(id, (totals.get(id) || 0) + item.amount);
  }
  return [...totals.entries()]
    .map(([id, amount]) => ({
      id,
      label: labelFor(id),
      amount,
      color: colorFor?.(id),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
};
