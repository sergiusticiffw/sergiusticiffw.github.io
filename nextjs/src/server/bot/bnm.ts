function normalizeRateValue(value: string | null): string | null {
  if (value == null) return null
  const str = String(value).replace(/\s/g, '')
  const num = Number(str.replace(',', '.'))
  if (!Number.isFinite(num)) return null
  const rounded = Math.round(num * 10000) / 10000
  return rounded.toFixed(4).replace(/\.?0+$/, '')
}

function extractUsdValueFromBnmXml(xml: string): string | null {
  // Best-effort: find USD's <Value> in the XML.
  const upper = xml.toUpperCase()
  const marker = '<CHARCODE>USD</CHARCODE>'
  const idx = upper.indexOf(marker)
  if (idx === -1) return null

  const after = xml.slice(idx)
  const m = after.match(/<Value>([^<]+)<\/Value>/i)
  return normalizeRateValue(m?.[1] ?? null)
}

export async function fetchBnmUsdRateForDate(dateBnm: string): Promise<string | null> {
  const url = `https://www.bnm.md/ro/official_exchange_rates?get_xml=1&date=${encodeURIComponent(dateBnm)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const xml = await res.text()
  return extractUsdValueFromBnmXml(xml)
}

