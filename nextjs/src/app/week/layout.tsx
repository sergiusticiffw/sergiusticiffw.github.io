import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Week chart',
  description: 'Telegram Web App — BNM EUR & USD last 7 days',
}

export default function WeekLayout({ children }: { children: React.ReactNode }) {
  return children
}
