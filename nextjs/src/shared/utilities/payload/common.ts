export const isAdmin = (user: unknown): boolean => {
  return Boolean((user as any)?.roles?.includes?.('admin'))
}

// Normalize Payload `date` field to `YYYY-MM-DD`.
export const toISODate = (value: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return undefined
}
