import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { GOOGLE_ADS_ID } from '@/lib/analytics/gtag'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  preload: true,
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
  weight: ['600', '700', '800'],
  preload: true,
})

export const metadata: Metadata = {
  metadataBase: new URL('https://snipandglow.com'),
  title: {
    default: 'Snip and Glow | WhatsApp Booking CRM for Salons and Spas',
    template: '%s | Snip and Glow',
  },
  description:
    'Snip and Glow helps salons, spas and beauty studios manage WhatsApp bookings, reminders, customers, staff and repeat-visit campaigns from one CRM.',
  keywords: [
    'salon management software India',
    'salon whatsapp marketing',
    'whatsapp booking for salons',
    'salon appointment reminder software',
    'beauty parlour software india',
    'salon membership program',
    'salon staff scheduling',
    'spa whatsapp marketing',
    'salon CRM India',
    'salon billing software',
    'WhatsApp salon booking',
    'spa management software',
    'salon renewal reminder software',
  ],
  authors: [{ name: 'Pixalara', url: 'https://pixalara.io' }],
  creator: 'Pixalara',
  publisher: 'Snip and Glow',
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
    siteName: 'Snip and Glow',
    title: 'Snip and Glow | WhatsApp Booking CRM for Salons and Spas',
    description:
      'Snip and Glow helps salons, spas and beauty studios manage WhatsApp bookings, reminders, customers, staff and repeat-visit campaigns from one CRM.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Snip and Glow - WhatsApp Booking CRM for Salons and Spas',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Snip and Glow | WhatsApp Booking CRM for Salons and Spas',
    description:
      'Snip and Glow helps salons, spas and beauty studios manage WhatsApp bookings, reminders, customers and staff from one CRM.',
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
      'geo.region': 'IN',
      'geo.placename': 'India',
      'content-language': 'en-IN',
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
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
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        {/* Hreflang */}
        <link rel="alternate" hrefLang="en-in" href="https://snipandglow.com" />
      </head>
      <body className="min-h-full flex flex-col" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
        <Providers>{children}</Providers>
        <SpeedInsights />

        {/* ── Google tag (gtag.js) — Google Ads ─────────────────────────────
            Declared once in the ROOT layout, so it loads on every route in the
            app (public site, auth, dashboard, admin) without duplication.
            next/script dedupes by `id`, and the root layout is a server
            component that is not re-rendered on client navigation, so the
            snippet is never injected twice.                                  */}
        <Script
          id="google-ads-gtag-src"
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-ads-gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_ADS_ID}');`}
        </Script>
      </body>
    </html>
  )
}
