/**
 * Stable UUIDs for Drupal numeric nids (and other non-UUID ids) so
 * create/import upsert the same row instead of duplicating.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StableIdKind = 'tx' | 'loan' | 'pay';

export const isUuid = (value: string): boolean => UUID_RE.test(value);

/** UUID v5-style id derived from user + kind + source id (SHA-1). */
export const stableRowId = async (
  userId: string,
  kind: StableIdKind,
  sourceId: string
): Promise<string> => {
  const raw = String(sourceId || '').trim();
  if (!raw) {
    throw new Error('stableRowId requires a non-empty source id');
  }
  if (isUuid(raw)) return raw.toLowerCase();

  const bytes = new TextEncoder().encode(`${userId}:${kind}:${raw}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes));
  const out = hash.slice(0, 16);
  out[6] = (out[6] & 0x0f) | 0x50; // version 5
  out[8] = (out[8] & 0x3f) | 0x80; // variant
  const hex = [...out].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Resolve a body/source id into a UUID suitable for upsert PK. */
export const resolveEntityId = async (
  userId: string,
  kind: StableIdKind,
  sourceId: unknown
): Promise<string | undefined> => {
  const raw = String(sourceId ?? '').trim();
  if (!raw || raw.startsWith('temp_')) return undefined;
  return stableRowId(userId, kind, raw);
};
