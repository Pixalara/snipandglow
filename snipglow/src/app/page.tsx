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

          {/* Right — WhatsApp Phone Mockup with animated scrolling conversation */}
          <div className="hidden lg:flex justify-center">
            <div className="relative">
              {/* Glow */}
              <div className="absolute inset-0 rounded-[48px] bg-[#00D084]/10 blur-3xl scale-110" />

              {/* Phone shell */}
              <div className="relative w-[300px] h-[620px] rounded-[48px] bg-[#111] border-[10px] border-[#1a1a1a] shadow-2xl shadow-black/70 overflow-hidden"
                style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 40px 80px rgba(0,0,0,0.7), 0 0 60px rgba(0,208,132,0.08)' }}>
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#111] rounded-b-2xl z-20" />

                {/* Screen */}
                <div className="absolute inset-0 bg-[#0b141a] flex flex-col">
                  {/* WA Header */}
                  <div className="bg-[#1f2c34] px-4 pt-8 pb-3 flex items-center gap-3 border-b border-white/5 shrink-0">
                    <div className="h-9 w-9 rounded-full bg-[#1a5c2a] flex items-center justify-center text-xs font-bold text-white">GS</div>
                    <div>
                      <p className="text-sm font-semibold text-white">Glamour Salon</p>
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00D084]" />
                        <p className="text-[10px] text-gray-400">online</p>
                      </div>
                    </div>
                  </div>

                  {/* Scrolling chat — CSS animation */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes chatScroll {
                      0%,5%    { transform: translateY(0); }
                      11%,16%  { transform: translateY(-200px); }
                      22%,27%  { transform: translateY(-420px); }
                      33%,38%  { transform: translateY(-640px); }
                      44%,49%  { transform: translateY(-860px); }
                      55%,60%  { transform: translateY(-1060px); }
                      66%,71%  { transform: translateY(-1260px); }
                      77%,82%  { transform: translateY(-1460px); }
                      88%,93%  { transform: translateY(-1660px); }
                      99%,100% { transform: translateY(0); }
                    }
                    .chat-scroll { animation: chatScroll 54s ease-in-out infinite; }
                  `}} />

                  <div className="flex-1 overflow-hidden px-3 py-3">
                    <div className="chat-scroll space-y-3">

                      {/* ── FLOW 1: Welcome + Book ── */}
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[180px]">
                          <p className="text-[12px] text-white">Hi 👋</p>
                          <p className="text-[9px] text-gray-300 text-right mt-0.5">10:01 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[220px]">
                          <div className="bg-gradient-to-r from-[#dcfce7] to-[#bbf7d0] px-3 py-2 border-l-4 border-[#16a34a]">
                            <p className="text-[11px] font-bold text-[#15803d]">🏆 Glamour Studio</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-[12px] text-gray-100 font-medium mb-1">👋 Welcome!</p>
                            <p className="text-[11px] text-gray-300">How can we help you today?</p>
                          </div>
                          <div className="border-t border-white/5">
                            {['💇 Book Appointment','📋 My Appointments','💰 Services & Prices'].map((b,i) => (
                              <div key={i} className="px-3 py-2 border-b border-white/5 last:border-0 text-center">
                                <p className="text-[11px] text-[#53bdeb] font-medium">{b}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-gray-500 text-right px-3 pb-2">10:01 AM</p>
                        </div>
                      </div>

                      {/* ── FLOW 2: Booking Confirmed ── */}
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[180px]">
                          <p className="text-[12px] text-white">💇 Book Appointment</p>
                          <p className="text-[9px] text-gray-300 text-right mt-0.5">10:02 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[220px] border border-[#00D084]/20">
                          <div className="px-3 py-2.5">
                            <p className="text-[12px] text-[#25d366] font-bold mb-2">✅ Booking Confirmed!</p>
                            <div className="space-y-1 text-[11px] text-gray-300">
                              <p>👤 Priya</p>
                              <p>✂️ Haircut</p>
                              <p>📅 10 May 2026, 2:30 PM</p>
                              <p>📍 Glamour Salon, Koramangala</p>
                            </div>
                            <p className="text-[11px] text-gray-200 mt-2">See you soon! 😊</p>
                          </div>
                          <div className="border-t border-white/5">
                            {['Reschedule','Cancel'].map((b,i) => (
                              <div key={i} className="px-3 py-2 border-b border-white/5 last:border-0 text-center">
                                <p className="text-[11px] text-[#53bdeb] font-medium">{b}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-gray-500 text-right px-3 pb-2">10:02 AM</p>
                        </div>
                      </div>

                      {/* ── FLOW 3: 30-Day Reminder ── */}
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[220px]">
                          <div className="bg-gradient-to-r from-[#dcfce7] to-[#bbf7d0] px-3 py-2 border-l-4 border-[#16a34a]">
                            <p className="text-[11px] font-bold text-[#15803d]">🏆 Glamour Studio</p>
                          </div>
                          <div className="px-3 py-2.5 space-y-1.5">
                            <p className="text-[12px] text-gray-100">Hi <strong className="text-white">Priya</strong>! 👋</p>
                            <p className="text-[11px] text-gray-300">We miss you at <strong className="text-white">Glamour Studio</strong>! ✨</p>
                            <p className="text-[11px] text-gray-300">It&apos;s been a while. Your hair deserves some love! 💕</p>
                            <p className="text-[11px] text-gray-300">Reply <strong className="text-white">Book</strong> to schedule — or tap below! 👇</p>
                          </div>
                          <div className="border-t border-white/5">
                            {['📅 Book Appointment','💰 View Our Services'].map((b,i) => (
                              <div key={i} className="px-3 py-2 border-b border-white/5 last:border-0 text-center">
                                <p className="text-[11px] text-[#53bdeb] font-medium">{b}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-gray-500 text-right px-3 pb-2">10:04 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[180px]">
                          <p className="text-[12px] text-white">✅ Booking now!</p>
                          <p className="text-[9px] text-gray-300 text-right mt-0.5">10:05 AM</p>
                        </div>
                      </div>

                      {/* ── FLOW 4: Digital Receipt ── */}
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[230px]">
                          <div className="bg-gradient-to-r from-[#f3e8ff] to-[#ede9fe] px-3 py-2 border-l-4 border-[#7c3aed]">
                            <p className="text-[11px] font-bold text-[#6d28d9]">🧾 Glamour Studio</p>
                            <p className="text-[9px] text-[#7c3aed]">Invoice #INV-2026-00142</p>
                          </div>
                          <div className="px-3 py-2.5">
                            <p className="text-[12px] text-gray-100">Hi <strong className="text-white">Priya</strong>, thank you! 🙏</p>
                            <p className="text-[11px] text-gray-300 mb-2">Your digital bill is ready.</p>
                            <div className="bg-[#111b21] rounded-lg p-2 space-y-1.5">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Services</p>
                              {[['Haircut','₹300'],['Hair Color','₹800']].map(([s,p]) => (
                                <div key={s} className="flex justify-between text-[11px]">
                                  <span className="text-gray-200">{s}</span>
                                  <span className="text-gray-200 font-medium">{p}</span>
                                </div>
                              ))}
                              <div className="border-t border-white/10 pt-1.5 space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-gray-400">Subtotal</span>
                                  <span className="text-gray-300">₹1,100</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-[#25d366]">Gold Member (10%)</span>
                                  <span className="text-[#25d366]">-₹110</span>
                                </div>
                                <div className="flex justify-between text-[12px] font-bold border-t border-white/10 pt-1">
                                  <span className="text-white">Total</span>
                                  <span className="text-[#25d366]">₹990</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-gray-400">Payment</span>
                                  <span className="text-gray-300">💳 UPI · Paid</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-[11px] text-gray-200 mt-2">Hope to see you again! 💖</p>
                          </div>
                          <div className="border-t border-white/5">
                            {['📄 Download PDF Receipt','📅 Book Next Appointment'].map((b,i) => (
                              <div key={i} className="px-3 py-2 border-b border-white/5 last:border-0 text-center">
                                <p className={`text-[11px] font-medium ${i===0?'text-[#ef4444]':'text-[#53bdeb]'}`}>{b}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-gray-500 text-right px-3 pb-2">3:46 PM</p>
                        </div>
                      </div>

                      {/* ── FLOW 5: Cancel Confirmation ── */}
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[180px]">
                          <p className="text-[12px] text-white">Cancel</p>
                          <p className="text-[9px] text-gray-300 text-right mt-0.5">11:00 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[220px]">
                          <div className="px-3 py-2.5">
                            <p className="text-[12px] text-[#fbbf24] font-medium mb-2">Are you sure you want to cancel?</p>
                            <p className="text-[11px] text-gray-300">✂️ Haircut — 10 May, 2:30 PM</p>
                          </div>
                          <div className="border-t border-white/5">
                            {['Yes, Cancel','Keep It 😊'].map((b,i) => (
                              <div key={i} className="px-3 py-2 border-b border-white/5 last:border-0 text-center">
                                <p className={`text-[11px] font-medium ${i===0?'text-[#ef4444]':'text-[#25d366]'}`}>{b}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-gray-500 text-right px-3 pb-2">11:00 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[180px]">
                          <p className="text-[12px] text-white">Keep It 😊</p>
                          <p className="text-[9px] text-gray-300 text-right mt-0.5">11:01 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] px-3 py-2.5 rounded-xl rounded-tl-sm max-w-[220px]">
                          <p className="text-[12px] text-[#25d366] font-medium">Great! Your appointment is confirmed. See you on 10 May! 💇‍♀️</p>
                          <p className="text-[9px] text-gray-500 text-right mt-1">11:01 AM</p>
                        </div>
                      </div>

                      {/* ── FLOW 6: 24h Appointment Reminder ── */}
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[220px] border border-[#3b82f6]/20">
                          <div className="bg-gradient-to-r from-[#eff6ff] to-[#dbeafe] px-3 py-2 border-l-4 border-[#3b82f6]">
                            <p className="text-[11px] font-bold text-[#1d4ed8]">📅 Appointment Reminder</p>
                            <p className="text-[9px] text-[#3b82f6]">Glamour Studio</p>
                          </div>
                          <div className="px-3 py-2.5 space-y-1">
                            <p className="text-[12px] text-gray-100">Hi <strong className="text-white">Priya</strong>! 👋</p>
                            <p className="text-[11px] text-gray-300">Just a reminder — you have an appointment <strong className="text-white">tomorrow</strong>:</p>
                            <div className="bg-[#111b21] rounded-lg p-2 space-y-0.5 text-[11px] text-gray-300 mt-1">
                              <p>✂️ Haircut</p>
                              <p>📅 10 May, 2:30 PM</p>
                              <p>👤 Stylist: Priya</p>
                              <p>📍 Glamour Salon</p>
                            </div>
                            <p className="text-[11px] text-gray-300 mt-1">Need to change plans?</p>
                          </div>
                          <div className="border-t border-white/5">
                            {['✅ Confirm','🔄 Reschedule','❌ Cancel'].map((b,i) => (
                              <div key={i} className="px-3 py-1.5 border-b border-white/5 last:border-0 text-center">
                                <p className="text-[11px] text-[#53bdeb] font-medium">{b}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-gray-500 text-right px-3 pb-2">2:30 PM</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[180px]">
                          <p className="text-[12px] text-white">✅ Confirm</p>
                          <p className="text-[9px] text-gray-300 text-right mt-0.5">2:31 PM</p>
                        </div>
                      </div>

                      {/* ── FLOW 7: 2h Before Reminder ── */}
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[220px] border border-[#f59e0b]/20">
                          <div className="bg-gradient-to-r from-[#fffbeb] to-[#fef3c7] px-3 py-2 border-l-4 border-[#f59e0b]">
                            <p className="text-[11px] font-bold text-[#b45309]">⏰ Starting in 2 Hours!</p>
                            <p className="text-[9px] text-[#d97706]">Glamour Studio</p>
                          </div>
                          <div className="px-3 py-2.5 space-y-1">
                            <p className="text-[12px] text-gray-100">Hey <strong className="text-white">Priya</strong>! 💇‍♀️</p>
                            <p className="text-[11px] text-gray-300">Your appointment is in <strong className="text-white">2 hours</strong>. We&apos;re getting ready for you!</p>
                            <div className="bg-[#111b21] rounded-lg p-2 text-[11px] text-gray-300 mt-1">
                              <p>✂️ Haircut · 2:30 PM today</p>
                              <p>📍 Glamour Salon, Koramangala</p>
                            </div>
                            <p className="text-[11px] text-gray-300 mt-1">See you soon! 🌟</p>
                          </div>
                          <p className="text-[9px] text-gray-500 text-right px-3 pb-2">12:30 PM</p>
                        </div>
                      </div>

                      {/* ── FLOW 8: Day 30 Service Reminder ── */}
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[220px] border border-[#8b5cf6]/20">
                          <div className="bg-gradient-to-r from-[#f5f3ff] to-[#ede9fe] px-3 py-2 border-l-4 border-[#8b5cf6]">
                            <p className="text-[11px] font-bold text-[#6d28d9]">💜 Time for a Touch-Up!</p>
                            <p className="text-[9px] text-[#8b5cf6]">Glamour Studio · Day 30</p>
                          </div>
                          <div className="px-3 py-2.5 space-y-1.5">
                            <p className="text-[12px] text-gray-100">Hi <strong className="text-white">Priya</strong>! 🌸</p>
                            <p className="text-[11px] text-gray-300">It&apos;s been <strong className="text-white">30 days</strong> since your last visit.</p>
                            <p className="text-[11px] text-gray-300">Your hair color is due for a refresh — book now before slots fill up! ✨</p>
                            <div className="bg-[#111b21] rounded-lg p-2 text-[11px] text-gray-300 mt-1">
                              <p className="text-[#8b5cf6] font-medium">🎁 Special: 10% off this week</p>
                            </div>
                          </div>
                          <div className="border-t border-white/5">
                            {['📅 Book Now','💰 View Services'].map((b,i) => (
                              <div key={i} className="px-3 py-1.5 border-b border-white/5 last:border-0 text-center">
                                <p className="text-[11px] text-[#53bdeb] font-medium">{b}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-gray-500 text-right px-3 pb-2">10:00 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[180px]">
                          <p className="text-[12px] text-white">📅 Book Now</p>
                          <p className="text-[9px] text-gray-300 text-right mt-0.5">10:03 AM</p>
                        </div>
                      </div>

                      {/* ── FLOW 9: Day 60 Win-Back ── */}
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm overflow-hidden max-w-[220px] border border-[#ec4899]/20">
                          <div className="bg-gradient-to-r from-[#fdf2f8] to-[#fce7f3] px-3 py-2 border-l-4 border-[#ec4899]">
                            <p className="text-[11px] font-bold text-[#be185d]">💕 We Miss You!</p>
                            <p className="text-[9px] text-[#ec4899]">Glamour Studio · Day 60</p>
                          </div>
                          <div className="px-3 py-2.5 space-y-1.5">
                            <p className="text-[12px] text-gray-100">Hey <strong className="text-white">Priya</strong>! 💖</p>
                            <p className="text-[11px] text-gray-300">It&apos;s been <strong className="text-white">2 months</strong> — we miss you at Glamour Studio!</p>
                            <div className="bg-gradient-to-r from-[#ec4899]/10 to-[#f43f5e]/10 border border-[#ec4899]/30 rounded-lg p-2.5 mt-1">
                              <p className="text-[12px] text-[#ec4899] font-bold text-center">🎉 15% OFF</p>
                              <p className="text-[10px] text-gray-300 text-center">your next visit</p>
                              <p className="text-[9px] text-gray-400 text-center mt-0.5">Valid for 7 days · Code: MISSYOU15</p>
                            </div>
                            <p className="text-[11px] text-gray-300">Come back and treat yourself — your stylist is waiting! ✨</p>
                          </div>
                          <div className="border-t border-white/5">
                            {['💅 Claim My 15% Off','📋 View Services'].map((b,i) => (
                              <div key={i} className="px-3 py-1.5 border-b border-white/5 last:border-0 text-center">
                                <p className={`text-[11px] font-medium ${i===0?'text-[#ec4899]':'text-[#53bdeb]'}`}>{b}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-gray-500 text-right px-3 pb-2">10:00 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-[#005c4b] px-3 py-2 rounded-xl rounded-tr-sm max-w-[200px]">
                          <p className="text-[12px] text-white">💅 Claim My 15% Off</p>
                          <p className="text-[9px] text-gray-300 text-right mt-0.5">10:04 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="bg-[#1f2c34] px-3 py-2.5 rounded-xl rounded-tl-sm max-w-[220px]">
                          <p className="text-[12px] text-[#25d366] font-medium">Welcome back! 🎉 Your 15% discount has been applied. Book your appointment now!</p>
                          <p className="text-[9px] text-gray-500 text-right mt-1">10:04 AM</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Input bar */}
                  <div className="bg-[#1f2c34] px-3 py-2.5 flex items-center gap-2 border-t border-white/5 shrink-0">
                    <div className="flex-1 bg-[#2a3942] rounded-full h-9 flex items-center px-4">
                      <p className="text-[12px] text-gray-500">Type a message</p>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-[#00D084] flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
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

      {/* ===== SMART REMINDERS ===== */}
      <section id="reminders" className="relative py-24 bg-[#050810]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D084]/30 bg-[#00D084]/10 text-[#00D084] text-xs font-medium mb-4">
              <Bell className="h-3.5 w-3.5" />
              Automated Retention Engine
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              The right message, at the right time
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Snip &amp; Glow runs 4 automated WhatsApp flows that keep clients coming back — without you lifting a finger.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 24h Reminder */}
            <div className="group relative p-6 rounded-2xl bg-[#0a0f1a] border border-white/5 hover:border-[#3b82f6]/30 transition-all overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#3b82f6]/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-lg">📅</div>
                  <div>
                    <p className="text-xs font-bold text-[#3b82f6] uppercase tracking-wider">24h Before</p>
                    <h3 className="text-base font-semibold text-white">Appointment Reminder</h3>
                  </div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">
                  Sent automatically 24 hours before every appointment. Clients confirm, reschedule, or cancel — reducing no-shows by up to 60%.
                </p>
                <div className="bg-[#111b21] rounded-xl p-3 border border-white/5">
                  <p className="text-[11px] text-[#3b82f6] font-medium mb-1">📅 Tomorrow at 2:30 PM</p>
                  <p className="text-[11px] text-gray-300">&quot;Hi Priya! Just a reminder — you have a Haircut tomorrow at 2:30 PM with Stylist Neha at Glamour Salon. Need to change plans?&quot;</p>
                  <div className="flex gap-2 mt-2">
                    {['✅ Confirm','🔄 Reschedule','❌ Cancel'].map(b => (
                      <span key={b} className="text-[9px] text-[#53bdeb] border border-[#53bdeb]/30 rounded px-1.5 py-0.5">{b}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2h Reminder */}
            <div className="group relative p-6 rounded-2xl bg-[#0a0f1a] border border-white/5 hover:border-[#f59e0b]/30 transition-all overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#f59e0b]/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center text-lg">⏰</div>
                  <div>
                    <p className="text-xs font-bold text-[#f59e0b] uppercase tracking-wider">2h Before</p>
                    <h3 className="text-base font-semibold text-white">Same-Day Nudge</h3>
                  </div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">
                  A friendly heads-up 2 hours before the appointment. Keeps clients on track and reduces last-minute cancellations.
                </p>
                <div className="bg-[#111b21] rounded-xl p-3 border border-white/5">
                  <p className="text-[11px] text-[#f59e0b] font-medium mb-1">⏰ Starting in 2 hours!</p>
                  <p className="text-[11px] text-gray-300">&quot;Hey Priya! Your Haircut is in 2 hours at 2:30 PM. We&apos;re getting ready for you! See you soon 🌟&quot;</p>
                </div>
              </div>
            </div>

            {/* Day 30 */}
            <div className="group relative p-6 rounded-2xl bg-[#0a0f1a] border border-white/5 hover:border-[#8b5cf6]/30 transition-all overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#8b5cf6]/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-lg">💜</div>
                  <div>
                    <p className="text-xs font-bold text-[#8b5cf6] uppercase tracking-wider">Day 30</p>
                    <h3 className="text-base font-semibold text-white">Service Refresh Reminder</h3>
                  </div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">
                  30 days after their last visit, clients get a personalized reminder that their hair color, facial, or treatment is due for a refresh — with a special offer.
                </p>
                <div className="bg-[#111b21] rounded-xl p-3 border border-white/5">
                  <p className="text-[11px] text-[#8b5cf6] font-medium mb-1">💜 Time for a Touch-Up! · Day 30</p>
                  <p className="text-[11px] text-gray-300">&quot;Hi Priya! It&apos;s been 30 days since your last visit. Your hair color is due for a refresh — book now before slots fill up! 🎁 10% off this week.&quot;</p>
                </div>
              </div>
            </div>

            {/* Day 60 Win-Back */}
            <div className="group relative p-6 rounded-2xl bg-[#0a0f1a] border border-white/5 hover:border-[#ec4899]/30 transition-all overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#ec4899]/5 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-[#ec4899]/10 flex items-center justify-center text-lg">💕</div>
                  <div>
                    <p className="text-xs font-bold text-[#ec4899] uppercase tracking-wider">Day 60 · Win-Back</p>
                    <h3 className="text-base font-semibold text-white">Re-Engagement Offer</h3>
                  </div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">
                  Clients who haven&apos;t visited in 60 days get a personalized win-back message with a 15% discount — re-engaging them before they&apos;re lost forever.
                </p>
                <div className="bg-[#111b21] rounded-xl p-3 border border-white/5">
                  <p className="text-[11px] text-[#ec4899] font-medium mb-1">💕 We Miss You! · Day 60</p>
                  <p className="text-[11px] text-gray-300">&quot;Hey Priya! It&apos;s been 2 months — we miss you! 🎉 <strong className="text-[#ec4899]">15% OFF</strong> your next visit. Valid 7 days. Code: MISSYOU15&quot;</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[9px] text-[#ec4899] border border-[#ec4899]/30 rounded px-1.5 py-0.5">💅 Claim 15% Off</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-[#0a0f1a] border border-white/5">
            {[
              { val: '60%', label: 'Fewer no-shows', color: 'text-[#3b82f6]' },
              { val: '30%', label: 'More repeat visits', color: 'text-[#8b5cf6]' },
              { val: '15%', label: 'Win-back rate', color: 'text-[#ec4899]' },
              { val: '₹0', label: 'Extra effort needed', color: 'text-[#00D084]' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
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
