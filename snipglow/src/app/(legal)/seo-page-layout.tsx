import Link from 'next/link';

const SEO_LINKS = [
  { href: '/salon-whatsapp-marketing', label: 'WhatsApp Marketing for Salons' },
  { href: '/spa-whatsapp-marketing', label: 'WhatsApp Marketing for Spas' },
  { href: '/salon-staff-scheduling', label: 'Salon Staff Scheduling' },
  { href: '/salon-membership-program', label: 'Salon Membership Program' },
  { href: '/beauty-parlour-software-india', label: 'Beauty Parlour Software India' },
  { href: '/best-salon-software-india', label: 'Best Salon Software India' },
  { href: '/salon-software-pricing-india', label: 'Salon Software Pricing India' },
  { href: '/whatsapp-appointment-booking-for-salons', label: 'WhatsApp Appointment Booking' },
  { href: '/salon-crm-software-india', label: 'Salon CRM Software India' },
  { href: '/salon-reminder-software', label: 'Salon Reminder Software' },
];

export function SeoPageLayout({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  currentPath?: string;
}) {
  const relatedLinks = SEO_LINKS.filter((l) => l.href !== currentPath);

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-100">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight">
              <span className="text-slate-900">snipand</span>
              <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">glow</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/signup"
              className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-white rounded-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 transition-all"
            >
              Start Free Trial
            </Link>
            <Link
              href="/"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-14">
        {children}

        {/* Internal links - Related resources */}
        <aside className="mt-14 pt-10 border-t border-slate-100">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Related Resources
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {relatedLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  {link.label} →
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 mt-4">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} Snip and Glow by Pixalara. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-slate-400">
              <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms</Link>
              <Link href="/blog" className="hover:text-slate-700 transition-colors">Blog</Link>
            </div>
          </div>
          {/* SEO footer links */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400 pt-4 border-t border-slate-50">
            {SEO_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-slate-600 transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
