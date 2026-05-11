'use client';

import Link from 'next/link';
import {
  Scissors,
  MessageCircle,
  ArrowRight,
  Bell,
  FileText,
  Shield,
  Clock,
  Zap,
  Users,
  BarChart3,
  CheckCircle2,
  Star,
  TrendingUp,
  Calendar,
  MapPin,
  Repeat2,
  Gift,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050810] text-white font-sans antialiased">

      {/* ===== NAVBAR ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050810]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-[#00D084]" />
            <span className="text-lg font-bold tracking-tight text-white">Snip &amp; Glow</span>
            <span className="h-2 w-2 rounded-full bg-[#00D084] animate-pulse" />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
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
              className="px-4 py-2 text-sm font-semibold bg-[#00D084] text-black rounded-lg hover:bg-[#00e090] transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16">
        <div className="absolute inset-0 bg-gradient-to-br from-[#050810] via-[#080d18] to-[#0a0f1a]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,208,132,0.06),transparent)]" />
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#00D084]/3 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-indigo-500/3 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-16 items-center w-full">
          {/* Left */}
          <div className="space-y-8">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D084]/30 bg-[#00D084]/8 text-[#00D084] text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D084] animate-pulse" />
              Trusted by 500+ Indian Salon Owners
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight">
                The Salon Management
                <br />
                <span className="text-[#00D084]">Software That Brings</span>
                <br />
                Clients Back
              </h1>
              <p className="text-xl text-gray-300 font-medium">
                Appointments. WhatsApp Reminders. Billing. All on Autopilot.
              </p>
              <p className="text-gray-400 text-base max-w-lg leading-relaxed">
                Set it up once. Every client gets booked, reminded, billed, and brought back automatically.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 py-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#00D084]/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-[#00D084]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">500+ Salons</p>
                  <p className="text-xs text-gray-500">Active users</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#00D084]/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-[#00D084]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">5,00,000+</p>
                  <p className="text-xs text-gray-500">Appointments</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#00D084]/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-[#00D084]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">15-Day Free</p>
                  <p className="text-xs text-gray-500">Trial, no card</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#00D084] text-black font-semibold rounded-xl hover:bg-[#00e090] transition-colors text-sm"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/15 text-gray-300 rounded-xl hover:border-white/30 hover:text-white transition-all text-sm"
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Right — WhatsApp Phone Mockup */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative">
              {/* Ambient glow */}
              <div className="absolute inset-0 rounded-[48px] bg-[#00D084]/8 blur-3xl scale-125" />

              {/* Phone shell */}
              <div className="relative w-[300px] rounded-[48px] bg-black border border-gray-800 shadow-2xl overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-20" />

                {/* Screen */}
                <div className="bg-[#0b141a] flex flex-col pt-6">
                  {/* WA Header */}
                  <div className="bg-[#1f2c34] px-4 pt-6 pb-3 flex items-center gap-3 border-b border-white/5">
                    <div className="h-9 w-9 rounded-full bg-[#1a5c2a] flex items-center justify-center text-xs font-bold text-white shrink-0">GS</div>
                    <div>
                      <p className="text-sm font-semibold text-white">Glamour Salon</p>
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00D084]" />
                        <p className="text-[10px] text-gray-400">online</p>
                      </div>
                    </div>
                  </div>

                  {/* Chat messages */}
                  <div className="px-3 py-4 space-y-3 bg-[#0b141a]">
                    {/* Incoming: booking confirmed */}
                    <div className="flex justify-start">
                      <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[230px] border border-[#00D084]/20">
                        <div className="bg-[#00D084]/15 px-3 py-2 border-b border-[#00D084]/20">
                          <p className="text-[12px] font-bold text-[#00D084]">✅ Booking Confirmed!</p>
                        </div>
                        <div className="px-3 py-2.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-300">
                            <Users className="h-3 w-3 text-gray-500 shrink-0" />
                            <span>Priya</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-300">
                            <Scissors className="h-3 w-3 text-gray-500 shrink-0" />
                            <span>Haircut</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-300">
                            <Calendar className="h-3 w-3 text-gray-500 shrink-0" />
                            <span>10 May 2026, 2:30 PM</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-300">
                            <MapPin className="h-3 w-3 text-gray-500 shrink-0" />
                            <span>Glamour Salon</span>
                          </div>
                        </div>
                        <div className="border-t border-white/5">
                          <div className="px-3 py-2 border-b border-white/5 text-center">
                            <p className="text-[11px] text-[#53bdeb] font-medium">Reschedule</p>
                          </div>
                          <div className="px-3 py-2 text-center">
                            <p className="text-[11px] text-[#53bdeb] font-medium">Cancel</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-gray-500 text-right px-3 pb-2">10:02 AM ✓✓</p>
                      </div>
                    </div>

                    {/* Outgoing reply */}
                    <div className="flex justify-end">
                      <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[160px]">
                        <p className="text-[12px] text-white">Thanks! See you then 😊</p>
                        <p className="text-[9px] text-gray-300 text-right mt-0.5">10:03 AM ✓✓</p>
                      </div>
                    </div>

                    {/* Incoming: 24h reminder */}
                    <div className="flex justify-start">
                      <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[230px] border border-blue-500/20">
                        <div className="bg-blue-500/10 px-3 py-2 border-b border-blue-500/20">
                          <p className="text-[11px] font-bold text-blue-400">📅 Reminder — Tomorrow</p>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] text-gray-300">Hi <span className="text-white font-medium">Priya</span>! Your Haircut is tomorrow at 2:30 PM. See you! 💇‍♀️</p>
                        </div>
                        <p className="text-[9px] text-gray-500 text-right px-3 pb-2">9 May, 2:30 PM</p>
                      </div>
                    </div>
                  </div>

                  {/* Input bar */}
                  <div className="bg-[#1f2c34] px-3 py-2.5 flex items-center gap-2 border-t border-white/5">
                    <div className="flex-1 bg-[#2a3942] rounded-full h-8 flex items-center px-3">
                      <p className="text-[11px] text-gray-500">Type a message</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-[#00D084] flex items-center justify-center shrink-0">
                      <ArrowRight className="h-3.5 w-3.5 text-black" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-6 bg-[#0f1923] border border-white/10 rounded-2xl px-4 py-3 shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#00D084]/15 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-[#00D084]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">No-shows down 70%</p>
                    <p className="text-[10px] text-gray-500">Auto reminders working</p>
                  </div>
                </div>
              </div>

              <div className="absolute -top-4 -right-6 bg-[#0f1923] border border-white/10 rounded-2xl px-4 py-3 shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">+28% retention</p>
                    <p className="text-[10px] text-gray-500">This month</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== AUTOMATED CLIENT JOURNEY ===== */}
      <section id="how-it-works" className="relative py-28 bg-[#050810]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(0,208,132,0.03),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-6">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D084]/30 bg-[#00D084]/8 text-[#00D084] text-xs font-medium mb-6">
              <Zap className="h-3.5 w-3.5" />
              Set it once. Runs forever.
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              Fully Automated Client Journey
            </h2>
            <p className="text-lg text-[#00D084] font-medium mb-3">
              Automated WhatsApp Messages That Bring Clients Back
            </p>
            <p className="text-gray-400 text-base leading-relaxed">
              From the moment a client books to the day they return — every message is sent automatically. You set it up once.
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#00D084]/40 via-[#00D084]/20 to-transparent hidden lg:block" />

            <div className="space-y-12 lg:space-y-0">

              {/* Node 1 — Day 0 */}
              <div className="relative lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center lg:mb-16">
                <div className="lg:text-right space-y-3 pb-8 lg:pb-0">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00D084]/10 border border-[#00D084]/20 text-[#00D084] text-xs font-bold">
                    Day 0 — Online Booking
                  </div>
                  <h3 className="text-xl font-bold text-white">Client Books Online. Instantly.</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    From WhatsApp, Instagram, or Google — even at 2am. Your calendar fills while you sleep.
                  </p>
                  <div className="inline-flex items-start gap-2 bg-[#0f1923] border border-[#00D084]/20 rounded-xl px-4 py-3 text-left lg:text-right">
                    <MessageCircle className="h-4 w-4 text-[#00D084] shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-300">WhatsApp Confirmation sent instantly with date, time, and stylist name.</p>
                  </div>
                </div>
                {/* Center dot */}
                <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-[#00D084] items-center justify-center shadow-lg shadow-[#00D084]/30 z-10">
                  <CheckCircle2 className="h-5 w-5 text-black" />
                </div>
                <div className="lg:pl-8" />
              </div>

              {/* Node 2 — 24hrs Before */}
              <div className="relative lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center lg:mb-16">
                <div className="hidden lg:block" />
                {/* Center dot */}
                <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-blue-500 items-center justify-center shadow-lg shadow-blue-500/30 z-10">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div className="space-y-3 pb-8 lg:pb-0 lg:pl-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
                    24hrs Before — Auto Reminder
                  </div>
                  <h3 className="text-xl font-bold text-white">Smart Reminder — No-Shows Drop 70%</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Automatic WhatsApp reminder sent 24 hours before the appointment.
                  </p>
                  <div className="inline-flex items-start gap-2 bg-[#0f1923] border border-blue-500/20 rounded-xl px-4 py-3">
                    <Clock className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-300">2h before: Same-day nudge sent automatically.</p>
                  </div>
                </div>
              </div>

              {/* Node 3 — After Service */}
              <div className="relative lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center lg:mb-16">
                <div className="lg:text-right space-y-3 pb-8 lg:pb-0">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold">
                    After Service — Auto Invoice
                  </div>
                  <h3 className="text-xl font-bold text-white">GST Invoice on WhatsApp</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Professional GST invoice sent automatically the moment payment is done.
                  </p>
                  <div className="inline-flex items-start gap-2 bg-[#0f1923] border border-violet-500/20 rounded-xl px-4 py-3 text-left lg:text-right">
                    <FileText className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-300">Post-Care Tips: &quot;Here&apos;s how to maintain your hair color&quot; — builds trust.</p>
                  </div>
                </div>
                <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-violet-500 items-center justify-center shadow-lg shadow-violet-500/30 z-10">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div className="lg:pl-8" />
              </div>

              {/* Node 5 — Day 30 */}
              <div className="relative lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center lg:mb-16">
                <div className="lg:text-right space-y-3 pb-8 lg:pb-0">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                    Day 30 — Service Reminder
                  </div>
                  <h3 className="text-xl font-bold text-white">Service Reminder Brings Them Back</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    &quot;Hi Priya, time for your next hair color!&quot; — sent automatically when due.
                  </p>
                  <div className="inline-flex items-start gap-2 bg-[#0f1923] border border-emerald-500/20 rounded-xl px-4 py-3 text-left lg:text-right">
                    <Repeat2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-300">Personalized by service type. Hair color every 30 days. Facial every 21 days.</p>
                  </div>
                </div>
                <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-emerald-500 items-center justify-center shadow-lg shadow-emerald-500/30 z-10">
                  <Repeat2 className="h-5 w-5 text-white" />
                </div>
                <div className="lg:pl-8" />
              </div>

              {/* Node 6 — Day 60 */}
              <div className="relative lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
                <div className="hidden lg:block" />
                <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-pink-500 items-center justify-center shadow-lg shadow-pink-500/30 z-10">
                  <Gift className="h-5 w-5 text-white" />
                </div>
                <div className="space-y-3 lg:pl-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-bold">
                    Day 60 — Win-Back
                  </div>
                  <h3 className="text-xl font-bold text-white">Win-Back Message for Inactive Clients</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    &quot;We miss you! 15% off your next visit&quot; — re-engages clients before they&apos;re lost.
                  </p>
                  <div className="inline-flex items-start gap-2 bg-[#0f1923] border border-pink-500/20 rounded-xl px-4 py-3">
                    <Gift className="h-4 w-4 text-pink-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-300">Automated discount codes. Clients feel valued. Revenue comes back.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Closing statement */}
          <div className="mt-20 text-center max-w-2xl mx-auto">
            <div className="bg-[#0a0f1a] border border-[#00D084]/20 rounded-2xl px-8 py-8">
              <p className="text-lg font-semibold text-white mb-2">
                This entire journey runs automatically.
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                You set it up once. No extra staff. No manual follow-ups. No spreadsheets.
              </p>
              <div className="flex flex-wrap justify-center gap-4 mt-6">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle2 className="h-4 w-4 text-[#00D084]" />
                  Zero manual work
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle2 className="h-4 w-4 text-[#00D084]" />
                  Works 24/7
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle2 className="h-4 w-4 text-[#00D084]" />
                  Fully customizable
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== REAL NUMBERS / ROI ===== */}
      <section className="relative py-28 bg-[#080d18]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(0,208,132,0.04),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/8 text-emerald-400 text-xs font-medium mb-6">
              <TrendingUp className="h-3.5 w-3.5" />
              Real ROI, Real Numbers
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">The Real Numbers — Salon Client Retention</h2>
            <p className="text-gray-400">You spend ₹699/month. Here&apos;s what you get back.</p>
          </div>

          {/* Stats grid */}
          <div className="grid sm:grid-cols-3 gap-6 mb-10">
            <div className="bg-[#0a0f1a] border border-white/8 rounded-2xl p-8 text-center group hover:border-[#00D084]/30 transition-colors">
              <div className="text-4xl font-bold text-[#00D084] mb-2">+28%</div>
              <div className="text-white font-semibold mb-1">Client Return Rate</div>
              <div className="text-gray-500 text-sm">More clients come back after automated follow-ups</div>
            </div>
            <div className="bg-[#0a0f1a] border border-white/8 rounded-2xl p-8 text-center group hover:border-[#00D084]/30 transition-colors">
              <div className="text-4xl font-bold text-[#00D084] mb-2">₹3.84L</div>
              <div className="text-white font-semibold mb-1">Annual Extra Revenue</div>
              <div className="text-gray-500 text-sm">Average additional revenue per salon per year</div>
            </div>
            <div className="bg-[#0a0f1a] border border-white/8 rounded-2xl p-8 text-center group hover:border-[#00D084]/30 transition-colors">
              <div className="text-4xl font-bold text-[#00D084] mb-2">19x</div>
              <div className="text-white font-semibold mb-1">Return on Investment</div>
              <div className="text-gray-500 text-sm">Every ₹1 spent returns ₹19 in revenue</div>
            </div>
          </div>

          {/* Math breakdown card */}
          <div className="max-w-2xl mx-auto bg-[#0a0f1a] border border-[#00D084]/20 rounded-2xl overflow-hidden">
            <div className="bg-[#00D084]/8 border-b border-[#00D084]/20 px-6 py-4">
              <p className="text-sm font-semibold text-[#00D084]">Simple Math Breakdown</p>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <span className="text-red-400 text-xs font-bold">-</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Snip &amp; Glow All-in-One Plan</p>
                    <p className="text-xs text-gray-500">₹699/mo + ₹499 one-time setup</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-red-400">₹699/mo</p>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#00D084]/10 flex items-center justify-center">
                    <span className="text-[#00D084] text-xs font-bold">+</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Extra Revenue from Retention</p>
                    <p className="text-xs text-gray-500">28% more clients returning</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-[#00D084]">₹32,000/mo</p>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex items-center justify-between bg-[#00D084]/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-white">Net Monthly Gain</p>
                  <p className="text-xs text-gray-400">After software cost</p>
                </div>
                <p className="text-lg font-bold text-[#00D084]">₹31,001/mo</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section id="features" className="relative py-28 bg-[#050810]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(99,102,241,0.04),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/8 text-indigo-400 text-xs font-medium mb-6">
              <Zap className="h-3.5 w-3.5" />
              Everything you need
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for Indian Salons</h2>
            <p className="text-gray-400">Every feature designed around how Indian salons actually work.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Feature 1 */}
            <div className="group bg-[#0a0f1a] border border-white/8 rounded-2xl p-6 hover:border-[#00D084]/30 transition-all hover:bg-[#0d1520]">
              <div className="h-11 w-11 rounded-xl bg-[#00D084]/10 flex items-center justify-center mb-5 group-hover:bg-[#00D084]/15 transition-colors">
                <MessageCircle className="h-5 w-5 text-[#00D084]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">WhatsApp Booking</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                24/7 booking link that works on WhatsApp, Instagram, and Google. Clients book in under 60 seconds.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full bg-[#00D084]/10 text-[#00D084] border border-[#00D084]/20">24/7 Available</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-[#00D084]/10 text-[#00D084] border border-[#00D084]/20">No App Needed</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group bg-[#0a0f1a] border border-white/8 rounded-2xl p-6 hover:border-blue-500/30 transition-all hover:bg-[#0d1520]">
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center mb-5 group-hover:bg-blue-500/15 transition-colors">
                <Bell className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Smart Reminders</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Automated 24h and 2h reminders before every appointment. No-show rate drops by up to 70%.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">24h + 2h Nudge</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">-70% No-Shows</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group bg-[#0a0f1a] border border-white/8 rounded-2xl p-6 hover:border-violet-500/30 transition-all hover:bg-[#0d1520]">
              <div className="h-11 w-11 rounded-xl bg-violet-500/10 flex items-center justify-center mb-5 group-hover:bg-violet-500/15 transition-colors">
                <FileText className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">GST Billing &amp; Invoicing</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Professional GST invoices sent automatically on WhatsApp. UPI, card, and cash — all tracked.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">GST Compliant</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">Auto-Send</span>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group bg-[#0a0f1a] border border-white/8 rounded-2xl p-6 hover:border-amber-500/30 transition-all hover:bg-[#0d1520]">
              <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5 group-hover:bg-amber-500/15 transition-colors">
                <Users className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Staff &amp; Payroll Management</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Track attendance, commissions, and salaries. Manage your entire team from one dashboard.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Attendance</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Commissions</span>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="group bg-[#0a0f1a] border border-white/8 rounded-2xl p-6 hover:border-emerald-500/30 transition-all hover:bg-[#0d1520]">
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5 group-hover:bg-emerald-500/15 transition-colors">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Multi-Branch Dashboard</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Manage all your locations from a single screen. Compare performance, revenue, and staff across branches.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Unlimited Branches</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Live Analytics</span>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="group bg-[#0a0f1a] border border-white/8 rounded-2xl p-6 hover:border-pink-500/30 transition-all hover:bg-[#0d1520]">
              <div className="h-11 w-11 rounded-xl bg-pink-500/10 flex items-center justify-center mb-5 group-hover:bg-pink-500/15 transition-colors">
                <Gift className="h-5 w-5 text-pink-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Win-Back Campaigns</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Automatically re-engage clients who haven&apos;t visited in 30, 60, or 90 days with personalized offers.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">Auto Discounts</span>
                <span className="text-[10px] px-2 py-1 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">Personalized</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="relative py-28 bg-[#080d18]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(0,208,132,0.03),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D084]/30 bg-[#00D084]/8 text-[#00D084] text-xs font-medium mb-6">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Simple, transparent pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">One Plan. Everything Included.</h2>
            <p className="text-gray-400">No tiers. No hidden fees. No contracts. Cancel anytime.</p>
          </div>

          {/* Single pricing card — centred */}
          <div className="max-w-lg mx-auto">
            <div className="relative bg-[#0a0f1a] border border-[#00D084]/40 rounded-2xl overflow-hidden shadow-2xl shadow-[#00D084]/5">
              {/* Top accent line */}
              <div className="h-1 w-full bg-gradient-to-r from-[#00D084] via-emerald-400 to-[#00D084]" />

              <div className="p-8">
                {/* Plan name + badge */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs font-bold text-[#00D084] uppercase tracking-widest mb-1">Snip &amp; Glow</p>
                    <h3 className="text-2xl font-bold text-white">All-in-One Plan</h3>
                  </div>
                  <span className="px-3 py-1.5 bg-[#00D084] text-black text-xs font-bold rounded-full">
                    15-Day Free Trial
                  </span>
                </div>

                {/* Price */}
                <div className="mb-2">
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold text-white">₹699</span>
                    <span className="text-gray-400 text-base mb-1.5">/month</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    + <span className="text-white font-medium">₹499</span> one-time WhatsApp API setup
                  </p>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/8 my-6" />

                {/* Features */}
                <div className="grid sm:grid-cols-2 gap-3 mb-8">
                  {[
                    'Unlimited locations',
                    'WhatsApp booking 24/7',
                    'Auto reminders (24h + 2h)',
                    'GST invoicing & billing',
                    'Day 30 service reminder',
                    'Day 60 win-back campaign',
                    'Staff & payroll management',
                    'Multi-branch dashboard',
                    'Advanced analytics',
                    'Client CRM & history',
                    'Broadcast campaigns',
                    'Priority WhatsApp support',
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-[#00D084] shrink-0" />
                      <span className="text-sm text-gray-300">{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  href="/signup"
                  className="block w-full text-center px-6 py-4 bg-[#00D084] text-black font-bold rounded-xl hover:bg-[#00e090] transition-colors text-base"
                >
                  Start 15-Day Free Trial
                </Link>

                <p className="text-center text-xs text-gray-500 mt-4">
                  No credit card required · Cancel anytime · Setup in 15 minutes
                </p>
              </div>

              {/* ROI callout */}
              <div className="bg-[#00D084]/5 border-t border-[#00D084]/15 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#00D084]" />
                  <span className="text-sm text-gray-300">Average salon earns</span>
                </div>
                <span className="text-sm font-bold text-[#00D084]">₹32,000/mo extra → 45x ROI</span>
              </div>
            </div>

            {/* Trust note */}
            <p className="text-center text-xs text-gray-500 mt-6">
              Trusted by 500+ Indian salon owners · ₹499 setup is a one-time fee for WhatsApp Business API activation
            </p>
          </div>
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-950/60 via-pink-950/40 to-[#050810]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(244,63,94,0.08),transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/8 text-rose-400 text-xs font-medium mb-8">
            <Zap className="h-3.5 w-3.5" />
            Join 500+ salons already on autopilot
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
            Ready to stop losing clients?
          </h2>
          <p className="text-gray-300 text-lg mb-10 max-w-xl mx-auto">
            Join 500+ Indian salons already on autopilot. Set it up in 15 minutes. See results in the first week.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#00D084] text-black font-bold rounded-xl hover:bg-[#00e090] transition-colors text-sm"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 text-white rounded-xl hover:border-white/40 hover:bg-white/5 transition-all text-sm font-medium"
            >
              Book a Demo
            </Link>
          </div>

          <p className="text-gray-500 text-xs mt-6">
            15-day free trial · No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 bg-[#050810]">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-[#00D084]" />
              <span className="text-base font-bold text-white">Snip &amp; Glow</span>
              <span className="h-2 w-2 rounded-full bg-[#00D084] animate-pulse" />
            </Link>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
              <Link href="/refund" className="hover:text-gray-300 transition-colors">Refund</Link>
              <Link href="/contact" className="hover:text-gray-300 transition-colors">Contact</Link>
            </div>

            {/* Copyright */}
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} Snip &amp; Glow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
