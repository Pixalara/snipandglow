export function StructuredData() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SnipandGlow',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'WhatsApp-native salon management software for Indian salons. Manage appointments, billing, customers, staff, and grow your business on autopilot.',
    url: 'https://snipandglow.com',
    offers: [
      {
        '@type': 'Offer',
        name: 'Starter Plan',
        price: '799',
        priceCurrency: 'INR',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Pro Plan',
        price: '1199',
        priceCurrency: 'INR',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
      },
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '500',
      bestRating: '5',
    },
    creator: {
      '@type': 'Organization',
      name: 'Pixalara',
      url: 'https://pixalara.io',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
