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

function extractUsdValueFromBnmXml(xml: string): string | null {
  const upper = xml.toUpperCase()
  const marker = '<CHARCODE>USD</CHARCODE>'
  const idx = upper.indexOf(marker)
  if (idx === -1) return null

  const after = xml.slice(idx)
  const match = after.match(/<Value>([^<]+)<\/Value>/i)
  return normalizeRateValue(match?.[1] ?? null)
}

const FETCH_HEADERS = {
  Accept: 'application/xml, application/json, text/xml;q=0.9, */*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (compatible; CurrencyBot/1.0; +https://sergiusticiffw-github-io.vercel.app)',
}

/**
 * Official BNM USD rate.
 * Vercel cannot open www.bnm.md (connect timeout from both iad1 and fra1),
 * so the primary read is the public BNM mirror at mdl.md. Direct XML is one short fallback.
 */
export async function fetchBnmUsdRateForDate(dateBnm: string): Promise<string | null> {
  try {
    const mirrored = await fetchUsdFromMdl(dateBnm)
    if (mirrored) return mirrored
  } catch (err) {
    console.error(`[bnm] ${dateBnm} mdl.md: ${errorMessage(err)}`)
  }

  return fetchUsdFromBnmXml(dateBnm)
}

async function fetchUsdFromMdl(dateBnm: string): Promise<string | null> {
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

  const usd = data.rates?.find((rate) => rate.currency === 'USD')
  if (usd?.rate == null) return null
  return normalizeRateValue(String(usd.rate))
}

async function fetchUsdFromBnmXml(dateBnm: string): Promise<string | null> {
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
    const rate = extractUsdValueFromBnmXml(xml)
    if (rate == null) console.error(`[bnm] ${dateBnm} direct XML missing USD`, xml.slice(0, 160))
    return rate
  } catch (err) {
    console.error(`[bnm] ${dateBnm} direct: ${errorMessage(err)}`)
    return null
  }
}
