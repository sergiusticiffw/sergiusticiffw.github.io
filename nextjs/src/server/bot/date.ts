function formatDDMMYYYY(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return `${day}.${month}.${year}`
}

export function getTomorrowDate(timeZone = 'Europe/Chisinau') {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return formatDDMMYYYY(tomorrow, timeZone)
}

export function getTodayDate(timeZone = 'Europe/Chisinau') {
  return formatDDMMYYYY(new Date(), timeZone)
}

export function getYesterdayDate(timeZone = 'Europe/Chisinau') {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return formatDDMMYYYY(yesterday, timeZone)
}

