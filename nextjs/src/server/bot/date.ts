function getLocalParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  return {
    year: Number(parts.find((p) => p.type === 'year')!.value),
    month: Number(parts.find((p) => p.type === 'month')!.value),
    day: Number(parts.find((p) => p.type === 'day')!.value),
  }
}

function formatDDMMYYYY(year: number, month: number, day: number) {
  const dd = String(day).padStart(2, '0')
  const mm = String(month).padStart(2, '0')
  return `${dd}.${mm}.${year}`
}

/**
 * Shift by calendar days in the given timezone, then format.
 * Uses Date(year, month-1, day+offset) which correctly rolls over
 * months/years and is immune to DST ±1h drift.
 */
function getShiftedDate(dayOffset: number, timeZone: string) {
  const { year, month, day } = getLocalParts(new Date(), timeZone)
  const shifted = new Date(year, month - 1, day + dayOffset)
  return formatDDMMYYYY(shifted.getFullYear(), shifted.getMonth() + 1, shifted.getDate())
}

export function shiftBnmDate(bnmDate: string, dayOffset: number): string | null {
  const m = bnmDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  const shifted = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]) + dayOffset)
  return formatDDMMYYYY(shifted.getFullYear(), shifted.getMonth() + 1, shifted.getDate())
}

export function getTodayDate(timeZone = 'Europe/Chisinau') {
  const { year, month, day } = getLocalParts(new Date(), timeZone)
  return formatDDMMYYYY(year, month, day)
}

export function getTomorrowDate(timeZone = 'Europe/Chisinau') {
  return getShiftedDate(1, timeZone)
}

export function getYesterdayDate(timeZone = 'Europe/Chisinau') {
  return getShiftedDate(-1, timeZone)
}

