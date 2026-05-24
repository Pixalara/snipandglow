import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { SpeedInsights } from '@vercel/speed-insights/next'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700', '800'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://snipandglow.com'),
  title: {
    default: '#1 India\'s Salon & Spa Software | SnipandGlow',
    template: '%s | SnipandGlow',
  },
  description:
    'SnipandGlow: India\'s #1 salon and spa management software. WhatsApp automation, appointment booking, billing, CRM & staff management. All-in-one platform to streamline operations & grow your business. Start free 15-day trial.',
  keywords: [
    'salon management software',
    'salon software India',
    'WhatsApp salon booking',
    'salon CRM',
    'salon billing software',
    'appointment scheduling',
    'beauty salon software',
    'spa management',
    'salon POS',
    'salon WhatsApp automation',
  ],
  authors: [{ name: 'Pixalara', url: 'https://pixalara.io' }],
  creator: 'Pixalara',
  publisher: 'SnipandGlow',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://snipandglow.com',
    siteName: 'SnipandGlow',
    title: '#1 India\'s Salon & Spa Software | SnipandGlow',
    description:
      'India\'s #1 salon and spa management software. WhatsApp automation, appointment booking, billing, CRM & staff management. Start free 15-day trial.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SnipandGlow — #1 India\'s Salon & Spa Software',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '#1 India\'s Salon & Spa Software | SnipandGlow',
    description:
      'India\'s #1 salon and spa management software. WhatsApp automation, appointment booking, billing & CRM.',
    images: ['/og-image.png'],
    creator: '@pixalara',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://snipandglow.com',
    languages: {
      'en-IN': 'https://snipandglow.com',
    },
  },
  verification: {
    other: {
      'msvalidate.01': 'REPLACE_WITH_BING_TOKEN',
      'facebook-domain-verification': 'REPLACE_WITH_META_BUSINESS_TOKEN',
    },
  },
  other: {
    'geo.region': 'IN',
    'geo.placename': 'India',
    'content-language': 'en-IN',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakartaSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preconnect to Supabase for faster API calls */}
        <link rel="preconnect" href="https://ndnigqeucfdeimlwevsr.supabase.co" />
        {/* DNS Prefetch for third-party services */}
        <link rel="dns-prefetch" href="https://connect.facebook.net" />
        <link rel="dns-prefetch" href="https://api.web3forms.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        {/* Hreflang */}
        <link rel="alternate" hrefLang="en-in" href="https://snipandglow.com" />
      </head>
      <body className="min-h-full flex flex-col" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  )
}
