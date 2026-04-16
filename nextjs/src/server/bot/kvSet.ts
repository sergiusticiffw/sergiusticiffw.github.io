// Support Vercel/Upstash env naming
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const REST_READONLY_TOKEN =
  process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

/**
 * Upstash REST API: `REST_URL/command/arg1/arg2/...`
 * @see https://upstash.com/docs/redis/features/restapi
 */
async function runRedisCommand<T>(command: string, args: (string | number)[]): Promise<T> {
  const baseUrl = requireEnv('KV_REST_API_URL', REST_URL).replace(/\/$/, '')
  const token = requireEnv(
    command === 'smembers' ? 'KV_REST_API_READ_ONLY_TOKEN' : 'KV_REST_API_TOKEN',
    command === 'smembers' ? REST_READONLY_TOKEN : REST_TOKEN,
  )

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
