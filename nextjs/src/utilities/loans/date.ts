export const transformDateFormat = (dateString: string): string => {
  // Expected input: YYYY-MM-DD -> output: DD.MM.YYYY (Paydown engine format)
  const [year, month, day] = dateString.split('-')
  return `${day}.${month}.${year}`
}

export const transformToNumber = (value: string | number): number => {
  if (typeof value === 'number') return value
  return value?.includes('.') ? parseFloat(value) : parseInt(value, 10)
}

