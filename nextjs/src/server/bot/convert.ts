import { BNM_DATE_REGEX } from '@/server/bot/dateRatesReply'

export type ConvertCurrency = 'MDL' | 'USD' | 'EUR'

export type ConvertParseOk = {
  amount: number
  currency: ConvertCurrency
  date?: string
}

export type ConvertParseResult = ConvertParseOk | { error: string }

const CURRENCY_ALIASES: Record<string, ConvertCurrency> = {
  mdl: 'MDL',
  lei: 'MDL',
  leu: 'MDL',
  l: 'MDL',
  usd: 'USD',
  $: 'USD',
  dolar: 'USD',
  dolari: 'USD',
  dollar: 'USD',
  dollars: 'USD',
  eur: 'EUR',
  '€': 'EUR',
  euro: 'EUR',
  euroi: 'EUR',
}

export const CONVERT_USAGE =
  'Usage: /convert <amount> <currency> [DD.MM.YYYY]\n' +
  'Examples:\n' +
  '  /convert 100 USD\n' +
  '  /convert 100 EUR 17.04.2026\n' +
  '  /convert 2500 MDL\n' +
  '  /convert 2500 lei\n' +
  'Currencies: MDL (lei), USD, EUR'

function parseAmountToken(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, '')
  if (!s) return null

  // European thousands: 1.000,50 or 1.000
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',') && !s.includes('.')) {
    // 100,50
    s = s.replace(',', '.')
  } else {
    // Strip thousands commas: 1,000.50
    s = s.replace(/,/g, '')
  }

  const num = Number(s)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

function resolveCurrency(token: string): ConvertCurrency | null {
  const key = token.trim().toLowerCase()
  return CURRENCY_ALIASES[key] ?? null
}

/**
 * Parse `/convert` args: amount + currency + optional DD.MM.YYYY.
 * Amount may contain spaces (e.g. "1 000 USD").
 */
export function parseConvertArg(arg: string): ConvertParseResult {
  const trimmed = arg.trim()
  if (!trimmed) return { error: CONVERT_USAGE }

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return { error: CONVERT_USAGE }

  let date: string | undefined
  let rest = tokens

  const last = tokens[tokens.length - 1]
  if (BNM_DATE_REGEX.test(last)) {
    date = last
    rest = tokens.slice(0, -1)
  }

  if (rest.length < 2) return { error: CONVERT_USAGE }

  const currencyToken = rest[rest.length - 1]
  const currency = resolveCurrency(currencyToken)
  if (!currency) {
    return {
      error: `Unknown currency "${currencyToken}". Use MDL/lei, USD, or EUR.\n\n${CONVERT_USAGE}`,
    }
  }

  const amountRaw = rest.slice(0, -1).join(' ')
  const amount = parseAmountToken(amountRaw)
  if (amount == null) {
    return { error: `Invalid amount "${amountRaw}".\n\n${CONVERT_USAGE}` }
  }

  if (date && !BNM_DATE_REGEX.test(date)) {
    return { error: 'Invalid date format. Use DD.MM.YYYY (example: 17.04.2026)' }
  }

  return { amount, currency, date }
}

export type ConvertResult = {
  mdl: number | null
  usd: number | null
  eur: number | null
}

function toRate(value: string | null): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** BNM rates are MDL per 1 USD / 1 EUR. */
export function convertAmount({
  amount,
  currency,
  usdRate,
  eurRate,
}: {
  amount: number
  currency: ConvertCurrency
  usdRate: string | null
  eurRate: string | null
}): ConvertResult {
  const usd = toRate(usdRate)
  const eur = toRate(eurRate)

  if (currency === 'USD') {
    return {
      usd: amount,
      mdl: usd != null ? amount * usd : null,
      eur: usd != null && eur != null ? (amount * usd) / eur : null,
    }
  }

  if (currency === 'EUR') {
    return {
      eur: amount,
      mdl: eur != null ? amount * eur : null,
      usd: usd != null && eur != null ? (amount * eur) / usd : null,
    }
  }

  // MDL
  return {
    mdl: amount,
    usd: usd != null ? amount / usd : null,
    eur: eur != null ? amount / eur : null,
  }
}

function formatMoney(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatRateLabel(rate: string | null): string {
  if (rate == null) return 'n/a'
  const n = Number(rate)
  if (!Number.isFinite(n)) return rate
  return n.toFixed(4)
}

function lineOrUnavailable(label: string, value: number | null, note?: string): string {
  if (value == null) return `  • ${label}: Not available yet`
  const noteText = note ? `  (${note})` : ''
  return `  • ${formatMoney(value)} ${label}${noteText}`
}

export function formatConvertMessage({
  bnmDate,
  amount,
  currency,
  usdRate,
  eurRate,
  result,
}: {
  bnmDate: string
  amount: number
  currency: ConvertCurrency
  usdRate: string | null
  eurRate: string | null
  result: ConvertResult
}): string {
  const header = `💱 Convert — ${bnmDate} (BNM)\n\n${formatMoney(amount)} ${currency} =`

  const lines: string[] = []

  if (currency === 'USD') {
    lines.push(lineOrUnavailable('MDL', result.mdl, usdRate != null ? `curs ${formatRateLabel(usdRate)}` : undefined))
    lines.push(lineOrUnavailable('EUR', result.eur, 'cross'))
  } else if (currency === 'EUR') {
    lines.push(lineOrUnavailable('MDL', result.mdl, eurRate != null ? `curs ${formatRateLabel(eurRate)}` : undefined))
    lines.push(lineOrUnavailable('USD', result.usd, 'cross'))
  } else {
    lines.push(lineOrUnavailable('USD', result.usd))
    lines.push(lineOrUnavailable('EUR', result.eur))
  }

  const footer = `\nCursuri: 1 USD = ${formatRateLabel(usdRate)} MDL | 1 EUR = ${formatRateLabel(eurRate)} MDL`

  return [header, ...lines, footer].join('\n')
}
