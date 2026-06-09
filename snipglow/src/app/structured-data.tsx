export function StructuredData() {
  const softwareApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Snip and Glow',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'WhatsApp booking, reminder automation and CRM platform for salons, spas and beauty studios in India.',
    url: 'https://snipandglow.com',
    offers: [
      {
        '@type': 'Offer',
        name: 'Essentials Plan',
        description: 'Complete salon management with WhatsApp automation for single-location salons.',
        price: '799',
        priceCurrency: 'INR',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
        url: 'https://snipandglow.com/#pricing',
      },
      {
        '@type': 'Offer',
        name: 'Pro Plan',
        description: 'Own WhatsApp Business API, marketing broadcasts and priority support for single-branch salons.',
        price: '999',
        priceCurrency: 'INR',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
        url: 'https://snipandglow.com/#pricing',
      },
      {
        '@type': 'Offer',
        name: 'Growth Plan',
        description: 'Multi-branch management, own WhatsApp Business API, and marketing broadcasts for scaling salon brands.',
        price: '1499',
        priceCurrency: 'INR',
        priceValidUntil: '2027-12-31',
        availability: 'https://schema.org/InStock',
        url: 'https://snipandglow.com/#pricing',
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
  };

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Snip and Glow by Pixalara',
    url: 'https://snipandglow.com',
    logo: 'https://snipandglow.com/og-image.png',
    description:
      'WhatsApp booking, reminder automation and CRM platform for salons, spas and beauty studios.',
    sameAs: [
      'https://www.linkedin.com/company/pixalara/',
      'https://www.instagram.com/snipandglowapp/',
      'https://x.com/pixalara',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-9449602995',
      contactType: 'sales',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi'],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
    </>
  );
}
