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

module.exports = { fetchDxyValue };

