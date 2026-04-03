'use strict';

const axios = require('axios');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDxy(num) {
  if (num === undefined || num === null) return null;
  const n = Number(num);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

function extractFromQuoteResponse(parsed) {
  const result = parsed?.quoteResponse?.result?.[0];
  const valueObj = result?.regularMarketPrice;
  if (valueObj == null) return null;
  if (typeof valueObj === 'object') return formatDxy(valueObj.raw ?? valueObj.fmt ?? valueObj.value);
  return formatDxy(valueObj);
}

function extractFromChartResponse(parsed) {
  const closeArr = parsed?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? null;
  if (!Array.isArray(closeArr) || closeArr.length === 0) return null;
  return formatDxy(closeArr[closeArr.length - 1]);
}

function parseDDMMYYYY(dateStr) {
  if (typeof dateStr !== 'string') return null;
  const m = dateStr.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return { dd, mm, yyyy };
}

async function fetchFromYahooQuote(symbol = 'DX-Y.NYB', { retries = 3 } = {}) {
  const url = 'https://query1.finance.yahoo.com/v7/finance/quote';
  const params = { symbols: symbol };

  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const { data } = await axios.get(url, { params, timeout: 20000 });
      // Expected JSON shape: { quoteResponse: { result: [ { regularMarketPrice: { raw } } ] } }
      const value = extractFromQuoteResponse(data);
      if (value !== null) return value;
      throw new Error('Yahoo quote response missing DXY value');
    } catch (err) {
      lastError = err;
      console.error(`[DXY] Quote attempt ${attempt}/${retries} failed:`, err?.message ?? err);
      if (attempt < retries) await sleep(500 * attempt);
    }
  }
  throw lastError;
}

async function fetchFromYahooChart(symbol = 'DX-Y.NYB', { retries = 2 } = {}) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const params = { range: '1d', interval: '1d' };

  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const { data } = await axios.get(url, { params, timeout: 20000 });
      const value = extractFromChartResponse(data);
      if (value !== null) return value;
      throw new Error('Yahoo chart response missing DXY value');
    } catch (err) {
      lastError = err;
      console.error(`[DXY] Chart attempt ${attempt}/${retries} failed:`, err?.message ?? err);
      if (attempt < retries) await sleep(500 * attempt);
    }
  }
  throw lastError;
}

async function fetchDxyForDate(dateDDMMYYYY, { symbol = 'DX-Y.NYB' } = {}) {
  // Best-effort historical fetch using Yahoo chart endpoint (daily interval).
  // Yahoo often requires auth for quote endpoint, so we use chart.
  const parsed = parseDDMMYYYY(dateDDMMYYYY);
  if (!parsed) return null;

  const { dd, mm, yyyy } = parsed;

  // Use UTC day boundaries (best-effort). DXY trades in US markets, so this may not
  // perfectly align with NY close, but it is good enough for a simple bot.
  const start = Math.floor(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0) / 1000);
  const end = start + 3 * 24 * 60 * 60; // include buffer days

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  try {
    const { data } = await axios.get(url, {
      params: { period1: start, period2: end, interval: '1d' },
      timeout: 20000,
    });

    const closeArr = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? null;
    if (!Array.isArray(closeArr) || closeArr.length === 0) return null;

    // Pick the last non-null close in the returned window.
    for (let i = closeArr.length - 1; i >= 0; i -= 1) {
      const v = formatDxy(closeArr[i]);
      if (v !== null) return v;
    }

    return null;
  } catch (err) {
    console.error('[DXY] Historical chart fetch failed:', err?.message ?? err);
    return null;
  }
}

async function fetchDxyValue({ symbol = 'DX-Y.NYB' } = {}) {
  try {
    const value = await fetchFromYahooQuote(symbol);
    console.log(`[DXY] DXY fetched (quote) for ${symbol}: ${value}`);
    return value;
  } catch (err) {
    console.error('[DXY] Quote endpoint failed, trying fallback chart endpoint:', err?.message ?? err);
  }

  try {
    const value = await fetchFromYahooChart(symbol);
    console.log(`[DXY] DXY fetched (chart) for ${symbol}: ${value}`);
    return value;
  } catch (err) {
    console.error('[DXY] Fallback chart endpoint failed:', err?.message ?? err);
    return null;
  }
}

module.exports = { fetchDxyValue, fetchDxyForDate };

