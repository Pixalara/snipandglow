'use client';

import Link from 'next/link';
import {
  Scissors,
  Calendar,
  Users,
  BarChart3,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  Send,
  Bell,
  FileText,
  Shield,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050810] text-white font-sans antialiased">
      {/* ===== NAVBAR ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050810]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Scissors className="h-6 w-6 text-white" />
            <span className="text-lg font-bold tracking-tight">
              Snip &amp; Glow
            </span>
            <span className="h-2 w-2 rounded-full bg-[#00D084] animate-pulse" />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-flex px-4 py-2 text-sm text-gray-300 border border-white/10 rounded-lg hover:border-white/25 hover:text-white transition-all"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-medium bg-[#00D084] text-black rounded-lg hover:bg-[#00e090] transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050810] via-[#0a0f1a] to-[#0D1117]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,208,132,0.05)_0%,_transparent_60%)]" />

        <div className="relative mx-auto max-w-7xl px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D084]/30 bg-[#00D084]/10 text-[#00D084] text-xs font-medium">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp Booking for Salons
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Your salon on
              <br />
              <span className="text-white">WhatsApp.</span>
            </h1>

            <p className="text-lg sm:text-xl text-pink-400 font-medium">
              Book appointments. Send reminders. Grow revenue.
            </p>

            <p className="text-gray-400 text-base sm:text-lg max-w-lg leading-relaxed">
              Snip &amp; Glow turns your WhatsApp number into a 24/7 booking
              assistant. Clients book, get reminders, and pay — all inside the
              app they already use every day.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#00D084] text-black font-semibold rounded-lg hover:bg-[#00e090] transition-colors"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/15 text-gray-300 rounded-lg hover:border-white/30 hover:text-white transition-all"
              >
                See How It Works
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-6 py-3 bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-lg hover:bg-pink-500/20 transition-all"
              >
                Book a Demo
              </Link>
            </div>
          </div>

          {/* Right — WhatsApp Phone Mockup */}
          <div className="hidden lg:flex justify-center">
            <div className="relative w-[300px] h-[600px] rounded-[48px] bg-black border-2 border-gray-800 shadow-2xl shadow-black/50 overflow-hidden">
              {/* Phone notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-10" />

              {/* WhatsApp screen */}
              <div className="absolute inset-3 rounded-[36px] bg-[#0b141a] overflow-hidden flex flex-col">
                {/* WA Header */}
                <div className="bg-[#1f2c34] px-4 py-3 flex items-center gap-3 pt-8">
                  <div className="h-9 w-9 rounded-full bg-[#00D084]/20 flex items-center justify-center">
                    <Scissors className="h-4 w-4 text-[#00D084]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Glamour Salon</p>
                    <p className="text-[10px] text-gray-400">online</p>
                  </div>
                </div>

                {/* Chat area */}
                <div className="flex-1 px-3 py-4 space-y-3 overflow-hidden">
                  {/* Customer message */}
                  <div className="flex justify-end">
                    <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[180px]">
                      <p className="text-[13px] text-white">Hi 👋</p>
                      <p className="text-[9px] text-gray-300 text-right mt-0.5">10:01 AM</p>
                    </div>
                  </div>

                  {/* Bot welcome */}
                  <div className="flex justify-start">
                    <div className="bg-[#1f2c34] px-3 py-2 rounded-xl rounded-tl-sm max-w-[220px]">
                      <p className="text-[13px] text-gray-100">
                        Welcome to Glamour Salon! ✨ How can I help you today?
                      </p>
                      <div className="mt-2 space-y-1.5">
                        <div className="px-3 py-1.5 border border-[#00D084]/40 rounded-lg text-center">
                          <p className="text-[11px] text-[#00D084] font-medium">📅 Book Appointment</p>
                        </div>
                        <div className="px-3 py-1.5 border border-white/20 rounded-lg text-center">
                          <p className="text-[11px] text-gray-300">💇 View Services</p>
                        </div>
                        <div className="px-3 py-1.5 border border-white/20 rounded-lg text-center">
                          <p className="text-[11px] text-gray-300">📞 Call Us</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-gray-400 mt-1.5">10:01 AM</p>
                    </div>
                  </div>

                  {/* Customer taps Book */}
                  <div className="flex justify-end">
                    <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[180px]">
                      <p className="text-[13px] text-white">📅 Book Appointment</p>
                      <p className="text-[9px] text-gray-300 text-right mt-0.5">10:02 AM</p>
                    </div>
                  </div>

                  {/* Booking confirmed card */}
                  <div className="flex justify-start">
                    <div className="bg-[#1f2c34] px-3 py-2.5 rounded-xl rounded-tl-sm max-w-[220px] border border-[#00D084]/20">
                      <p className="text-[11px] text-[#00D084] font-semibold mb-1">✅ Booking Confirmed!</p>
                      <div className="space-y-0.5 text-[11px] text-gray-300">
                        <p>💇 Haircut + Styling</p>
                        <p>📅 Tomorrow, 3:00 PM</p>
                        <p>💰 ₹499</p>
                      </div>
                      <p className="text-[9px] text-gray-400 mt-1.5">10:02 AM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST STRIP ===== */}
      <section className="relative border-y border-white/5 bg-[#0a0f1a]">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Shield, text: 'Data stays in your account' },
              { icon: CheckCircle2, text: 'Meta-verified WhatsApp' },
              { icon: Clock, text: 'Runs at 9 AM daily' },
              { icon: FileText, text: 'GST-ready invoices' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-[#00D084] shrink-0" />
                <span className="text-sm text-gray-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="relative py-24 bg-[#0D1117]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Live in 10 minutes
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Connect your WhatsApp Business number, add your services, and
              start accepting bookings — no coding required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect WhatsApp',
                desc: 'Link your WhatsApp Business number in one click. We handle the Meta verification.',
              },
              {
                step: '02',
                title: 'Add Services & Staff',
                desc: 'Set up your menu, prices, and team availability. Import from a spreadsheet or add manually.',
              },
              {
                step: '03',
                title: 'Go Live',
                desc: 'Your clients can now book, reschedule, and pay — all through WhatsApp conversations.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative p-6 rounded-2xl bg-[#0a0f1a] border border-white/5 hover:border-[#00D084]/20 transition-colors"
              >
                <span className="text-5xl font-bold text-white/5 absolute top-4 right-6">
                  {item.step}
                </span>
                <div className="relative">
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="relative py-24 bg-[#050810]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything your salon needs
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              From booking to billing, Snip &amp; Glow handles the busywork so
              you can focus on your craft.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Calendar,
                title: 'Smart Booking',
                desc: 'Clients pick a service, stylist, and time slot — all inside WhatsApp. No app downloads.',
              },
              {
                icon: Bell,
                title: 'Auto Reminders',
                desc: 'Reduce no-shows by 60% with automated WhatsApp reminders sent 24h and 1h before appointments.',
              },
              {
                icon: Users,
                title: 'Client CRM',
                desc: 'Track visit history, preferences, birthdays, and spending. Send personalized offers automatically.',
              },
              {
                icon: BarChart3,
                title: 'Revenue Analytics',
                desc: 'Real-time dashboard showing daily revenue, top services, staff performance, and growth trends.',
              },
              {
                icon: Send,
                title: 'Broadcast Campaigns',
                desc: 'Send offers, festive greetings, and re-engagement messages to segmented client lists.',
              },
              {
                icon: Zap,
                title: 'Multi-Branch',
                desc: 'Manage multiple locations from one dashboard. Compare performance across branches instantly.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl bg-[#0a0f1a] border border-white/5 hover:border-[#00D084]/20 transition-all"
              >
                <div className="h-10 w-10 rounded-lg bg-[#00D084]/10 flex items-center justify-center mb-4 group-hover:bg-[#00D084]/20 transition-colors">
                  <feature.icon className="h-5 w-5 text-[#00D084]" />
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="relative py-24 bg-[#0D1117]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Start free for 14 days. No credit card required. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Starter */}
            <div className="p-8 rounded-2xl bg-[#0a0f1a] border border-white/10">
              <h3 className="text-lg font-semibold mb-1">Starter</h3>
              <p className="text-sm text-gray-400 mb-6">For single-location salons</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">₹599</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Up to 100 bookings/month',
                  '1 WhatsApp number',
                  'Auto reminders',
                  'Basic analytics',
                  'Email support',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="h-4 w-4 text-[#00D084] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full text-center px-6 py-3 border border-white/15 text-white rounded-lg hover:border-white/30 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>

            {/* Growth */}
            <div className="relative p-8 rounded-2xl bg-[#0a0f1a] border-2 border-[#00D084]/40 shadow-lg shadow-[#00D084]/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#00D084] text-black text-xs font-semibold rounded-full">
                Most Popular
              </div>
              <h3 className="text-lg font-semibold mb-1">Growth</h3>
              <p className="text-sm text-gray-400 mb-6">For growing salons &amp; chains</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">₹999</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'Unlimited bookings',
                  'Up to 3 WhatsApp numbers',
                  'Auto reminders + follow-ups',
                  'Advanced analytics & reports',
                  'Broadcast campaigns',
                  'Multi-branch support',
                  'Priority WhatsApp support',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="h-4 w-4 text-[#00D084] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full text-center px-6 py-3 bg-[#00D084] text-black rounded-lg hover:bg-[#00e090] transition-colors font-semibold"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section className="relative py-20 bg-gradient-to-r from-pink-600 to-rose-500">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to stop losing clients?
          </h2>
          <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
            Join 500+ Indian salons already using Snip &amp; Glow to fill their
            appointment books through WhatsApp.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 border-2 border-white/40 text-white font-semibold rounded-lg hover:border-white/70 transition-colors"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#050810] border-t border-white/5 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-white" />
              <span className="font-bold">Snip &amp; Glow</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D084]" />
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400">
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/refund" className="hover:text-white transition-colors">
                Refund Policy
              </Link>
              <a href="mailto:hello@snipandglow.com" className="hover:text-white transition-colors">
                Contact
              </a>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Snip &amp; Glow. Built with ❤️ in India.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
