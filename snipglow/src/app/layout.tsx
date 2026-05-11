import type { Metadata } from 'next'
import { Inter, Syne } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  display: 'swap',
  weight: ['600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Snip & Glow — Salon Management Software',
  description:
    'WhatsApp-native salon management SaaS for Indian salons. Manage appointments, billing, customers, and staff.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${syne.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

