declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_SERVER_URL?: string
      VERCEL_URL?: string
      VERCEL_PROJECT_PRODUCTION_URL?: string

      BOT_TOKEN?: string
      BOT_SECRET?: string
      CRON_SECRET?: string
      CHAT_IDS?: string

      KV_REST_API_URL?: string
      KV_REST_API_TOKEN?: string
      KV_REST_API_READ_ONLY_TOKEN?: string
      UPSTASH_REDIS_REST_URL?: string
      UPSTASH_REDIS_REST_TOKEN?: string
    }
  }
}

export {}
