// Support Vercel/Upstash env naming
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const REST_READONLY_TOKEN =
  process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

async function runRedisCommand<T>(command: string, args: (string | number)[]): Promise<T> {
  const url = requireEnv('KV_REST_API_URL', REST_URL)
  const token = requireEnv(
    command === 'smembers' ? 'KV_REST_API_READ_ONLY_TOKEN' : 'KV_REST_API_TOKEN',
    command === 'smembers' ? REST_READONLY_TOKEN : REST_TOKEN,
  )

  const q = new URL(url)
  // Upstash REST uses query params like ?sadd=myset a
  q.searchParams.set(command, args.join(' '))

  const res = await fetch(q.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    // Avoid caching sensitive/credentialled requests
    cache: 'no-store',
  })

  const data: any = await res.json().catch(() => null)
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
  // Some implementations might return a set-like string; best-effort fallback.
  return [String(result)]
}

