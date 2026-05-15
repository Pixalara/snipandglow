'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StructuredData } from './structured-data';
import {
  Scissors,
  MessageCircle,
  ArrowRight,
  Bell,
  FileText,
  Clock,
  Zap,
  Users,
  BarChart3,
  CheckCircle2,
  TrendingUp,
  Calendar,
  MapPin,
  Repeat2,
  Gift,
  Menu,
  X,
  Wallet,
  Target,
  Shield,
  Star,
  Headphones,
} from 'lucide-react';

// Animated counter that counts up when scrolled into view
function AnimatedNumber({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 1500;
          const steps = 40;
          const increment = value / steps;
          let current = 0;
          let step = 0;
          const timer = setInterval(() => {
            step++;
            current = Math.min(current + increment, value);
            setDisplay(Math.round(current));
            if (step >= steps) { setDisplay(value); clearInterval(timer); }
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, hasAnimated]);

  return <span ref={ref}>{prefix}{display.toLocaleString('en-IN')}{suffix}</span>;
}

export default function HomePage() {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">
      <StructuredData />

      {/* ===== NAVBAR ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl shadow-lg shadow-slate-900/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <span className="text-lg sm:text-xl font-bold tracking-tight">
              <span className="text-white">snipand</span>
              <span className="bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">glow</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-sm text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowDemoModal(true)}
              className="hidden sm:inline-flex px-4 py-2 text-sm text-white border border-slate-600 rounded-full hover:border-pink-400 hover:text-pink-300 transition-all"
            >
              Live Demo
            </button>
            <Link
              href="/login"
              className="hidden sm:inline-flex px-5 py-2 text-sm font-semibold text-white rounded-full transition-all hover:shadow-lg hover:shadow-pink-500/20"
              style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}
            >
              Login
            </Link>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center h-10 w-10 rounded-lg text-white hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 py-4 space-y-3">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-slate-300 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-slate-300 hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-slate-300 hover:text-white transition-colors">Pricing</a>
            <Link href="/blog" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-slate-300 hover:text-white transition-colors">Blog</Link>
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <button onClick={() => { setMobileMenuOpen(false); setShowDemoModal(true); }} className="flex items-center justify-center py-2.5 text-sm text-white border border-slate-600 rounded-full hover:border-pink-400 transition-all">
                Live Demo
              </button>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center py-2.5 text-sm font-semibold text-white rounded-full" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>
                Login
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center pt-20 sm:pt-24 pb-12 sm:pb-16 bg-gradient-to-br from-white via-pink-50/30 to-fuchsia-50/20 overflow-hidden">
        {/* Colorful floating orbs */}
        <div className="absolute top-1/4 left-1/6 w-96 h-96 bg-pink-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/6 w-80 h-80 bg-pink-200/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center w-full">
          {/* Left */}
          <div className="space-y-8 reveal-left">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-200 bg-pink-50 text-pink-700 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse" />
              Trusted by 500+ Indian Salon Owners
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight text-slate-900">
                The Salon Management
                <br />
                <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">Software That Brings</span>
                <br />
                Clients Back
              </h1>
              <p className="text-lg sm:text-xl text-slate-700 font-medium">
                Appointments. WhatsApp Reminders. Billing. All on Autopilot.
              </p>
              <p className="text-slate-500 text-base max-w-lg leading-relaxed">
                Set it up once. Every client gets booked, reminded, billed, and brought back automatically.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 py-2">
              <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border border-slate-100 shadow-sm">
                <div className="h-8 w-8 rounded-lg bg-pink-100 flex items-center justify-center">
                  <Users className="h-4 w-4 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">500+ Salons</p>
                  <p className="text-xs text-slate-500">Active users</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border border-slate-100 shadow-sm">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">5,00,000+</p>
                  <p className="text-xs text-slate-500">Appointments</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border border-slate-100 shadow-sm">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">15-Day Free</p>
                  <p className="text-xs text-slate-500">Trial, no card</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-violet-500 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-violet-600 transition-colors text-sm shadow-md shadow-pink-200"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:border-pink-300 hover:text-pink-600 transition-all text-sm bg-white"
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Right — WhatsApp Phone Mockup with auto-scrolling conversation */}
          <div className="hidden lg:flex justify-center items-center reveal-right">
            <div className="relative">
              {/* Ambient glow */}
              <div className="absolute inset-0 rounded-[48px] bg-pink-300/20 blur-3xl scale-125" />

              {/* Phone shell */}
              <div className="relative w-[300px] h-[620px] rounded-[48px] bg-white border border-slate-200 shadow-2xl shadow-slate-200/60 overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-2xl z-20" />

                {/* Screen */}
                <div className="absolute inset-0 bg-[#e5ddd5] flex flex-col pt-6">
                  {/* WA Header */}
                  <div className="bg-[#075e54] px-4 pt-6 pb-3 flex items-center gap-3 shrink-0">
                    <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0">GS</div>
                    <div>
                      <p className="text-sm font-semibold text-white">Glamour Salon</p>
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        <p className="text-[10px] text-emerald-200">online</p>
                      </div>
                    </div>
                  </div>

                  {/* Scrolling chat — CSS keyframe animation */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes chatFlow {
                      0%,6%    { transform: translateY(0); }
                      12%,18%  { transform: translateY(-220px); }
                      24%,30%  { transform: translateY(-440px); }
                      36%,42%  { transform: translateY(-660px); }
                      48%,54%  { transform: translateY(-880px); }
                      60%,66%  { transform: translateY(-1100px); }
                      72%,78%  { transform: translateY(-1320px); }
                      84%,90%  { transform: translateY(-1540px); }
                      96%,100% { transform: translateY(0); }
                    }
                  `}} />

                  <div className="flex-1 overflow-hidden">
                    <div className="px-3 py-3 space-y-3" style={{ animation: 'chatFlow 48s ease-in-out infinite' }}>

                      {/* -- 1. Customer says Hi -- */}
                      <div className="flex justify-end">
                        <div className="bg-[#dcf8c6] px-3 py-2 rounded-xl rounded-tr-sm max-w-[160px] shadow-sm">
                          <p className="text-[12px] text-slate-800">Hi 👋</p>
                          <p className="text-[9px] text-slate-500 text-right mt-0.5">10:01 AM</p>
                        </div>
                      </div>

                      {/* -- 2. Welcome menu -- */}
                      <div className="flex justify-start">
                        <div className="bg-white rounded-xl rounded-tl-sm overflow-hidden max-w-[230px] shadow-sm border border-emerald-100">
                          <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100">
                            <p className="text-[11px] font-bold text-emerald-700">👋 Welcome to Glamour Salon!</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-[11px] text-slate-600">How can we help you today?</p>
                          </div>
                          <div className="border-t border-slate-100">
                            {['💇 Book Appointment', '📋 My Appointments', '💰 Services & Prices'].map((b) => (
                              <div key={b} className="px-3 py-1.5 border-b border-slate-50 last:border-0 text-center">
                                <p className="text-[10px] text-blue-500 font-medium">{b}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* -- 3. Customer books -- */}
                      <div className="flex justify-end">
                        <div className="bg-[#dcf8c6] px-3 py-2 rounded-xl rounded-tr-sm max-w-[160px] shadow-sm">
                          <p className="text-[12px] text-slate-800">💇 Book Appointment</p>
                          <p className="text-[9px] text-slate-500 text-right mt-0.5">10:02 AM</p>
                        </div>
                      </div>

                      {/* -- 4. Booking confirmed -- */}
                      <div className="flex justify-start">
                        <div className="bg-white rounded-xl rounded-tl-sm overflow-hidden max-w-[230px] shadow-sm border border-emerald-200">
                          <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100">
                            <p className="text-[12px] font-bold text-emerald-700">? Booking Confirmed!</p>
                          </div>
                          <div className="px-3 py-2.5 space-y-1 text-[11px] text-slate-600">
                            <p>👤 Priya</p>
                            <p>✂️ Haircut</p>
                            <p>📅 10 May, 2:30 PM</p>
                            <p>📍 Glamour Salon</p>
                            <p className="text-slate-800 mt-1">See you soon! 😊</p>
                          </div>
                          <div className="border-t border-slate-100 flex">
                            <div className="flex-1 py-1.5 text-center border-r border-slate-100">
                              <p className="text-[10px] text-blue-500 font-medium">Reschedule</p>
                            </div>
                            <div className="flex-1 py-1.5 text-center">
                              <p className="text-[10px] text-blue-500 font-medium">Cancel</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* -- 5. 24h Reminder -- */}
                      <div className="flex justify-start">
                        <div className="bg-white rounded-xl rounded-tl-sm overflow-hidden max-w-[230px] shadow-sm border border-blue-100">
                          <div className="bg-blue-50 px-3 py-2 border-b border-blue-100">
                            <p className="text-[11px] font-bold text-blue-600">📅 Reminder — Tomorrow</p>
                          </div>
                          <div className="px-3 py-2.5">
                            <p className="text-[11px] text-slate-600">Hi <span className="font-medium text-slate-800">Priya</span>! Your Haircut is <span className="font-medium">tomorrow at 2:30 PM</span>. Need to change plans?</p>
                          </div>
                          <div className="border-t border-slate-100 flex">
                            {['✅ Confirm', '🔄 Reschedule'].map((b) => (
                              <div key={b} className="flex-1 py-1.5 text-center border-r border-slate-100 last:border-0">
                                <p className="text-[10px] text-blue-500 font-medium">{b}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* -- 6. 2h Before Nudge -- */}
                      <div className="flex justify-start">
                        <div className="bg-white rounded-xl rounded-tl-sm overflow-hidden max-w-[230px] shadow-sm border border-amber-100">
                          <div className="bg-amber-50 px-3 py-2 border-b border-amber-100">
                            <p className="text-[11px] font-bold text-amber-700">? Starting in 2 Hours!</p>
                          </div>
                          <div className="px-3 py-2.5">
                            <p className="text-[11px] text-slate-600">Hey <span className="font-medium text-slate-800">Priya</span>! Your appointment is in 2 hours. We&apos;re getting ready for you! 🌟</p>
                          </div>
                        </div>
                      </div>

                      {/* -- 7. Invoice / Receipt -- */}
                      <div className="flex justify-start">
                        <div className="bg-white rounded-xl rounded-tl-sm overflow-hidden max-w-[230px] shadow-sm border border-purple-100">
                          <div className="bg-purple-50 px-3 py-2 border-b border-purple-100">
                            <p className="text-[11px] font-bold text-purple-700">🧾 Invoice #INV-0142</p>
                          </div>
                          <div className="px-3 py-2.5">
                            <p className="text-[11px] text-slate-600 mb-2">Hi <span className="font-medium text-slate-800">Priya</span>, your bill is ready! 🙏</p>
                            <div className="bg-slate-50 rounded-lg p-2 space-y-1 text-[10px]">
                              <div className="flex justify-between"><span>Haircut</span><span className="font-medium">₹300</span></div>
                              <div className="flex justify-between"><span>Hair Color</span><span className="font-medium">₹800</span></div>
                              <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-emerald-700"><span>Total</span><span>₹990</span></div>
                              <p className="text-slate-400">💳 UPI — Paid</p>
                            </div>
                          </div>
                          <div className="border-t border-slate-100 flex">
                            <div className="flex-1 py-1.5 text-center border-r border-slate-100">
                              <p className="text-[10px] text-red-500 font-medium">—— PDF Receipt</p>
                            </div>
                            <div className="flex-1 py-1.5 text-center">
                              <p className="text-[10px] text-blue-500 font-medium">📅 Book Again</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* -- 8. Day 30 Service Reminder -- */}
                      <div className="flex justify-start">
                        <div className="bg-white rounded-xl rounded-tl-sm overflow-hidden max-w-[230px] shadow-sm border border-violet-100">
                          <div className="bg-violet-50 px-3 py-2 border-b border-violet-100">
                            <p className="text-[11px] font-bold text-violet-700">💜 Time for a Touch-Up!</p>
                            <p className="text-[9px] text-violet-500">Day 30</p>
                          </div>
                          <div className="px-3 py-2.5">
                            <p className="text-[11px] text-slate-600">Hi <span className="font-medium text-slate-800">Priya</span>! It&apos;s been 30 days. Your hair color is due for a refresh! ✨</p>
                            <div className="bg-violet-50 rounded-lg p-2 mt-2 text-center">
                              <p className="text-[11px] text-violet-700 font-bold">🎁 10% off this week</p>
                            </div>
                          </div>
                          <div className="border-t border-slate-100">
                            <div className="px-3 py-1.5 text-center">
                              <p className="text-[10px] text-blue-500 font-medium">📅 Book Now</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* -- 9. Day 60 Win-Back -- */}
                      <div className="flex justify-start">
                        <div className="bg-white rounded-xl rounded-tl-sm overflow-hidden max-w-[230px] shadow-sm border border-pink-200">
                          <div className="bg-pink-50 px-3 py-2 border-b border-pink-100">
                            <p className="text-[11px] font-bold text-pink-700">💕 We Miss You!</p>
                            <p className="text-[9px] text-pink-500">Day 60</p>
                          </div>
                          <div className="px-3 py-2.5">
                            <p className="text-[11px] text-slate-600">Hey <span className="font-medium text-slate-800">Priya</span>! It&apos;s been 2 months — we miss you! 💖</p>
                            <div className="bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-lg p-2.5 mt-2 text-center">
                              <p className="text-[13px] text-pink-600 font-bold">🎉 15% OFF</p>
                              <p className="text-[9px] text-slate-500">your next visit — Code: MISSYOU15</p>
                            </div>
                          </div>
                          <div className="border-t border-slate-100 flex">
                            <div className="flex-1 py-1.5 text-center border-r border-slate-100">
                              <p className="text-[10px] text-pink-500 font-medium">💅 Claim 15% Off</p>
                            </div>
                            <div className="flex-1 py-1.5 text-center">
                              <p className="text-[10px] text-blue-500 font-medium">📋 Services</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-[#dcf8c6] px-3 py-2 rounded-xl rounded-tr-sm max-w-[180px] shadow-sm">
                          <p className="text-[12px] text-slate-800">💅 Claim 15% Off</p>
                          <p className="text-[9px] text-slate-500 text-right mt-0.5">10:04 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="bg-white px-3 py-2.5 rounded-xl rounded-tl-sm max-w-[220px] shadow-sm">
                          <p className="text-[11px] text-emerald-700 font-medium">Welcome back! 🎉 Your 15% discount is applied. Book now!</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Input bar */}
                  <div className="bg-[#f0f0f0] px-3 py-2.5 flex items-center gap-2 shrink-0">
                    <div className="flex-1 bg-white rounded-full h-8 flex items-center px-3 border border-slate-200">
                      <p className="text-[11px] text-slate-400">Type a message</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <ArrowRight className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge — bottom left */}
              <div className="absolute -bottom-4 -left-6 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-lg shadow-slate-200/60">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-pink-100 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">No-shows down 70%</p>
                    <p className="text-[10px] text-slate-500">Auto reminders working</p>
                  </div>
                </div>
              </div>

              {/* Floating badge — top right */}
              <div className="absolute -top-4 -right-6 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-lg shadow-slate-200/60">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">+28% retention</p>
                    <p className="text-[10px] text-slate-500">This month</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS (TIMELINE) ===== */}
      <section id="how-it-works" className="py-16 sm:py-24 relative" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 15%, #f8fafc 85%, #ffffff 100%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16 reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600 mb-3">How It Works</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">Up and running in minutes</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">No tech skills needed. Set it up once and let automation handle the rest.</p>
          </div>

          <div className="space-y-8 sm:space-y-12">
            {/* Step 1 */}
            <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-16 items-center reveal">
              <div className="w-full lg:text-right mb-6 lg:mb-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-semibold mb-3">Step 1</div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Add your salon details</h3>
                <p className="text-slate-500 text-sm sm:text-base leading-relaxed">Enter your services, staff, and working hours. Takes less than 5 minutes.</p>
              </div>
              <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
                    <Scissors className="h-5 w-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Glamour Salon</p>
                    <p className="text-xs text-slate-500">3 staff — 12 services</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['Haircut', 'Facial', 'Manicure', 'Waxing'].map((s) => (
                    <div key={s} className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 font-medium">{s}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-16 items-center reveal">
              <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 order-2 lg:order-1">
                <div className="space-y-3">
                  {[
                    { name: 'Priya S.', service: 'Haircut', time: '2:30 PM', status: 'Confirmed' },
                    { name: 'Meera K.', service: 'Facial', time: '4:00 PM', status: 'Reminded' },
                    { name: 'Anjali R.', service: 'Manicure', time: '5:30 PM', status: 'Pending' },
                  ].map((appt) => (
                    <div key={appt.name} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{appt.name}</p>
                        <p className="text-xs text-slate-500">{appt.service} — {appt.time}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${appt.status === 'Confirmed' ? 'bg-pink-100 text-pink-700' : appt.status === 'Reminded' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-amber-100 text-amber-700'}`}>{appt.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full order-1 lg:order-2 mb-6 lg:mb-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-100 text-fuchsia-700 text-xs font-semibold mb-3">Step 2</div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Clients book appointments</h3>
                <p className="text-slate-500 text-sm sm:text-base leading-relaxed">Clients book via WhatsApp or your booking link. Every appointment auto-confirms instantly.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-16 items-center reveal">
              <div className="w-full lg:text-right mb-6 lg:mb-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold mb-3">Step 3</div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Automation handles the rest</h3>
                <p className="text-slate-500 text-sm sm:text-base leading-relaxed">Reminders go out automatically. Bills are generated. Clients get loyalty points. You just focus on the service.</p>
              </div>
              <div className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
                <div className="space-y-3">
                  {[
                    { icon: Bell, label: '24h reminder sent to Priya', color: 'bg-pink-100 text-pink-600' },
                    { icon: FileText, label: 'Invoice ₹450 generated', color: 'bg-fuchsia-100 text-fuchsia-600' },
                    { icon: Gift, label: 'Loyalty points added', color: 'bg-violet-100 text-violet-600' },
                    { icon: Repeat2, label: 'Re-booking nudge scheduled', color: 'bg-purple-100 text-purple-600' },
                  ].map(({ icon: Icon, label, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm text-slate-700">{label}</p>
                      <CheckCircle2 className="h-4 w-4 text-pink-500 ml-auto shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ROI SECTION ===== */}
      <section className="py-16 sm:py-24 relative" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fffbfe 50%, #ffffff 100%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12 reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600 mb-3">Real Results</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">What salon owners see in 30 days</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 reveal">
            {[
              { numValue: 70, suffix: '%', label: 'Fewer no-shows', sub: 'Thanks to auto reminders', icon: Bell, color: 'bg-pink-50 text-pink-600' },
              { numValue: 28, prefix: '+', suffix: '%', label: 'Client retention', sub: 'Re-booking nudges work', icon: Repeat2, color: 'bg-fuchsia-50 text-fuchsia-600' },
              { numValue: 3, suffix: 'hrs', label: 'Saved per day', sub: 'No manual follow-ups', icon: Clock, color: 'bg-violet-50 text-violet-600' },
            ].map(({ numValue, prefix, suffix, label, sub, icon: Icon, color }) => (
              <div key={label} className="bg-slate-50 rounded-2xl p-6 sm:p-8 text-center border border-slate-100">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-slate-900 mb-1">
                  <AnimatedNumber value={numValue} prefix={prefix || ''} suffix={suffix || ''} />
                </p>
                <p className="text-sm font-semibold text-slate-700 mb-1">{label}</p>
                <p className="text-xs text-slate-500">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section id="features" className="py-16 sm:py-24 relative" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 15%, #f8fafc 85%, #ffffff 100%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12 reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600 mb-3">Features</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">Everything your salon needs</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">One platform. No juggling apps.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[
              { icon: Calendar, title: 'Smart Appointments', desc: 'Online booking with instant WhatsApp confirmation. Clients can reschedule or cancel with a tap.', color: 'bg-pink-100 text-pink-600' },
              { icon: MessageCircle, title: 'WhatsApp Automation', desc: 'Booking confirmations, 24h reminders, and re-booking nudges — all sent automatically.', color: 'bg-green-100 text-green-600' },
              { icon: FileText, title: 'Billing & Invoices', desc: 'Generate GST-ready invoices in seconds. Track payments and outstanding dues effortlessly.', color: 'bg-fuchsia-100 text-fuchsia-600' },
              { icon: Users, title: 'Client Management', desc: 'Full client history, visit notes, preferences, and loyalty points in one place.', color: 'bg-violet-100 text-violet-600' },
              { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Revenue trends, top services, staff performance, and retention metrics at a glance.', color: 'bg-purple-100 text-purple-600' },
              { icon: Zap, title: 'Multi-Branch Support', desc: 'Manage multiple salon locations from a single dashboard with branch-level reporting.', color: 'bg-pink-100 text-pink-600' },
              { icon: Wallet, title: 'Expense & Payroll', desc: 'Track all salon expenses, manage staff salaries, bonuses, and deductions in one place.', color: 'bg-amber-100 text-amber-600' },
              { icon: Target, title: 'Lead Management', desc: 'Capture leads from walk-ins, social media & referrals. Track follow-ups and convert them into loyal customers.', color: 'bg-blue-100 text-blue-600' },
              { icon: Shield, title: 'Membership & Loyalty', desc: 'Create membership plans with auto-discounts. Reward loyal customers and increase repeat visits.', color: 'bg-emerald-100 text-emerald-600' },
              { icon: Star, title: 'Customer Feedback', desc: 'Auto-collect ratings via WhatsApp after every visit. 5★ reviews go to Google, low ratings alert you instantly.', color: 'bg-amber-100 text-amber-600' },
              { icon: Headphones, title: '24hr Support', desc: 'Report any issue from the dashboard. Our team responds within 24 hours on WhatsApp. No chatbots, real humans.', color: 'bg-indigo-100 text-indigo-600' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow reveal-scale">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-16 sm:py-24 relative" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fefcff 50%, #ffffff 100%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12 reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600 mb-3">Pricing</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">Simple, honest & transparent pricing</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">One plan. All features. No hidden charges. No upsells. Start free for 15 days.</p>
          </div>

          {/* Single Plan Card */}
          <div className="max-w-lg mx-auto reveal">
            <div className="relative rounded-2xl border-2 border-pink-500 bg-white p-6 sm:p-8 shadow-lg shadow-pink-100/50">
              {/* Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-md">
                  Everything Included
                </span>
              </div>

              <div className="text-center mt-2 mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">All-in-One Salon Software</h3>
                <p className="text-slate-500 text-sm">
                  Every feature you need to run, manage, and grow your salon — in one simple plan.
                </p>
              </div>

              {/* Pricing */}
              <div className="text-center mb-6">
                <p className="text-slate-400 text-sm line-through">₹1,999 /mo</p>
                <div className="flex items-end justify-center gap-1">
                  <span className="text-5xl font-bold text-slate-900">₹999</span>
                  <span className="text-slate-500 mb-1.5">/mo</span>
                </div>
                <p className="text-slate-400 text-xs mt-2">Billed ₹11,988/year · Cancel anytime within 15 days for full refund</p>
              </div>

              {/* CTA */}
              <Link
                href="/signup"
                className="flex items-center justify-center w-full py-3.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-colors mb-5"
              >
                Start 15-Day Free Trial
              </Link>

              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs text-slate-500 mb-6">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-pink-500" />No credit card needed</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-pink-500" />15-day money-back</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-pink-500" />Go live in 2 days</span>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  'Unlimited appointments & calendar',
                  'GST billing & digital invoices',
                  'WhatsApp notifications & reminders',
                  'Staff scheduling & management',
                  'Client history, notes & preferences',
                  'Membership & loyalty packages',
                  'Expense & payroll tracking',
                  'Lead management & conversion',
                  'Business reports & analytics',
                  'WhatsApp marketing campaigns',
                  'Online booking via QR code',
                  'Multi-branch support',
                  'Referral program tracking',
                  'Feedback collection via WhatsApp',
                  'In-app Help & Support tickets',
                  'Free setup & onboarding',
                  '24hr WhatsApp priority support',
                ].map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-pink-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto mt-12 reveal">
            <div className="text-center rounded-xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900 text-sm">₹0 setup fee</p>
              <p className="text-xs text-slate-500 mt-1">We set up everything for free. No hidden onboarding charges.</p>
            </div>
            <div className="text-center rounded-xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900 text-sm">No hidden charges</p>
              <p className="text-xs text-slate-500 mt-1">₹999 is exactly what you pay. No GST surprises, no add-ons.</p>
            </div>
            <div className="text-center rounded-xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900 text-sm">15-day full refund</p>
              <p className="text-xs text-slate-500 mt-1">If SnipandGlow doesn&apos;t work for you, we refund your payment. No questions asked.</p>
            </div>
          </div>

          {/* WhatsApp API — Own Branding Add-on */}
          <div className="max-w-2xl mx-auto mt-12 reveal">
            <div className="relative rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 via-emerald-50/50 to-white p-6 sm:p-8 shadow-sm">
              {/* Accent bar */}
              <div className="absolute top-0 left-6 right-6 h-1 rounded-b-full bg-gradient-to-r from-green-500 to-emerald-500" />

              <div className="flex flex-col sm:flex-row items-start gap-5">
                {/* WhatsApp icon */}
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
                  <svg className="size-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">Build Your Own Brand on WhatsApp</h3>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Optional Add-on</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Send appointment reminders, marketing campaigns & invoices from <strong>your own WhatsApp Business number</strong>. 
                    Your salon name, your branding, your customer relationships.
                  </p>

                  {/* Pricing details */}
                  <div className="rounded-xl bg-white border border-green-100 p-4 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-2xl font-bold text-slate-900">₹2,500</p>
                        <p className="text-xs text-slate-500">One-time setup fee</p>
                      </div>
                      <div className="h-px sm:h-10 sm:w-px bg-slate-200" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span className="text-xs text-slate-600">Per-message charges as per Meta pricing</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span className="text-xs text-slate-600">No markup fees from us</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span className="text-xs text-slate-600">No platform fees — ever</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    We handle the complete WhatsApp Business API setup — Meta verification, number registration, template approvals. You just start messaging.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section className="relative py-20 sm:py-28 overflow-hidden" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #0f172a 8%, #1e1b4b 50%, #0f172a 92%, #ffffff 100%)' }}>
        {/* Subtle radial glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[600px] h-[400px] rounded-full bg-gradient-to-r from-violet-600/20 via-pink-500/10 to-orange-500/20 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 text-center reveal">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-4 py-1.5 mb-8">
            <span className="text-lg">?</span>
            <span className="text-xs font-semibold uppercase tracking-widest bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              Ready for the future?
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            See your salon running{' '}
            <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-violet-500 bg-clip-text text-transparent italic">
              on autopilot.
            </span>
          </h2>

          {/* Subtext */}
          <p className="text-slate-400 mb-10 text-sm sm:text-base max-w-lg mx-auto">
            From smart bookings to WhatsApp automation — get everything you need in one powerful dashboard.
          </p>

          {/* CTA Button with gradient */}
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 sm:px-10 py-4 rounded-2xl font-semibold text-white text-base shadow-lg shadow-pink-500/25 transition-transform hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #f97316, #ec4899, #8b5cf6)' }}
          >
            <Zap className="h-5 w-5" />
            Get Started
          </Link>

          {/* Trust points */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-8 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-pink-400" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-400" />
              Setup in 10 mins
            </span>
          </div>
        </div>
      </section>

      {/* ===== BOOK A DEMO SECTION ===== */}
      <section className="py-12 sm:py-16 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #e9d5ff 20%, #fce7f3 50%, #e9d5ff 80%, #f8fafc 100%)' }}>
        <div className="mx-auto max-w-4xl rounded-3xl px-5 py-10 sm:px-12 sm:py-16 text-center" style={{ background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)' }}>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
            Ready to run your salon like this?
          </h2>
          <p className="text-slate-400 mb-8 text-sm sm:text-base max-w-lg mx-auto">
            Get your own snipandglow dashboard and start automating bookings, billing, and growth — all in one place.
          </p>
          <button
            onClick={() => setShowDemoModal(true)}
            className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-8 py-3.5 rounded-full font-semibold text-white text-sm shadow-lg shadow-pink-500/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-pink-500/40"
            style={{ background: 'linear-gradient(135deg, #f97316, #ec4899)' }}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            Book a Live Demo
          </button>
        </div>
      </section>

      {/* Demo Booking Modal */}
      {showDemoModal && <DemoBookingModal onClose={() => setShowDemoModal(false)} />}

      {/* ===== FAQ SECTION ===== */}
      <section className="py-16 sm:py-24 relative" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 20%, #ffffff 80%, #f8fafc 100%)' }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center mb-12 reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600 mb-3">FAQ</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-slate-500 text-sm sm:text-base">Everything you need to know before getting started.</p>
          </div>

          <div className="space-y-4 reveal">
            <FaqItem
              question="What is SnipandGlow?"
              answer="SnipandGlow is an all-in-one salon and spa management software built for Indian businesses. It handles appointments, billing, customer management, staff scheduling, WhatsApp notifications, analytics, and more — all from one dashboard."
            />
            <FaqItem
              question="How long is the free trial?"
              answer="You get a full 15-day free trial with access to all features. No credit card required to start. If it doesn't work for you, you pay nothing."
            />
            <FaqItem
              question="Do I need any technical knowledge to use it?"
              answer="Not at all. SnipandGlow is designed for salon owners, not tech experts. We handle the complete setup for you, and the dashboard is as simple as using WhatsApp. Plus, we provide free training and onboarding support."
            />
            <FaqItem
              question="Can my staff use it too?"
              answer="Yes! You can add unlimited staff members with role-based access. Stylists can view their appointments, managers can access reports, and you as the owner have full control over everything."
            />
            <FaqItem
              question="How does WhatsApp integration work?"
              answer="By default, appointment reminders and invoices are sent from the SnipandGlow WhatsApp number. If you want messages to come from your own salon's WhatsApp Business number (your branding), you can opt for our one-time ₹2,500 WhatsApp API setup."
            />
            <FaqItem
              question="Is my data safe and secure?"
              answer="Absolutely. We use enterprise-grade encryption, your data is hosted on secure cloud servers, and each salon's data is completely isolated. We never share or sell your customer data."
            />
            <FaqItem
              question="Can I manage multiple branches?"
              answer="Yes, multi-branch support is included in the ₹999/mo plan. You can manage all your salon locations from a single dashboard with branch-level reporting and staff management."
            />
            <FaqItem
              question="What payment methods do my customers need?"
              answer="SnipandGlow tracks payments — it doesn't process them. Your customers pay you directly via cash, UPI, or card as usual. We just help you record and track all transactions digitally."
            />
            <FaqItem
              question="Can I cancel anytime?"
              answer="Yes, there are no lock-in contracts. You can cancel your subscription anytime. If you cancel within the first 15 days, you get a full refund — no questions asked."
            />
            <FaqItem
              question="How is SnipandGlow different from other salon software?"
              answer="Most salon software is built for Western markets and costs ₹3,000-5,000/mo. SnipandGlow is built specifically for Indian salons — with WhatsApp-first communication, GST billing, UPI tracking, and pricing that makes sense for Indian businesses at just ₹999/mo with all features included."
            />
            <FaqItem
              question="Do you offer customer support?"
              answer="Yes! We provide priority WhatsApp support for all users. You can reach our team directly on WhatsApp for any questions, issues, or feature requests. We typically respond within minutes during business hours."
            />
            <FaqItem
              question="Can I import my existing customer data?"
              answer="Yes, we help you import your existing customer database during onboarding — whether it's from Excel sheets, another software, or even paper records. Our team handles the migration for free."
            />
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="pt-12 pb-8" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #0f172a 6%, #020617 20%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {/* Top row: Logo + Nav + CTA */}
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between pb-8 border-b border-slate-800/60">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight">
                <span className="text-white">snipand</span>
                <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">glow</span>
              </span>
              <span className="h-2 w-2 rounded-full bg-pink-400 animate-pulse" />
            </Link>

            {/* Nav links */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            </div>

            {/* CTA */}
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 text-white text-sm font-semibold hover:from-pink-600 hover:to-violet-600 transition-colors shadow-lg shadow-pink-500/20"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Middle row: Copyright + Crafted by */}
          <div className="py-6 text-center">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} snipandglow. WhatsApp CRM built for salon owners. Crafted with{' '}
              <span className="text-pink-500">♥</span> by{' '}
              <a href="https://pixalara.io" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 font-medium transition-colors">
                Pixalara LLP
              </a>
              {' '}· A DPIIT Recognized Technology Company by Govt. of India
            </p>
          </div>

          {/* Social icons */}
          <div className="flex items-center justify-center gap-4 pb-6">
            <a href="https://www.linkedin.com/company/pixalara/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-9 w-9 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-all" aria-label="LinkedIn">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://x.com/pixalara" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-9 w-9 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-all" aria-label="X (Twitter)">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://www.instagram.com/pixalara/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-9 w-9 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-all" aria-label="Instagram">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <a href="https://www.youtube.com/@pixalara" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-9 w-9 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-all" aria-label="YouTube">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>

          {/* Bottom row: Legal links */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-6 border-t border-slate-800/60">
            <Link href="/privacy" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link href="/refund" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refund Policy</Link>
            <a href="mailto:dileep.cloudops@gmail.com" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

// =============================================================================
// Demo Booking Modal
// =============================================================================

const TIME_SLOTS = [
  '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM',
  '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM',
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-all hover:border-slate-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-5 sm:px-6 py-4 sm:py-5 text-left gap-4"
        aria-expanded={isOpen}
      >
        <span className="text-sm sm:text-base font-medium text-slate-900">{question}</span>
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border border-slate-200 transition-transform duration-300 ${isOpen ? 'rotate-180 bg-fuchsia-50 border-fuchsia-200' : ''}`}>
          <svg className={`size-4 transition-colors ${isOpen ? 'text-fuchsia-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-5 sm:px-6 pb-5 text-sm text-slate-600 leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}

function DemoBookingModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [salonName, setSalonName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [date, setDate] = useState('');
  const [city, setCity] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isFormValid = name.trim() && phone.trim() && date && selectedSlot;

  function getMinDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;
    setSubmitting(true);

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: '75debe40-e347-41ce-a203-93266c993232',
          subject: `New Demo Booking — ${name}`,
          name,
          phone,
          salon_name: salonName || 'Not provided',
          business_type: businessType || 'Not specified',
          preferred_date: date,
          preferred_time: selectedSlot,
          city: city || 'Not provided',
          from_name: 'snipandglow Demo Booking',
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSuccess(true);
      } else {
        alert('Something went wrong. Please try again.');
      }
    } catch {
      alert('Network error. Please try again.');
    }

    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-pink-100 mx-auto mb-4">
            <CheckCircle2 className="size-8 text-pink-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Demo Booked!</h3>
          <p className="text-slate-500 text-sm mb-6">
            We&apos;ll call you on <span className="font-medium text-slate-700">{date}</span> at{' '}
            <span className="font-medium text-slate-700">{selectedSlot}</span>. Check your WhatsApp for confirmation.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header with gradient */}
        <div className="relative px-6 py-5" style={{ background: 'linear-gradient(135deg, #f97316, #ec4899)' }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            aria-label="Close"
          >
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-white">Book a Live Demo</h2>
          <p className="text-white/80 text-sm mt-1">Pick a time that works for you</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Row 1: Name + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <input
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none transition-all"
                required
              />
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <input
                type="tel"
                placeholder="Mobile Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          {/* Row 2: Salon Name + Business Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <input
                type="text"
                placeholder="Salon/Business Name"
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none transition-all"
              />
            </div>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none transition-all"
            >
              <option value="">Select Business Type</option>
              <option value="salon">Salon</option>
              <option value="spa">Spa</option>
              <option value="barbershop">Barbershop</option>
              <option value="beauty_parlour">Beauty Parlour</option>
              <option value="wellness_center">Wellness Center</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Row 3: Date + City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={getMinDate()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-700 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none transition-all"
                required
              />
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                type="text"
                placeholder="City / Area"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Time Slots */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Select Time Slot</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-xl border py-2.5 px-2 text-sm font-medium transition-all ${
                    selectedSlot === slot
                      ? 'border-pink-500 bg-pink-50 text-pink-600 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:border-pink-300 hover:bg-pink-50/50'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isFormValid || submitting}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isFormValid ? 'linear-gradient(135deg, #f97316, #ec4899)' : '#e2e8f0',
              color: isFormValid ? 'white' : '#94a3b8',
            }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Booking...
              </span>
            ) : (
              'Book Demo'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

