function normalizeRateValue(value: string | null): string | null {
  if (value == null) return null
  const str = String(value).replace(/\s/g, '')
  const num = Number(str.replace(',', '.'))
  if (!Number.isFinite(num)) return null
  const rounded = Math.round(num * 10000) / 10000
  return rounded.toFixed(4).replace(/\.?0+$/, '')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
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
  const attempts = 3
  let lastDetail = 'unknown error'

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
        headers: {
          Accept: 'application/xml, text/xml;q=0.9, */*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; CurrencyBot/1.0; +https://sergiusticiffw-github-io.vercel.app)',
        },
      })
      if (!res.ok) {
        lastDetail = `HTTP ${res.status}`
        console.error(`[bnm] ${dateBnm} attempt ${attempt}/${attempts}: ${lastDetail}`)
      } else {
        const xml = await res.text()
        const rate = extractUsdValueFromBnmXml(xml)
        if (rate != null) return rate
        lastDetail = 'XML missing USD value'
        console.error(`[bnm] ${dateBnm} attempt ${attempt}/${attempts}: ${lastDetail}`, xml.slice(0, 160))
      }
    } catch (err) {
      lastDetail = errorMessage(err)
      console.error(`[bnm] ${dateBnm} attempt ${attempt}/${attempts}: ${lastDetail}`)
    }

    if (attempt < attempts) await sleep(300 * attempt)
  }

  console.error(`[bnm] ${dateBnm} unavailable after ${attempts} attempts: ${lastDetail}`)
  return null
}

