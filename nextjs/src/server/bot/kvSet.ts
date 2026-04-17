function resolveKvUrl(): string {
  const v = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  if (!v) throw new Error('Missing env: KV_REST_API_URL or UPSTASH_REDIS_REST_URL')
  return v
}

function resolveKvToken(readonly: boolean): string {
  if (readonly) {
    const v = process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
    if (!v) throw new Error('Missing env: KV_REST_API_READ_ONLY_TOKEN or UPSTASH_REDIS_REST_TOKEN')
    return v
  }
  const v = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!v) throw new Error('Missing env: KV_REST_API_TOKEN or UPSTASH_REDIS_REST_TOKEN')
  return v
}

/**
 * Upstash REST API: `REST_URL/command/arg1/arg2/...`
 * @see https://upstash.com/docs/redis/features/restapi
 */
async function runRedisCommand<T>(command: string, args: (string | number)[]): Promise<T> {
  const baseUrl = resolveKvUrl().replace(/\/$/, '')
  const isReadonly = command.toLowerCase() === 'smembers'
  const token = resolveKvToken(isReadonly)

  const cmd = command.toLowerCase()
  const path = [cmd, ...args.map((a) => encodeURIComponent(String(a)))].join('/')
  const requestUrl = `${baseUrl}/${path}`

  const res = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  const data: { result?: T; error?: string } | null = await res.json().catch(() => null)

  if (!res.ok || (data && typeof data.error === 'string')) {
    const msg = data?.error ?? res.statusText ?? 'Unknown Redis error'
    throw new Error(`Upstash Redis ${command.toUpperCase()}: ${msg}`)
  }

  if (data && Object.prototype.hasOwnProperty.call(data, 'result')) return data.result as T
  return data as T
}

export async function kvSAdd(setKey: string, member: string | number): Promise<void> {
  await runRedisCommand('sadd', [setKey, member])
}

export async function kvSRem(setKey: string, member: string | number): Promise<void> {
  await runRedisCommand('srem', [setKey, member])
}

export async function kvSMembers(setKey: string): Promise<string[]> {
  const result = await runRedisCommand<unknown>('smembers', [setKey])
  if (Array.isArray(result)) return result.map(String)
  if (result == null) return []
  return [String(result)]
}
