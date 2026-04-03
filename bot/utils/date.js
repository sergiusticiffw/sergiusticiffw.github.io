/**
 * Date helpers that respect a specific IANA timezone.
 */

'use strict';

function formatDDMMYYYY(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${day}.${month}.${year}`;
}

function getTomorrowDate(timeZone = 'Europe/Chisinau') {
  // Returns BNM API date format (DD.MM.YYYY) for "tomorrow" in the provided timezone.
  // Uses a simple "now + 24h" approach, then converts via `Intl` formatting.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return formatDDMMYYYY(tomorrow, timeZone);
}

function getTodayDate(timeZone = 'Europe/Chisinau') {
  const today = new Date();
  return formatDDMMYYYY(today, timeZone);
}

module.exports = { getTomorrowDate, getTodayDate };

