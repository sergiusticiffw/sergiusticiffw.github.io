function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDxy(num: unknown): string | null {
  if (num === undefined || num === null) return null
  const n = Number(num)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n * 100) / 100
  return rounded.toFixed(2).replace(/\.?0+$/, '')
}

function extractFromQuoteResponse(parsed: any): string | null {
  const result = parsed?.quoteResponse?.result?.[0]
  const valueObj = result?.regularMarketPrice
  if (valueObj == null) return null
  if (typeof valueObj === 'object') return formatDxy(valueObj.raw ?? valueObj.fmt ?? valueObj.value)
  return formatDxy(valueObj)
}

function extractFromChartResponse(parsed: any): string | null {
  const closeArr = parsed?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? null
  if (!Array.isArray(closeArr) || closeArr.length === 0) return null
  return formatDxy(closeArr[closeArr.length - 1])
}

function parseDDMMYYYY(dateStr: string): { dd: number; mm: number; yyyy: number } | null {
  const m = dateStr.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  return { dd, mm, yyyy }
}

async function fetchFromYahooQuote(symbol = 'DX-Y.NYB', { retries = 3 } = {}): Promise<string> {
  const url = 'https://query1.finance.yahoo.com/v7/finance/quote'
  const params = new URLSearchParams({ symbols: symbol })

  let lastError: unknown = null
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(`${url}?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Yahoo quote HTTP ${res.status}`)
      const data = await res.json()
      const value = extractFromQuoteResponse(data)
      if (value !== null) return value
      throw new Error('Yahoo quote response missing DXY value')
    } catch (err) {
      lastError = err
      if (attempt < retries) await sleep(500 * attempt)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Yahoo quote failed')
}

async function fetchFromYahooChart(symbol = 'DX-Y.NYB', { retries = 2 } = {}): Promise<string> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  const params = new URLSearchParams({ range: '1d', interval: '1d' })

  let lastError: unknown = null
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(`${url}?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Yahoo chart HTTP ${res.status}`)
      const data = await res.json()
      const value = extractFromChartResponse(data)
      if (value !== null) return value
      throw new Error('Yahoo chart response missing DXY value')
    } catch (err) {
      lastError = err
      if (attempt < retries) await sleep(500 * attempt)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Yahoo chart failed')
}

export async function fetchDxyForDate(dateDDMMYYYY: string, { symbol = 'DX-Y.NYB' } = {}): Promise<string | null> {
  const parsed = parseDDMMYYYY(dateDDMMYYYY)
  if (!parsed) return null

  const { dd, mm, yyyy } = parsed
  const start = Math.floor(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0) / 1000)
  const end = start + 3 * 24 * 60 * 60

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  const params = new URLSearchParams({ period1: String(start), period2: String(end), interval: '1d' })

  try {
    const res = await fetch(`${url}?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const closeArr = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? null
    if (!Array.isArray(closeArr) || closeArr.length === 0) return null
    for (let i = closeArr.length - 1; i >= 0; i -= 1) {
      const v = formatDxy(closeArr[i])
      if (v !== null) return v
    }
    return null
  } catch {
    return null
  }
}

export async function fetchDxyValue({ symbol = 'DX-Y.NYB' } = {}): Promise<string | null> {
  try {
    return await fetchFromYahooQuote(symbol)
  } catch {
    try {
      return await fetchFromYahooChart(symbol)
    } catch {
      return null
    }
  }
}

