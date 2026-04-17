import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pick a date',
  description: 'Telegram Web App — BNM / DXY for selected date',
}

export default function DatePickerLayout({ children }: { children: React.ReactNode }) {
  return children
}
