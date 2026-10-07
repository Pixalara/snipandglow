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
      'https://www.instagram.com/pixalara/',
      'https://x.com/pixalara',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-9459086057',
      contactType: 'sales',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi'],
    },
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Snip and Glow',
    alternateName: 'SnipandGlow Salon Software',
    url: 'https://snipandglow.com',
  };

  // FAQPage mirrors the FAQ section visible on the homepage, so Google and AI
  // answer engines (Gemini, AI Overviews) can quote clean Q&A about the product.
  const faqs: { q: string; a: string }[] = [
    {
      q: 'What is the best salon software in India?',
      a: 'SnipandGlow is an affordable, all-in-one salon and spa management platform built specifically for Indian businesses. It handles WhatsApp bookings, automatic reminders, GST billing, customer CRM, staff scheduling, payroll, memberships, inventory and marketing broadcasts from one dashboard, with plans starting at just ₹799/mo billed yearly and a 15-day free trial.',
    },
    {
      q: 'How is SnipandGlow different from other salon software?',
      a: 'Most salon software is built for Western markets and costs ₹3,000–5,000/mo. SnipandGlow is purpose-built for Indian salons - WhatsApp-first, GST billing, UPI tracking, and honest pricing. Essentials starts at just ₹799/mo (billed yearly) and covers everything a single salon needs. Pro adds your own WhatsApp API and broadcast marketing, while Growth adds multi-branch for expanding chains.',
    },
    {
      q: 'What is SnipandGlow?',
      a: 'SnipandGlow is an all-in-one salon and spa management platform built for Indian businesses. It handles appointments, WhatsApp automation, billing, customer CRM, staff scheduling, payroll, memberships, analytics, and more - all from one dashboard. Plans: Essentials (₹999/mo or ₹799/mo billed yearly), Pro (₹1,999/mo or ₹1,399/mo billed yearly), and Growth (₹2,999/mo or ₹1,799/mo billed yearly, multi-branch).',
    },
    {
      q: 'How much does salon software cost in India?',
      a: 'SnipandGlow offers three plans, each with a monthly or discounted yearly option: Essentials (₹999/mo, or ₹799/mo billed yearly), Pro (₹1,999/mo, or ₹1,399/mo billed yearly) which adds your own WhatsApp Business API and marketing broadcasts, and Growth (₹2,999/mo, or ₹1,799/mo billed yearly) which adds multi-branch management. Every plan includes a 15-day free trial with no card required.',
    },
    {
      q: 'How long is the free trial?',
      a: 'You get a full 15-day free trial with access to all features - no credit card required, and no payment is taken during the trial. After the trial, when you make your first payment, you get a 7-day grace period for a full refund, no questions asked. This applies to both monthly and yearly plans.',
    },
    {
      q: 'How does WhatsApp booking work for salons on SnipandGlow?',
      a: 'Booking confirmations, appointment reminders, bills, and feedback requests are sent automatically on WhatsApp. On Essentials they go from the shared SnipandGlow number with zero setup; on Pro and Growth you connect your own WhatsApp Business number so every message carries your salon brand, and you unlock marketing broadcasts (birthday offers, festival deals, win-back messages) to all customers at once.',
    },
    {
      q: 'Do my customers need to download any app to book?',
      a: 'No. Your customers book through WhatsApp or a simple booking link - no app download, no account creation, nothing to install. They use the same WhatsApp they already have on their phone, which is why booking rates are so high.',
    },
    {
      q: 'Can I manage multiple branches?',
      a: 'Yes. Multi-branch management is included in the Growth plan. You can manage all locations from a single dashboard with branch-level reporting, independent staff management, and consolidated analytics across branches.',
    },
    {
      q: 'Do I need any technical knowledge to use SnipandGlow?',
      a: 'None. SnipandGlow is built for salon owners, not developers. We handle the full setup - services, staff, WhatsApp flow, booking link, and data import. The dashboard is as intuitive as using WhatsApp itself.',
    },
    {
      q: 'Is my salon and customer data safe?',
      a: 'Yes. All data is encrypted at rest and in transit, hosted on secure cloud servers, and each salon\u2019s data is completely isolated. We never share or sell customer data. Access tokens for connected WhatsApp numbers are stored with AES-256 encryption.',
    },
    {
      q: 'Can I cancel anytime?',
      a: 'Yes, no lock-in contracts. Cancel anytime from the dashboard. No payment is taken during your free trial, and after your first payment you have a 7-day grace period for a full refund, no questions asked - on both monthly and yearly plans.',
    },
    {
      q: 'How soon will I see results?',
      a: 'Most salons notice fewer no-shows within the first 2 weeks, simply because reminders go out automatically before every appointment. Marketing broadcasts and win-back campaigns (Pro/Growth) often pay for the plan within the first month.',
    },
  ];

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
    </>
  );
}
