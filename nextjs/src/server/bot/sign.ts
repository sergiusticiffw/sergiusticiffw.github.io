import { createHmac } from 'node:crypto'

function getSecret(): string {
  return process.env.BOT_SECRET || ''
}

export function signChatId(chatId: number): string {
  return createHmac('sha256', getSecret()).update(String(chatId)).digest('hex').slice(0, 16)
}

export function verifyChatId(chatId: number, token: string): boolean {
  return signChatId(chatId) === token
}
