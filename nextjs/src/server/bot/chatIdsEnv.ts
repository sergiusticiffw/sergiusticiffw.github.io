function normalizeIdText(s: unknown) {
  return String(s ?? '').trim().replace(/\u2212/g, '-')
}

export function parseChatIdsFromEnv(raw: string | undefined): number[] {
  if (!raw) return []
  const s = normalizeIdText(raw)
  if (!s) return []
  const ids = s
    .split(/[,;\s]+/)
    .map((part) => normalizeIdText(part))
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n))
  return Array.from(new Set(ids))
}

