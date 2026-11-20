/** Month heading such as "Martie 2025" for a YYYY-MM-DD date. */
export function monthLabel(date: string | null) {
  if (!date || !/^\d{4}-\d{2}/.test(date)) {
    return "Fără dată";
  }
  const parsed = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "Fără dată";
  }
  const text = new Intl.DateTimeFormat("ro-RO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
  return text.charAt(0).toLocaleUpperCase("ro") + text.slice(1);
}

/**
 * Splits an already date-sorted list into consecutive month groups so a long
 * history reads as a timeline instead of one flat list.
 */
export function groupByMonth<T extends { date: string | null }>(items: T[]) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = item.date && /^\d{4}-\d{2}/.test(item.date) ? item.date.slice(0, 7) : "none";
    const last = groups.at(-1);
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, label: monthLabel(item.date), items: [item] });
    }
  }
  return groups;
}

/** Accent-insensitive, case-insensitive text for matching Romanian input. */
export function foldText(value: string) {
  return value
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}
