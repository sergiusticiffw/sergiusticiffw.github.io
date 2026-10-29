export const RECORD_CATEGORIES = [
  "Consultație",
  "Analiză",
  "Investigație",
] as const;

export type RecordCategory = (typeof RECORD_CATEGORIES)[number];

export const DEFAULT_RECORD_CATEGORY: RecordCategory = "Consultație";

export function parseRecordCategory(value: unknown): RecordCategory {
  const raw = String(value ?? "").trim();
  if ((RECORD_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as RecordCategory;
  }
  // Older values / plurals from Drive folders
  if (/^analize$/i.test(raw)) return "Analiză";
  if (/^investiga/i.test(raw)) return "Investigație";
  if (/^consulta/i.test(raw)) return "Consultație";
  return DEFAULT_RECORD_CATEGORY;
}
