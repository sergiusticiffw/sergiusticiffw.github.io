'use strict';

const axios = require('axios');
const { parseStringPromise } = require('xml2js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRateValue(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).replace(/\s/g, '');
  const num = Number(str.replace(',', '.'));
  if (!Number.isFinite(num)) return null;

  const rounded = Math.round(num * 10000) / 10000;
  return rounded.toFixed(4).replace(/\.?0+$/, '');
}

function findUsdValueDeep(node) {
  let found = null;

  function traverse(current) {
    // Walk the parsed XML tree and extract the USD "Value" entry.
    if (found !== null) return;
    if (!current) return;

    if (Array.isArray(current)) {
      for (const item of current) traverse(item);
      return;
    }

    if (typeof current !== 'object') return;

    const charCodeRaw = current.CharCode ?? current.CharCode?.value ?? current.CharCode?._ ?? current.charCode;
    const charCode = typeof charCodeRaw === 'string' ? charCodeRaw : charCodeRaw?._;

    if (typeof charCode === 'string' && charCode.toUpperCase() === 'USD') {
      const rawValue = current.Value ?? current.value ?? current.VAL ?? current.Rate ?? null;
      const normalized = normalizeRateValue(rawValue);
      if (normalized !== null) {
        found = normalized;
        return;
      }
    }

    for (const key of Object.keys(current)) {
      traverse(current[key]);
      if (found !== null) return;
    }
  }

  traverse(node);
  return found;
}

async function fetchBnmUsdRateForDate(dateBnm, { retries = 3 } = {}) {
  // BNM expects `date` in DD.MM.YYYY format (example: 03.04.2026).
  const url = `https://www.bnm.md/ro/official_exchange_rates?get_xml=1&date=${encodeURIComponent(
    dateBnm
  )}`;

  console.log(`[BNM] GET ${url}`);

  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const { data } = await axios.get(url, { responseType: 'text', timeout: 20000 });
      const parsed = await parseStringPromise(data, { explicitArray: false });

      const usdValue = findUsdValueDeep(parsed);
      if (usdValue === null) {
        console.warn(`[BNM] USD value not found for date ${dateBnm}.`);
      } else {
        console.log(`[BNM] USD rate for ${dateBnm}: ${usdValue}`);
      }

      return usdValue; // null => Not available yet
    } catch (err) {
      lastError = err;
      console.error(`[BNM] Attempt ${attempt}/${retries} failed:`, err?.message ?? err);
      if (attempt < retries) await sleep(500 * attempt);
    }
  }

  console.error('[BNM] All attempts failed:', lastError?.message ?? lastError);
  return null;
}

module.exports = { fetchBnmUsdRateForDate };
