import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Work Register — Sintex Digital Team',
  description: 'Welspun Sintex Digital Team Work Register',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
