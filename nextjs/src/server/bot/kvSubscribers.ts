import { kvSMembers, kvSAdd, kvSRem } from './kvSet'

const SUBSCRIBERS_KEY = 'telegram:subscribers'

export async function addSubscriber(chatId: number): Promise<void> {
  await kvSAdd(SUBSCRIBERS_KEY, chatId)
}

export async function removeSubscriber(chatId: number): Promise<void> {
  await kvSRem(SUBSCRIBERS_KEY, chatId)
}

export async function listSubscribers(): Promise<number[]> {
  const members = await kvSMembers(SUBSCRIBERS_KEY)
  return Array.from(
    new Set(
      members
        .map((m) => Number(m))
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.trunc(n)),
    ),
  )
}

