import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Convert',
  description: 'Telegram Web App — convert MDL / USD / EUR at BNM rate',
}

export default function ConvertLayout({ children }: { children: React.ReactNode }) {
  return children
}
