import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Alege data',
  description: 'Telegram Web App — BNM / DXY pentru data aleasă',
}

export default function DatePickerLayout({ children }: { children: React.ReactNode }) {
  return children
}
