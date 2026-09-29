import { shiftBnmDate } from '@/server/bot/date'

function normalizeRateValue(value: string | null): string | null {
  if (value == null) return null
  const str = String(value).replace(/\s/g, '')
  const num = Number(str.replace(',', '.'))
  if (!Number.isFinite(num)) return null
  const rounded = Math.round(num * 10000) / 10000
  return rounded.toFixed(4).replace(/\.?0+$/, '')
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function ddmmyyyyToIso(dateBnm: string): string | null {
  const m = dateBnm.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

export type BnmRates = { usd: string | null; eur: string | null }

const EMPTY_RATES: BnmRates = { usd: null, eur: null }

function extractCharValueFromBnmXml(xml: string, code: string): string | null {
  const upper = xml.toUpperCase()
  const marker = `<CHARCODE>${code}</CHARCODE>`
  const idx = upper.indexOf(marker)
  if (idx === -1) return null

  const after = xml.slice(idx)
  const match = after.match(/<Value>([^<]+)<\/Value>/i)
  return normalizeRateValue(match?.[1] ?? null)
}

function ratesFromXml(xml: string): BnmRates {
  return {
    usd: extractCharValueFromBnmXml(xml, 'USD'),
    eur: extractCharValueFromBnmXml(xml, 'EUR'),
  }
}

const FETCH_HEADERS = {
  Accept: 'application/xml, application/json, text/xml;q=0.9, */*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (compatible; CurrencyBot/1.0; +https://sergiusticiffw-github-io.vercel.app)',
}

const ROMANIAN_MONTHS = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
]

function mergeRates(current: BnmRates, next: BnmRates | null): BnmRates {
  if (!next) return current
  return {
    usd: current.usd ?? next.usd,
    eur: current.eur ?? next.eur,
  }
}

function isComplete(rates: BnmRates): boolean {
  return rates.usd != null && rates.eur != null
}

/**
 * Official BNM USD and EUR rates.
 * Vercel cannot open www.bnm.md. mdl.md is the fast path, but it leaves
 * tomorrow's list empty. cursbnm.md publishes that same official value per day.
 * Direct XML is the last fallback.
 */
export async function fetchBnmRatesForDate(dateBnm: string): Promise<BnmRates> {
  let rates = EMPTY_RATES

  try {
    rates = mergeRates(rates, await fetchRatesFromMdl(dateBnm))
  } catch (err) {
    console.error(`[bnm] ${dateBnm} mdl.md: ${errorMessage(err)}`)
  }
  if (isComplete(rates)) return rates

  try {
    rates = mergeRates(rates, await fetchRatesFromCursBnm(dateBnm))
  } catch (err) {
    console.error(`[bnm] ${dateBnm} cursbnm: ${errorMessage(err)}`)
  }
  if (isComplete(rates)) return rates

  return mergeRates(rates, await fetchRatesFromBnmXml(dateBnm))
}

export type BnmRatesWithPrevious = BnmRates & { previous: BnmRates }

/** Rates for `dateBnm` plus the previous calendar day, for day-over-day comparison. */
export async function fetchBnmRatesWithPrevious(dateBnm: string): Promise<BnmRatesWithPrevious> {
  const previousDate = shiftBnmDate(dateBnm, -1)
  const [current, previous] = await Promise.all([
    fetchBnmRatesForDate(dateBnm).catch(() => EMPTY_RATES),
    previousDate ? fetchBnmRatesForDate(previousDate).catch(() => EMPTY_RATES) : EMPTY_RATES,
  ])
  return { ...current, previous }
}

function cursBnmUrl(dateBnm: string): string | null {
  const match = dateBnm.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return null
  const month = ROMANIAN_MONTHS[Number(match[2]) - 1]
  if (!month) return null
  const day = String(Number(match[1]))
  return `https://www.cursbnm.md/curs-valutar-${day}-${month}-${match[3]}`
}

function extractFromCursBnmHtml(html: string, code: string): string | null {
  const id = html.match(new RegExp(`valute_nume_flip\\['${code}'\\]\\s*=\\s*(\\d+)`))
  if (!id) return null
  const value = html.match(new RegExp(`valute\\[${id[1]}\\]\\s*=\\s*([0-9.]+)`))
  return normalizeRateValue(value?.[1] ?? null)
}

async function fetchRatesFromCursBnm(dateBnm: string): Promise<BnmRates | null> {
  const url = cursBnmUrl(dateBnm)
  if (!url) return null

  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
    headers: FETCH_HEADERS,
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const html = await res.text()
  const rates = {
    usd: extractFromCursBnmHtml(html, 'USD'),
    eur: extractFromCursBnmHtml(html, 'EUR'),
  }
  if (rates.usd == null && rates.eur == null) console.error(`[bnm] ${dateBnm} cursbnm page missing USD and EUR`)
  return rates
}

function rateFromMdlList(
  rates: Array<{ currency?: string; rate?: number | string }> | undefined,
  code: string,
): string | null {
  const row = rates?.find((rate) => rate.currency === code)
  if (row?.rate == null) return null
  return normalizeRateValue(String(row.rate))
}

async function fetchRatesFromMdl(dateBnm: string): Promise<BnmRates | null> {
  const iso = ddmmyyyyToIso(dateBnm)
  if (!iso) return null

  const url = `https://mdl.md/api/v1/rates?date=${encodeURIComponent(iso)}`
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
    headers: FETCH_HEADERS,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data = (await res.json()) as {
    date?: string
    rates?: Array<{ currency?: string; rate?: number | string }>
  }
  if (data.date && data.date !== iso) return null
  if (!data.rates?.length) return null

  return {
    usd: rateFromMdlList(data.rates, 'USD'),
    eur: rateFromMdlList(data.rates, 'EUR'),
  }
}

async function fetchRatesFromBnmXml(dateBnm: string): Promise<BnmRates | null> {
  const url = `https://www.bnm.md/ro/official_exchange_rates?get_xml=1&date=${encodeURIComponent(dateBnm)}`
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
      headers: FETCH_HEADERS,
    })
    if (!res.ok) {
      console.error(`[bnm] ${dateBnm} direct HTTP ${res.status}`)
      return null
    }
    const xml = await res.text()
    const rates = ratesFromXml(xml)
    if (rates.usd == null && rates.eur == null) console.error(`[bnm] ${dateBnm} direct XML missing USD and EUR`, xml.slice(0, 160))
    return rates
  } catch (err) {
    console.error(`[bnm] ${dateBnm} direct: ${errorMessage(err)}`)
    return null
  }
}
