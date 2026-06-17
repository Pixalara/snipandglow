'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  Megaphone,
  Smartphone,
  Package,
  Settings,
} from 'lucide-react';

// Animated counter that counts up when scrolled into view
function AnimatedNumber({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2500;
          let startTime: number | null = null;
          let rafId: number;

          const tick = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const t = Math.min(elapsed / duration, 1);
            // Ease-out cubic: decelerates toward end
            const eased = 1 - Math.pow(1 - t, 3);
            const current = Math.round(eased * value);
            setDisplay(current);
            if (t < 1) {
              rafId = requestAnimationFrame(tick);
            }
          };

          rafId = requestAnimationFrame(tick);
          return () => cancelAnimationFrame(rafId);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, hasAnimated]);

  return <span ref={ref}>{prefix}{display.toLocaleString('en-IN')}{suffix}</span>;
}

// Rolling text component - cycles through items with smooth fade+slide animation
const ROLLING_ITEMS = [
  { text: 'Book clients automatically via WhatsApp.', color: 'from-emerald-500 to-teal-500' },
  { text: 'Send reminders - zero no-shows.', color: 'from-blue-500 to-indigo-500' },
  { text: 'Generate bills in seconds.', color: 'from-violet-500 to-purple-500' },
  { text: 'Collect feedback after every visit.', color: 'from-amber-500 to-orange-500' },
  { text: 'Bring back inactive customers on autopilot.', color: 'from-pink-500 to-rose-500' },
];

function RollingText({ items }: { items: typeof ROLLING_ITEMS }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, 400);
    }, 2800);
    return () => clearInterval(interval);
  }, [items.length]);

  return (
    <span
      className={`bg-gradient-to-r ${items[index].color} bg-clip-text text-transparent font-semibold`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
        display: 'inline-block',
      }}
    >
      {items[index].text}
    </span>
  );
}

export default function HomePage() {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
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
    
    // Separate observer for stagger-cards children with lower threshold
    const cardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Animate each child with stagger
            const items = entry.target.querySelectorAll('.feature-card-item');
            items.forEach((item, i) => {
              setTimeout(() => {
                (item as HTMLElement).style.opacity = '1';
                (item as HTMLElement).style.transform = 'translateY(0)';
              }, i * 120);
            });
            cardObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.stagger-cards').forEach((el) => cardObserver.observe(el));
    
    return () => { observer.disconnect(); cardObserver.disconnect(); };
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
              className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-white rounded-full transition-all hover:shadow-lg hover:shadow-pink-500/20"
              style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}
            >
              Book Free Setup Call
            </button>
            <Link
              href="/login"
              className="hidden sm:inline-flex px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-full hover:border-slate-400 hover:text-white transition-all"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="hidden sm:inline-flex px-5 py-2 text-sm font-semibold text-white rounded-full transition-all hover:shadow-lg hover:shadow-pink-500/20"
              style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}
            >
              Get Started
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
              <button onClick={() => { setMobileMenuOpen(false); setShowDemoModal(true); }} className="flex items-center justify-center py-2.5 text-sm font-semibold text-white rounded-full transition-all" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>
                Book Free Setup Call
              </button>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center py-2.5 text-sm text-slate-300 border border-slate-600 rounded-full hover:text-white transition-all">
                Login
              </Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center py-2.5 text-sm font-semibold text-white rounded-full" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative flex items-center pt-20 sm:pt-24 pb-10 sm:pb-14 bg-gradient-to-br from-white via-pink-50/30 to-fuchsia-50/20 overflow-hidden">
        {/* Colorful floating orbs */}
        <div className="absolute top-1/4 left-1/6 w-96 h-96 bg-pink-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/6 w-80 h-80 bg-pink-200/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center w-full">
          {/* Left */}
          <div className="space-y-8 reveal-left min-w-0 overflow-hidden lg:overflow-visible">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-200 bg-pink-50 text-pink-700 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse" />
              Your competitors just got smarter. Have you?
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight text-slate-900">
                Get More Salon Bookings
                <br />
                <span style={{ color: '#25D366' }}>From WhatsApp</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-700 font-medium">
                Appointments. WhatsApp Reminders. Billing. All on Autopilot.
              </p>

              {/* Rolling text */}
              <div className="text-xl sm:text-2xl max-w-lg min-h-[36px]">
                <RollingText items={ROLLING_ITEMS} />
              </div>
            </div>

            {/* Trust pills */}
            <div className="grid grid-cols-2 gap-2 py-2">
              {[
                { icon: '⚡', label: 'Setup in 10 Minutes', sub: 'No tech skills needed' },
                { icon: '🇮🇳', label: 'Built for Indian Salons', sub: 'WhatsApp, UPI, GST-ready' },
                { icon: 'whatsapp', label: 'Book via WhatsApp', sub: 'No app download needed' },
                { icon: '🎁', label: '15-Day Free Trial', sub: 'No card required' },
              ].map(({ icon, label, sub }) => (
                <div key={label} className="flex items-center gap-2 bg-white rounded-xl px-3 py-3 border border-slate-100 shadow-sm min-w-0">
                  {icon === 'whatsapp' ? (
                    <svg className="h-5 w-5 shrink-0" fill="#25D366" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  ) : (
                    <span className="text-lg shrink-0">{icon}</span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">{label}</p>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-tight mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Benefit cards - infinite horizontal scroll marquee */}
            <div className="relative overflow-hidden lg:overflow-visible lg:w-[calc(200%+4rem)]">
              <div className="flex gap-3 benefit-marquee">
                {[
                  { icon: '🔔', title: 'Reduce No-Shows', desc: 'WhatsApp reminders before every appointment', gradient: 'from-pink-500/10 to-rose-500/5', border: 'border-pink-200/60', iconBg: 'bg-pink-100', titleColor: 'text-pink-700' },
                  { icon: '🔄', title: 'Bring Back Old Clients', desc: '30-day & 60-day win-back messages', gradient: 'from-violet-500/10 to-purple-500/5', border: 'border-violet-200/60', iconBg: 'bg-violet-100', titleColor: 'text-violet-700' },
                  { icon: '⭐', title: 'More Repeat Visits', desc: 'Feedback, memberships & rebooking nudges', gradient: 'from-amber-500/10 to-yellow-500/5', border: 'border-amber-200/60', iconBg: 'bg-amber-100', titleColor: 'text-amber-700' },
                  { icon: '🧾', title: 'Bill Faster', desc: 'GST-ready invoices in seconds', gradient: 'from-emerald-500/10 to-teal-500/5', border: 'border-emerald-200/60', iconBg: 'bg-emerald-100', titleColor: 'text-emerald-700' },
                  { icon: '📲', title: 'WhatsApp Booking', desc: 'Clients book without calling', gradient: 'from-green-500/10 to-teal-500/5', border: 'border-green-200/60', iconBg: 'bg-green-100', titleColor: 'text-green-700' },
                  { icon: '📊', title: 'Revenue Reports', desc: 'Daily, weekly & monthly insights', gradient: 'from-blue-500/10 to-indigo-500/5', border: 'border-blue-200/60', iconBg: 'bg-blue-100', titleColor: 'text-blue-700' },
                  // Duplicate for seamless loop
                  { icon: '🔔', title: 'Reduce No-Shows', desc: 'WhatsApp reminders before every appointment', gradient: 'from-pink-500/10 to-rose-500/5', border: 'border-pink-200/60', iconBg: 'bg-pink-100', titleColor: 'text-pink-700' },
                  { icon: '🔄', title: 'Bring Back Old Clients', desc: '30-day & 60-day win-back messages', gradient: 'from-violet-500/10 to-purple-500/5', border: 'border-violet-200/60', iconBg: 'bg-violet-100', titleColor: 'text-violet-700' },
                  { icon: '⭐', title: 'More Repeat Visits', desc: 'Feedback, memberships & rebooking nudges', gradient: 'from-amber-500/10 to-yellow-500/5', border: 'border-amber-200/60', iconBg: 'bg-amber-100', titleColor: 'text-amber-700' },
                  { icon: '🧾', title: 'Bill Faster', desc: 'GST-ready invoices in seconds', gradient: 'from-emerald-500/10 to-teal-500/5', border: 'border-emerald-200/60', iconBg: 'bg-emerald-100', titleColor: 'text-emerald-700' },
                  { icon: '📲', title: 'WhatsApp Booking', desc: 'Clients book without calling', gradient: 'from-green-500/10 to-teal-500/5', border: 'border-green-200/60', iconBg: 'bg-green-100', titleColor: 'text-green-700' },
                  { icon: '📊', title: 'Revenue Reports', desc: 'Daily, weekly & monthly insights', gradient: 'from-blue-500/10 to-indigo-500/5', border: 'border-blue-200/60', iconBg: 'bg-blue-100', titleColor: 'text-blue-700' },
                ].map(({ icon, title, desc, gradient, border, iconBg, titleColor }, i) => (
                  <div
                    key={i}
                    className={`relative shrink-0 w-[155px] sm:w-[175px] rounded-2xl border ${border} bg-gradient-to-br ${gradient} p-4 overflow-hidden`}
                  >
                    <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} text-lg mb-3 shadow-sm`}>
                      {icon}
                    </div>
                    <p className={`text-sm font-bold ${titleColor} leading-tight mb-1`}>{title}</p>
                    <p className="text-xs text-slate-500 leading-snug">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <button
                onClick={() => setShowDemoModal(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-violet-500 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-violet-600 transition-colors text-sm shadow-md shadow-pink-200"
              >
                Book Free Setup Call
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:border-pink-300 hover:text-pink-600 transition-all text-sm bg-white"
              >
                Start Free Trial
              </Link>
            </div>

            {/* CTA microcopy - risk reversal */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 -mt-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No credit card</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Setup in 10 mins</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> 15-day refund</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Cancel anytime</span>
            </div>

            {/* Interactive no-show loss calculator */}
            <NoShowCalculator onCta={() => setShowDemoModal(true)} />
          </div>

          {/* Right - WhatsApp Phone Mockup */}
          <div className="relative z-20 flex justify-center items-center reveal-right mt-8 lg:mt-0">
            <div className="relative">
              {/* Layered ambient glow */}
              <div className="absolute inset-0 rounded-[52px] blur-3xl scale-110" style={{ background: 'radial-gradient(ellipse, rgba(37,211,102,0.25) 0%, rgba(18,140,126,0.15) 40%, transparent 70%)' }} />
              <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl" style={{ background: 'rgba(236,72,153,0.15)' }} />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full blur-3xl" style={{ background: 'rgba(139,92,246,0.15)' }} />

              {/* iPhone 15 Pro shell */}
              <div className="relative w-[272px] h-[572px] sm:w-[282px] sm:h-[592px] lg:w-[292px] lg:h-[612px] overflow-hidden"
                style={{
                  borderRadius: '50px',
                  background: 'linear-gradient(160deg, #2a2a2a 0%, #1a1a1a 30%, #111 60%, #0d0d0d 100%)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.8), 0 50px 100px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}>

                {/* Titanium frame highlight */}
                <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: '50px', background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)', zIndex: 30 }} />

                {/* Side buttons */}
                <div className="absolute -right-[2px] top-28 h-12 w-[3px] rounded-l-full" style={{ background: 'linear-gradient(180deg, #3a3a3a, #2a2a2a)' }} />
                <div className="absolute -left-[2px] top-24 h-8 w-[3px] rounded-r-full" style={{ background: 'linear-gradient(180deg, #3a3a3a, #2a2a2a)' }} />
                <div className="absolute -left-[2px] top-36 h-8 w-[3px] rounded-r-full" style={{ background: 'linear-gradient(180deg, #3a3a3a, #2a2a2a)' }} />
                <div className="absolute -left-[2px] top-48 h-12 w-[3px] rounded-r-full" style={{ background: 'linear-gradient(180deg, #3a3a3a, #2a2a2a)' }} />

                {/* Dynamic Island */}
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-2.5"
                  style={{ width: '100px', height: '28px', background: '#000', borderRadius: '20px', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: '#1a1a1a', border: '1px solid #333' }} />
                  <div className="w-3.5 h-3.5 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #2a2a2a, #111)', border: '1px solid #333' }} />
                </div>

                {/* Screen */}
                <div className="absolute inset-0 flex flex-col" style={{ background: '#e5ddd5', paddingTop: '32px' }}>

                  {/* WhatsApp Header - authentic */}
                  <div className="shrink-0" style={{ background: 'linear-gradient(135deg, #075e54 0%, #0a7a6e 100%)', padding: '8px 12px 8px 12px' }}>
                    <div className="flex items-center gap-2">
                      <div className="relative shrink-0">
                        <div className="relative h-8 w-8 rounded-full overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)', border: '1.5px solid rgba(255,255,255,0.3)' }}>
                          <Image src="/jksalonandspalogo.png" alt="JK Salon & Spa" fill sizes="32px" className="object-cover" priority />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400" style={{ border: '2px solid #075e54' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11.5px] font-semibold text-white leading-tight">JK Salon &amp; Spa</p>
                        <p className="text-[8.5px] text-emerald-200 leading-tight">by Pixalara &middot; online</p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <svg className="w-4 h-4 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                        <svg className="w-4 h-4 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Date chip */}
                  <div className="flex justify-center py-1.5 shrink-0">
                    <span className="text-[8.5px] text-slate-500 px-3 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(4px)' }}>TODAY</span>
                  </div>

                  {/* Scroll animation - faster */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes chatScroll {
                      0%,4%   { transform: translateY(0); }
                      9%,13%  { transform: translateY(-160px); }
                      18%,22% { transform: translateY(-320px); }
                      27%,31% { transform: translateY(-480px); }
                      36%,40% { transform: translateY(-640px); }
                      45%,49% { transform: translateY(-800px); }
                      54%,58% { transform: translateY(-960px); }
                      63%,67% { transform: translateY(-1120px); }
                      72%,76% { transform: translateY(-1280px); }
                      81%,85% { transform: translateY(-1440px); }
                      90%,94% { transform: translateY(-1600px); }
                      99%,100%{ transform: translateY(0); }
                    }
                  `}} />

                  <div className="flex-1 overflow-hidden">
                    <div className="px-2 space-y-2" style={{ animation: 'chatScroll 40s cubic-bezier(0.4,0,0.2,1) infinite' }}>

                      {/* 1. Customer sends friendly message */}
                      <div className="flex justify-end">
                        <div style={{ background: 'linear-gradient(135deg, #dcf8c6, #c8f0b0)', borderRadius: '14px 14px 2px 14px', padding: '6px 10px', maxWidth: '168px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
                          <p className="text-[10.5px] text-slate-800 leading-snug">Hi! I&apos;d like to book an appointment at JK Salon &amp; Spa ✨</p>
                          <p className="text-[8px] text-slate-500 text-right mt-0.5">10:01 AM ✓✓</p>
                        </div>
                      </div>

                      {/* 2. Welcome menu */}
                      <div className="flex justify-start">
                        <div className="overflow-hidden" style={{ background: '#fff', borderRadius: '2px 14px 14px 14px', maxWidth: '210px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)' }}>
                          <div className="px-3 py-2">
                            <p className="text-[11px] font-bold text-slate-800">👋 Welcome to <span style={{ color: '#075e54' }}>JK Salon &amp; Spa</span>!</p>
                            <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">Hi Priya, how can we help you today?</p>
                            <p className="text-[8.5px] text-slate-400 italic mt-0.5">Powered by SnipandGlow</p>
                          </div>
                          <div style={{ borderTop: '1px solid #f0f0f0' }}>
                            {[['📅 Book Appointment','#25d366'],['✂️ View Services','#128c7e'],['💬 Talk to Salon','#075e54']].map(([label,color]) => (
                              <div key={label} className="px-3 py-1.5 text-center" style={{ borderBottom: '1px solid #f5f5f5' }}>
                                <p className="text-[10px] font-semibold" style={{ color }}>{label}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-[8px] text-slate-400 text-right px-3 pb-1">10:01 AM</p>
                        </div>
                      </div>

                      {/* 3. Customer taps Book */}
                      <div className="flex justify-end">
                        <div style={{ background: 'linear-gradient(135deg, #dcf8c6, #c8f0b0)', borderRadius: '14px 14px 2px 14px', padding: '6px 10px', maxWidth: '140px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
                          <p className="text-[10.5px] text-slate-800">📅 Book Appointment</p>
                          <p className="text-[8px] text-slate-500 text-right mt-0.5">10:02 AM ✓✓</p>
                        </div>
                      </div>

                      {/* 4. WhatsApp Flow form */}
                      <div className="flex justify-start">
                        <div className="overflow-hidden" style={{ background: '#fff', borderRadius: '2px 14px 14px 14px', maxWidth: '210px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: '1px solid rgba(37,211,102,0.15)' }}>
                          <div className="px-3 py-2" style={{ background: 'linear-gradient(135deg, #075e54, #0a7a6e)' }}>
                            <p className="text-[10.5px] font-bold text-white">📋 Book Your Appointment</p>
                            <p className="text-[8.5px] text-emerald-200">JK Salon &amp; Spa</p>
                          </div>
                          <div className="px-2.5 py-2 space-y-1.5">
                            {[['Services','✅ Haircut + Facial'],['Date','📅 Thu, 22 May 2026'],['Time','⏰ 2:30 PM']].map(([label,val]) => (
                              <div key={label} className="rounded-lg px-2 py-1.5" style={{ background: '#f8f8f8', border: '1px solid #ebebeb' }}>
                                <p className="text-[7.5px] text-slate-400 uppercase tracking-wider">{label}</p>
                                <p className="text-[10px] text-slate-800 font-semibold">{val}</p>
                              </div>
                            ))}
                            <div className="rounded-lg py-1.5 text-center" style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)', boxShadow: '0 2px 6px rgba(37,211,102,0.3)' }}>
                              <p className="text-[10.5px] text-white font-bold">✓ Confirm Booking</p>
                            </div>
                          </div>
                          <p className="text-[8px] text-slate-400 text-right px-3 pb-1">10:02 AM</p>
                        </div>
                      </div>

                      {/* 5. Booking Confirmed */}
                      <div className="flex justify-start">
                        <div className="overflow-hidden" style={{ background: '#fff', borderRadius: '2px 14px 14px 14px', maxWidth: '210px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid rgba(37,211,102,0.2)' }}>
                          <div className="px-3 py-1.5" style={{ background: 'linear-gradient(135deg, #e8fdf0, #d0f7e0)' }}>
                            <p className="text-[11px] font-bold text-emerald-800">✅ Booking Confirmed!</p>
                          </div>
                          <div className="px-3 py-2 space-y-0.5">
                            {[['👤','Priya Sharma'],['✂️','Haircut, Facial'],['📅','22 May 2026, 2:30 PM'],['📍','JK Salon & Spa']].map(([icon,val]) => (
                              <div key={val} className="flex items-center gap-1.5">
                                <span className="text-[9px]">{icon}</span>
                                <p className="text-[10px] text-slate-700">{val}</p>
                              </div>
                            ))}
                            <div className="rounded-md px-2 py-1 mt-1" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                              <p className="text-[9px] text-emerald-700 font-medium">📲 Add to Google Calendar →</p>
                            </div>
                          </div>
                          <div style={{ borderTop: '1px solid #f0f0f0', display: 'flex' }}>
                            <div className="flex-1 py-1.5 text-center" style={{ borderRight: '1px solid #f0f0f0' }}>
                              <p className="text-[9.5px] font-semibold text-amber-600">📅 Reschedule</p>
                            </div>
                            <div className="flex-1 py-1.5 text-center">
                              <p className="text-[9.5px] font-semibold text-red-500">✕ Cancel</p>
                            </div>
                          </div>
                          <p className="text-[8px] text-slate-400 text-right px-3 pb-1">10:03 AM</p>
                        </div>
                      </div>

                      {/* 6. Bill Receipt */}
                      <div className="flex justify-start">
                        <div className="overflow-hidden" style={{ background: '#fff', borderRadius: '2px 14px 14px 14px', maxWidth: '210px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid rgba(139,92,246,0.15)' }}>
                          <div className="px-3 py-1.5" style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)' }}>
                            <p className="text-[10.5px] font-bold text-violet-800">🧾 Bill Receipt</p>
                            <p className="text-[8.5px] text-violet-500">Invoice INV-SEE-0015</p>
                          </div>
                          <div className="px-2.5 py-2">
                            <p className="text-[10px] text-slate-600 mb-1.5">Hi Priya, thank you for visiting! 😊</p>
                            <div className="rounded-lg p-1.5 space-y-0.5" style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}>
                              <div className="flex justify-between text-[9.5px]"><span className="text-slate-500">Haircut</span><span className="font-semibold text-slate-800">Rs.300</span></div>
                              <div className="flex justify-between text-[9.5px]"><span className="text-slate-500">Facial</span><span className="font-semibold text-slate-800">Rs.800</span></div>
                              <div className="flex justify-between text-[9.5px] text-amber-600"><span>👑 Membership (20%)</span><span>-Rs.220</span></div>
                              <div className="flex justify-between text-[10px] font-bold text-emerald-700 pt-0.5" style={{ borderTop: '1px solid #e8e8e8' }}><span>Total</span><span>Rs.880</span></div>
                            </div>
                            <div className="rounded-md px-2 py-1 mt-1.5" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                              <p className="text-[9px] text-emerald-700 font-semibold">💡 Next time, skip the wait!</p>
                              <p className="text-[8.5px] text-emerald-600">Book in advance via WhatsApp →</p>
                            </div>
                          </div>
                          <p className="text-[8px] text-slate-400 text-right px-3 pb-1">5:30 PM</p>
                        </div>
                      </div>

                      {/* 7. Feedback request */}
                      <div className="flex justify-start">
                        <div className="overflow-hidden" style={{ background: '#fff', borderRadius: '2px 14px 14px 14px', maxWidth: '210px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
                          <div className="px-3 py-1.5" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)' }}>
                            <p className="text-[10.5px] font-bold text-amber-800">⭐ How was your experience?</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-[10px] text-slate-600 mb-1.5">Your feedback helps us serve you better:</p>
                            <div style={{ borderTop: '1px solid #f0f0f0' }}>
                              {[['⭐⭐⭐⭐⭐ Loved it!','#f59e0b'],['⭐⭐⭐ It was okay','#6b7280'],['😞 Not satisfied','#ef4444']].map(([label,color]) => (
                                <div key={label} className="px-3 py-1.5 text-center" style={{ borderBottom: '1px solid #f8f8f8' }}>
                                  <p className="text-[9.5px] font-semibold" style={{ color }}>{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <p className="text-[8px] text-slate-400 text-right px-3 pb-1">5:31 PM</p>
                        </div>
                      </div>

                      {/* 8. Customer gives 5 stars */}
                      <div className="flex justify-end">
                        <div style={{ background: 'linear-gradient(135deg, #dcf8c6, #c8f0b0)', borderRadius: '14px 14px 2px 14px', padding: '6px 10px', maxWidth: '140px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
                          <p className="text-[12px] text-slate-800">⭐⭐⭐⭐⭐ Loved it!</p>
                          <p className="text-[8px] text-slate-500 text-right mt-0.5">5:32 PM ✓✓</p>
                        </div>
                      </div>

                      {/* 9. Thank you */}
                      <div className="flex justify-start">
                        <div className="px-3 py-2" style={{ background: '#fff', borderRadius: '2px 14px 14px 14px', maxWidth: '210px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.05)' }}>
                          <p className="text-[10px] text-slate-700 leading-snug">🎉 Thank you for the 5-star rating! We&apos;re thrilled you loved your experience at <span className="font-bold" style={{ color: '#075e54' }}>JK Salon &amp; Spa</span>. See you again! 💇</p>
                          <p className="text-[8px] text-slate-400 text-right mt-1">5:32 PM</p>
                        </div>
                      </div>

                      {/* 10. 30-day reminder */}
                      <div className="flex justify-start">
                        <div className="overflow-hidden" style={{ background: '#fff', borderRadius: '2px 14px 14px 14px', maxWidth: '210px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                          <div className="px-3 py-1.5" style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)' }}>
                            <p className="text-[10.5px] font-bold text-violet-800">💜 Time for a Touch-Up!</p>
                            <p className="text-[8.5px] text-violet-500">30 days since last visit</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-[10px] text-slate-600 leading-snug mb-1.5">Hi Priya! Your hair is due for a refresh ✨ Book your next appointment now!</p>
                            <div className="rounded-lg py-1.5 text-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 2px 6px rgba(124,58,237,0.3)' }}>
                              <p className="text-[10px] text-white font-bold">📅 Book Now</p>
                            </div>
                          </div>
                          <p className="text-[8px] text-slate-400 text-right px-3 pb-1">Jun 21, 10:00 AM</p>
                        </div>
                      </div>

                      {/* 11. 60-day win-back */}
                      <div className="flex justify-start">
                        <div className="overflow-hidden" style={{ background: '#fff', borderRadius: '2px 14px 14px 14px', maxWidth: '210px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: '1px solid rgba(236,72,153,0.2)' }}>
                          <div className="px-3 py-1.5" style={{ background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)' }}>
                            <p className="text-[10.5px] font-bold text-pink-800">💖 We Miss You, Priya!</p>
                            <p className="text-[8.5px] text-pink-500">60 days since last visit</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-[10px] text-slate-600 leading-snug mb-1.5">It&apos;s been 2 months - come back for some self-care! We have a special offer just for you 🎁</p>
                            <div className="rounded-lg p-2 text-center mb-1.5" style={{ background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', border: '1px solid rgba(236,72,153,0.25)' }}>
                              <p className="text-[14px] font-black text-pink-600">15% OFF</p>
                              <p className="text-[8.5px] text-slate-500">Code: <span className="font-bold text-slate-700">MISSYOU15</span></p>
                            </div>
                            <div style={{ borderTop: '1px solid #f0f0f0', display: 'flex', gap: '0' }}>
                              <div className="flex-1 py-1.5 text-center" style={{ borderRight: '1px solid #f0f0f0' }}>
                                <p className="text-[9.5px] font-bold text-pink-600">🎁 Claim Offer</p>
                              </div>
                              <div className="flex-1 py-1.5 text-center">
                                <p className="text-[9.5px] font-semibold text-blue-500">✂️ Services</p>
                              </div>
                            </div>
                          </div>
                          <p className="text-[8px] text-slate-400 text-right px-3 pb-1">Jul 21, 11:00 AM</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Input bar - authentic iPhone WhatsApp */}
                  <div className="shrink-0 px-2 py-1.5 flex items-center gap-1.5" style={{ background: '#f0f0f0' }}>
                    <div className="flex items-center justify-center w-7 h-7 rounded-full" style={{ background: '#e0e0e0' }}>
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                    </div>
                    <div className="flex-1 bg-white rounded-full h-7 flex items-center px-3" style={{ border: '1px solid #e0e0e0' }}>
                      <p className="text-[10px] text-slate-400">Type a message</p>
                    </div>
                    <div className="flex items-center justify-center w-7 h-7 rounded-full" style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)', boxShadow: '0 2px 6px rgba(37,211,102,0.4)' }}>
                      <ArrowRight className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </div>
              </div>



              {/* Floating badge - bottom left (hidden on mobile) */}
              <div className="hidden lg:block absolute -bottom-6 -left-16 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-lg shadow-slate-200/60">
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

              {/* Floating badge - top right (hidden on mobile) */}
              <div className="hidden lg:block absolute -top-6 -right-16 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-lg shadow-slate-200/60">
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

      {/* ===== TRUST BAR ===== */}
      <section className="py-6 sm:py-8 bg-white border-y border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-5">
            <p className="text-center text-sm sm:text-base font-semibold text-slate-700">
              Trusted by <span className="text-pink-600">500+ salons &amp; spas</span> across India
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-x-10">
              {[
                { icon: '🇮🇳', label: 'Made in India' },
                { icon: '🏛️', label: 'DPIIT Recognized Startup' },
                { icon: '💬', label: 'Built on WhatsApp Business' },
                { icon: '🔒', label: 'AES-256 Encrypted' },
                { icon: '🧾', label: 'GST-Ready Billing' },
              ].map(({ icon, label }) => (
                <div key={label} className="inline-flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <span className="text-xs sm:text-sm font-medium text-slate-600">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-1">
              {[
                { value: 500, suffix: '+', label: 'Active salons' },
                { value: 12, suffix: '+', label: 'Cities across India' },
                { value: 2, suffix: 'L+', label: 'WhatsApp messages sent' },
                { value: 70, suffix: '%', label: 'Fewer no-shows' },
              ].map(({ value, suffix, label }) => (
                <div key={label} className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-slate-900">
                    <AnimatedNumber value={value} suffix={suffix} />
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== EFFORTLESS BOOKINGS VIA WHATSAPP ===== */}
      <section className="py-10 sm:py-16 bg-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left - Image */}
            <div className="relative reveal-left">
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/60 card-float">
                <img
                  src="/qr-booking.png"
                  alt="Customer scanning QR code to book appointment via WhatsApp"
                  className="w-full h-[350px] sm:h-[420px] object-cover"
                  loading="lazy"
                />
              </div>
              {/* Floating stat card */}
              <div className="absolute -bottom-4 -right-4 sm:bottom-6 sm:right-6 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-lg card-float-delayed">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">70% fewer no-shows</p>
                    <p className="text-[10px] text-slate-500">With WhatsApp reminders</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Content */}
            <div className="reveal-right">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
                Effortless Bookings via{' '}
                <span className="text-emerald-600">WhatsApp</span>
              </h2>
              <p className="text-slate-500 mt-4 text-base leading-relaxed max-w-lg">
                Positioned as an affordable, WhatsApp-first utility for Indian salon owners, focusing on ease of use and practical automation over complex technical setups.
              </p>

              {/* Feature list */}
              <div className="mt-8 space-y-6 stagger-cards">
                {[
                  {
                    icon: '📅',
                    title: 'Smart Appointments',
                    desc: 'Online booking system with instant WhatsApp confirmation that allows clients to reschedule or cancel with a tap.',
                  },
                  {
                    icon: '🤖',
                    title: 'WhatsApp Automation',
                    desc: 'Automated delivery of booking confirmations, 24-hour reminders, and re-booking nudges to reduce no-shows.',
                  },
                  {
                    icon: '📢',
                    title: 'WhatsApp Marketing & Broadcasts',
                    desc: 'One-click messaging for birthday wishes, festival offers, flash sales, and win-back campaigns.',
                  },
                  {
                    icon: '⭐',
                    title: 'Instant Feedback Collection',
                    desc: 'Automatically request ratings after every visit. 5-star reviews get redirected to Google. Low ratings alert you instantly.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 feature-card-item">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-slate-500">
                Read our full guide on{' '}
                <a href="/salon-whatsapp-marketing" className="text-emerald-600 hover:underline font-medium">WhatsApp marketing for salons</a>
                {' '}and{' '}
                <a href="/spa-whatsapp-marketing" className="text-emerald-600 hover:underline font-medium">WhatsApp marketing for spas</a>.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="py-10 sm:py-16 bg-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left - Content */}
            <div className="reveal-left">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
                Build Unbreakable{' '}
                <span className="text-violet-600">Loyalty</span>
              </h2>
              <p className="text-slate-500 mt-4 text-base leading-relaxed max-w-lg">
                Turn walk-ins into regulars. Capture leads, gather feedback, and reward your best clients automatically.
              </p>

              {/* Feature list */}
              <div className="mt-8 space-y-6 stagger-cards">
                {[
                  {
                    icon: '👑',
                    title: 'Membership & Loyalty Programs',
                    desc: 'Creation of membership plans with automated discounts and reward systems to increase repeat visits.',
                  },
                  {
                    icon: '⭐',
                    title: 'Automated Customer Feedback',
                    desc: 'Collection of ratings via WhatsApp after every visit to monitor service quality and boost online reviews.',
                  },
                  {
                    icon: '🎯',
                    title: 'Lead Management',
                    desc: 'System to capture and track leads from walk-ins, social media, and referrals to convert them into loyal customers.',
                  },
                  {
                    icon: '🎁',
                    title: 'Win-Back Campaigns',
                    desc: 'Automated 30-day and 60-day reminders with special offers to bring back inactive customers.',
                    pro: true,
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 feature-card-item">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-lg">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        {item.title}
                        {(item as { pro?: boolean }).pro && (
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">Pro</span>
                        )}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-slate-500">
                Learn how to set up a{' '}
                <a href="/salon-membership-program" className="text-violet-600 hover:underline font-medium">salon membership program with WhatsApp renewal reminders</a>
                {' '}and see how{' '}
                <a href="/salon-staff-scheduling" className="text-violet-600 hover:underline font-medium">salon staff scheduling</a>
                {' '}keeps your team organised.
              </p>
            </div>

            {/* Right - Image grid */}
            <div className="grid grid-cols-2 gap-3 reveal-right">
              <div className="rounded-2xl overflow-hidden shadow-lg card-float">
                <img
                  src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=500&fit=crop&q=80"
                  alt="Happy salon client getting hair styled"
                  className="w-full h-[240px] sm:h-[280px] object-cover"
                  loading="lazy"
                />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl overflow-hidden shadow-lg card-float-delayed">
                  <img
                    src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=240&fit=crop&q=80"
                    alt="Spa hot stone massage treatment"
                    className="w-full h-[130px] sm:h-[135px] object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="rounded-2xl overflow-hidden shadow-lg card-float-delayed-2">
                  <img
                    src="https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=400&h=240&fit=crop&q=80"
                    alt="Loyal customer at salon reception"
                    className="w-full h-[100px] sm:h-[135px] object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ANALYTICS & DASHBOARD ===== */}
      <section className="py-10 sm:py-16 bg-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left - Image */}
            <div className="relative reveal-left">
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-200/60 card-float">
                <img
                  src="https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=800&h=600&fit=crop&q=80"
                  alt="Modern salon interior with styling stations"
                  className="w-full h-[350px] sm:h-[420px] object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Right - Content */}
            <div className="reveal-right">
              <div className="space-y-8 stagger-cards">
                {/* Analytics Dashboard */}
                <div className="pb-8 feature-card-item" style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Analytics Dashboard</h3>
                  <p className="text-slate-500 text-base leading-relaxed mb-4">
                    Visual reporting on revenue trends, top services, staff performance, and retention metrics.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Revenue analytics',
                      'Appointment trends',
                      'Staff performance',
                      'Customer retention',
                      'Service popularity',
                      'Expense tracking',
                      'Payroll management',
                      'Product inventory & retail',
                      'Audit trails',
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        <span className="text-sm text-slate-600">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Free Setup & Onboarding */}
                <div className="feature-card-item">
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #ec4899, #be185d)' }}>
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">Free Setup &amp; Onboarding</h3>
                  <p className="text-slate-500 text-base leading-relaxed">
                    Complimentary training and platform configuration to help salons get started in under 10 minutes. Our team handles everything from data import to WhatsApp API setup.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS (TIMELINE) ===== */}
      <section id="how-it-works" className="py-10 sm:py-16 relative" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 15%, #f8fafc 85%, #ffffff 100%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-8 reveal">
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
                    <p className="text-sm font-semibold text-slate-900">Snip and Glow by Pixalara</p>
                    <p className="text-xs text-slate-500">3 staff - 12 services</p>
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
                        <p className="text-xs text-slate-500">{appt.service} - {appt.time}</p>
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
      <section className="py-10 sm:py-16 relative" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fffbfe 50%, #ffffff 100%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-8 reveal">
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

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-12 sm:py-20 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fdf2f8 50%, #ffffff 100%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-10 reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600 mb-3">Loved by salon owners</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">Real salons. Real results.</h2>
            <div className="flex items-center justify-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-amber-400" fill="currentColor" />
                ))}
              </div>
              <span className="text-sm font-semibold text-slate-700">4.9/5</span>
              <span className="text-sm text-slate-500">from 200+ salon owners</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 reveal">
            {[
              {
                name: 'Neha Thakur', salon: 'Glow & Grace Salon', city: 'Shimla',
                initials: 'NT', color: 'bg-pink-100 text-pink-700',
                quote: 'Half my clients used to forget their slots in tourist season. The automatic WhatsApp reminders cut our no-shows by almost 70% in the first month. Setup was done for us in a single afternoon.',
                metric: 'No-shows down ~70%',
              },
              {
                name: 'Rohan Mehta', salon: 'Urban Mane Studio', city: 'Bangalore',
                initials: 'RM', color: 'bg-violet-100 text-violet-700',
                quote: 'We tried two expensive Western tools before this. SnipandGlow is WhatsApp-first, which is exactly how our clients book. Billing and GST invoices that used to take an hour now take seconds.',
                metric: 'Saves 3 hrs/day',
              },
              {
                name: 'Pooja Sharma', salon: 'Roop Sundari Beauty Lounge', city: 'Jaipur',
                initials: 'PS', color: 'bg-fuchsia-100 text-fuchsia-700',
                quote: 'The festival broadcast campaigns are a game changer. One Teej offer message to our customer list filled the whole weekend. We made back the yearly cost in a single campaign.',
                metric: '1 campaign = booked weekend',
              },
              {
                name: 'Sandeep Verma', salon: 'Trends Unisex Salon', city: 'Hisar',
                initials: 'SV', color: 'bg-emerald-100 text-emerald-700',
                quote: 'In a small town, trust matters. Clients love booking on WhatsApp without calling, and the confirmation message looks professional. My walk-ins now turn into regulars.',
                metric: 'More repeat clients',
              },
              {
                name: 'Sai Priya', salon: 'Mirror Image Salon & Spa', city: 'Hyderabad',
                initials: 'SP', color: 'bg-amber-100 text-amber-700',
                quote: 'The membership and win-back automation keeps our chairs full on slow days. Inactive clients get a gentle nudge after 30 days and a good number come right back.',
                metric: '+28% retention',
              },
              {
                name: 'Aanya Kapoor', salon: 'The Bombay Cut', city: 'South Delhi',
                initials: 'AK', color: 'bg-blue-100 text-blue-700',
                quote: 'My premium clients expect a polished experience. Branded WhatsApp messages from our own number, instant invoices, and 5-star reviews going straight to Google — it all just runs on autopilot.',
                metric: 'More 5★ Google reviews',
              },
            ].map((t) => (
              <div key={t.name} className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow reveal-scale">
                <div className="flex mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-amber-400" fill="currentColor" />
                  ))}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="inline-flex items-center self-start gap-1.5 mt-4 mb-4 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <TrendingUp className="h-3.5 w-3.5" /> {t.metric}
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-sm ${t.color}`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      {t.salon} <span className="text-slate-300">·</span> <MapPin className="h-3 w-3" /> {t.city}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BEFORE VS AFTER ===== */}
      <section className="py-16 sm:py-24 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #0f172a 6%, #0f172a 94%, #ffffff 100%)' }}>
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[800px] h-[400px] rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(ellipse, #ec4899 0%, #8b5cf6 50%, transparent 70%)' }} />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          {/* Header */}
          <div className="text-center mb-12 reveal">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-4 py-1.5 mb-5">
              <span className="text-xs font-semibold uppercase tracking-widest bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">The Difference</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">Running a salon, before and after</h2>
            <p className="text-slate-400 text-sm sm:text-base">See exactly what changes when you switch to SnipandGlow</p>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-4 reveal">
            <div className="flex items-center gap-2 sm:gap-2.5 rounded-2xl border border-red-900/40 bg-red-950/30 px-3 sm:px-5 py-3">
              <span className="text-lg sm:text-xl shrink-0">😓</span>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[10px] font-semibold uppercase tracking-widest text-red-400">Before</p>
                <p className="text-xs sm:text-sm font-bold text-red-300">The old way</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-2.5 rounded-2xl border border-emerald-700/40 bg-emerald-950/30 px-3 sm:px-5 py-3">
              <span className="text-lg sm:text-xl shrink-0">✨</span>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[10px] font-semibold uppercase tracking-widest text-emerald-400 truncate">After SnipandGlow</p>
                <p className="text-xs sm:text-sm font-bold text-emerald-300">The smart way</p>
              </div>
            </div>
          </div>

          {/* Comparison rows */}
          <div className="space-y-2.5 sm:space-y-3 reveal">
            {[
              { before: 'Manual calls to book', after: 'Auto WhatsApp booking - 24/7' },
              { before: 'Missed WhatsApp messages', after: 'Auto reminders - zero no-shows' },
              { before: 'Forgotten appointments', after: 'Full customer CRM & history' },
              { before: 'No customer records', after: 'Billing and payments tracked' },
              { before: 'No follow-up after visit', after: 'Win-back campaigns on autopilot' },
            ].map(({ before, after }, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:gap-4">
                {/* Before */}
                <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-red-900/30 bg-slate-900/60 px-3 sm:px-4 py-3 group hover:border-red-800/50 transition-colors">
                  <div className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-red-900/50">
                    <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <span className="text-xs sm:text-sm text-slate-400 leading-snug">{before}</span>
                </div>
                {/* After */}
                <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-3 sm:px-4 py-3 group hover:border-emerald-700/60 transition-colors">
                  <div className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-emerald-900/60">
                    <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span className="text-xs sm:text-sm text-emerald-300 font-medium leading-snug">{after}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-10 reveal">
            <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 text-white font-semibold text-sm hover:from-pink-600 hover:to-violet-600 transition-colors shadow-lg shadow-pink-500/20">
              Switch to the smart way
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section id="features" className="pt-16 pb-8 sm:pt-24 sm:pb-12 relative" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 15%, #f8fafc 85%, #ffffff 100%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-8 reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600 mb-3">Features</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">Everything your salon needs</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">One platform. No juggling apps.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[
              { icon: Calendar, title: 'Smart Appointments', desc: 'Online booking with instant WhatsApp confirmation. Clients can reschedule or cancel with a tap.', color: 'bg-pink-100 text-pink-600' },
              { icon: MessageCircle, title: 'WhatsApp Automation', desc: 'Booking confirmations, 24h reminders, and re-booking nudges - all sent automatically.', color: 'bg-green-100 text-green-600' },
              { icon: FileText, title: 'Billing & Invoices', desc: 'Generate GST-ready invoices in seconds. Track payments and outstanding dues effortlessly.', color: 'bg-fuchsia-100 text-fuchsia-600' },
              { icon: Package, title: 'Product Inventory', desc: 'Track retail products, stock levels, and purchase costs. Sell products on any bill — stock updates automatically.', color: 'bg-teal-100 text-teal-600' },
              { icon: Users, title: 'Client Management', desc: 'Full client history, visit notes, preferences, and loyalty points in one place.', color: 'bg-violet-100 text-violet-600' },
              { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Revenue trends, top services, staff performance, and retention metrics at a glance.', color: 'bg-purple-100 text-purple-600' },
              { icon: Zap, title: 'Smart Automation', desc: 'Auto-reminders, birthday wishes, win-back campaigns - all running on autopilot while you focus on clients.', color: 'bg-pink-100 text-pink-600' },
              { icon: Wallet, title: 'Expense & Payroll', desc: 'Track all salon expenses, manage staff salaries, bonuses, and deductions in one place.', color: 'bg-amber-100 text-amber-600' },
              { icon: Target, title: 'Lead Management', desc: 'Capture leads from walk-ins, social media & referrals. Track follow-ups and convert them into loyal customers.', color: 'bg-blue-100 text-blue-600' },
              { icon: Shield, title: 'Membership & Loyalty', desc: 'Create membership plans with auto-discounts. Reward loyal customers and increase repeat visits.', color: 'bg-emerald-100 text-emerald-600' },
              { icon: Star, title: 'Customer Feedback', desc: 'Auto-collect ratings via WhatsApp after every visit. 5★ reviews go to Google, low ratings alert you instantly.', color: 'bg-amber-100 text-amber-600' },
              { icon: Headphones, title: '24hr Support', desc: 'Report any issue from the dashboard. Our team responds within 24 hours on WhatsApp. No chatbots, real humans.', color: 'bg-indigo-100 text-indigo-600' },
              { icon: FileText, title: 'Audit Trails', desc: 'Track every action - who did what and when. Full transparency for billing, appointments, and staff activity.', color: 'bg-slate-100 text-slate-600' },
              { icon: Megaphone, title: 'WhatsApp Broadcast', desc: 'Send birthday wishes, festival offers, flash sales & win-back campaigns to all customers with one click.', color: 'bg-green-100 text-green-600' },
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

      {/* ===== COMPARISON TABLE ===== */}
      <section className="py-12 sm:py-20 relative" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%)' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-10 reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600 mb-3">Why switch</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">SnipandGlow vs the old way</h2>
            <p className="text-slate-500 text-sm sm:text-base max-w-2xl mx-auto">See how an all-in-one WhatsApp platform compares to registers and generic salon software.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm reveal">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-4 sm:px-6 text-xs sm:text-sm font-semibold text-slate-500">What you get</th>
                  <th className="px-2 py-4 sm:px-4 text-center">
                    <span className="block text-sm sm:text-base font-bold bg-gradient-to-r from-pink-600 to-violet-600 bg-clip-text text-transparent">SnipandGlow</span>
                  </th>
                  <th className="px-2 py-4 sm:px-4 text-center text-xs sm:text-sm font-semibold text-slate-500">Pen &amp; Register</th>
                  <th className="px-2 py-4 sm:px-4 text-center text-xs sm:text-sm font-semibold text-slate-500">Generic Software</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'WhatsApp booking & confirmations', us: true, register: false, generic: 'partial' },
                  { feature: 'Automatic no-show reminders', us: true, register: false, generic: 'partial' },
                  { feature: 'GST-ready billing & UPI tracking', us: true, register: false, generic: 'partial' },
                  { feature: 'Marketing broadcasts (festivals, win-back)', us: true, register: false, generic: false },
                  { feature: 'Free done-for-you setup', us: true, register: false, generic: false },
                  { feature: 'Built for Indian salons', us: true, register: 'partial', generic: false },
                  { feature: 'Multi-branch management', us: true, register: false, generic: 'partial' },
                  { feature: 'Monthly cost', us: 'text:From ₹799', register: 'text:Your time', generic: 'text:₹3,000–5,000' },
                ].map((row) => (
                  <tr key={row.feature} className="border-t border-slate-100">
                    <td className="px-3 py-3.5 sm:px-6 text-xs sm:text-sm font-medium text-slate-700">{row.feature}</td>
                    {(['us', 'register', 'generic'] as const).map((col) => {
                      const val = row[col];
                      const isUs = col === 'us';
                      return (
                        <td key={col} className={`px-2 py-3.5 sm:px-4 text-center ${isUs ? 'bg-pink-50/40' : ''}`}>
                          {typeof val === 'string' && val.startsWith('text:') ? (
                            <span className={`text-xs sm:text-sm font-semibold ${isUs ? 'text-pink-700' : 'text-slate-500'}`}>{val.slice(5)}</span>
                          ) : val === true ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                          ) : val === 'partial' ? (
                            <span className="text-amber-500 text-lg leading-none" title="Limited">~</span>
                          ) : (
                            <X className="h-4 w-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-slate-400 mt-4">✓ Included &nbsp;·&nbsp; ~ Limited / costs extra &nbsp;·&nbsp; ✕ Not available</p>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="pt-12 pb-8 sm:pt-20 sm:pb-12 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #fafafa 0%, #ffffff 50%, #fafafa 100%)' }}>
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(0 0 0) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16 reveal">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-50 to-violet-50 border border-pink-100 mb-4">
              <span className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-violet-600">PRICING</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
              Choose your plan
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Start with Essentials. Step up to Pro for your own WhatsApp API. Scale to Growth for multi-branch mastery.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto reveal">

            {/* ── ESSENTIALS ─────────────────────────────────── */}
            <div className="relative flex flex-col rounded-3xl overflow-hidden border border-pink-200 bg-gradient-to-b from-pink-50 to-white shadow-md hover:shadow-xl transition-shadow duration-300">
              {/* Top badge */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-rose-400 blur-lg opacity-50" />
                <div className="relative bg-gradient-to-r from-pink-500 to-rose-400 text-white text-[11px] font-extrabold tracking-widest uppercase text-center py-2">
                  MOST POPULAR
                </div>
              </div>

              <div className="grid grid-rows-[auto_auto_auto_1fr] p-8 sm:p-10 h-full">
                {/* Row 1 - Header (description grows) */}
                <div className="mb-8 flex flex-col">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-400 shadow-lg shadow-pink-400/30 mb-4">
                    <Scissors className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-1">Essentials</h3>
                  <p className="text-sm text-slate-500 font-medium">For single-location salons</p>
                  <p className="text-slate-600 text-sm leading-relaxed mt-3 flex-1">
                    Complete salon management with WhatsApp automation. Perfect for independent salons getting started digitally.
                  </p>
                </div>

                {/* Row 2 - Pricing */}
                <div className="mb-8 pb-8 border-b border-pink-100">
                  <p className="text-sm text-slate-400 line-through mb-1">₹999/month</p>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-5xl font-extrabold text-slate-900 tracking-tight">₹799</span>
                    <span className="text-base text-slate-500 font-medium">/month</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">₹9,588/year &nbsp;·&nbsp; 15-day free trial &nbsp;·&nbsp; Cancel anytime</p>
                </div>

                {/* Row 3 - CTA */}
                <Link
                  href="/signup"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all shadow-md hover:shadow-lg mb-8"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>

                {/* Row 4 - Features */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-pink-500 mb-3">Everything you need</p>
                  {[
                    { title: 'Core Operations', desc: 'Appointments, billing, staff, expenses & payroll' },
                    { title: 'Up to 5 Staff Logins', desc: 'Give 5 team members their own secure dashboard access' },
                    { title: 'Customer Management', desc: 'Loyalty tiers, memberships & visit history' },
                    { title: 'Product Inventory', desc: 'Track retail products, stock levels and sell them on any bill' },
                    { title: 'WhatsApp Automation', desc: 'Confirmations, reminders & feedback' },
                    { title: 'Zero WhatsApp Costs', desc: 'All Meta conversation charges are covered by SnipandGlow - you pay nothing extra' },
                    { title: 'Analytics & Reports', desc: 'Revenue, insights & staff performance dashboard' },
                    { title: 'WhatsApp Booking', desc: 'Clients book via WhatsApp, QR code or booking link - no app download needed' },
                    { title: 'Support & Security', desc: 'In-app tickets, audit logs & 24hr response' },
                  ].map(({ title, desc }) => (
                    <div key={title} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-100">
                        <CheckCircle2 className="h-3 w-3 text-pink-600" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{title}</p>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}

                  <div className="pt-5 mt-5 border-t border-pink-100 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Not included</p>
                    {['Own WhatsApp Business API', 'Marketing broadcasts', 'Win-back campaigns (30 & 60 day)', 'Multi-branch management'].map((f) => (
                      <div key={f} className="flex items-center gap-2.5">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100">
                          <span className="text-slate-400 text-[10px] font-bold">✕</span>
                        </span>
                        <span className="text-xs text-slate-400">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── PRO ────────────────────────────────────────── */}
            <div className="relative flex flex-col rounded-3xl overflow-hidden shadow-2xl shadow-violet-900/40">
              {/* Solid dark background */}
              <div className="absolute inset-0 bg-gradient-to-b from-violet-950 via-violet-900 to-slate-900" />
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/15 via-transparent to-pink-500/10 pointer-events-none" />

              {/* Top badge */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-pink-500 blur-lg opacity-60" />
                <div className="relative bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[11px] font-extrabold tracking-widest uppercase text-center py-2">
                  BEST VALUE
                </div>
              </div>

              <div className="relative grid grid-rows-[auto_auto_auto_1fr] p-8 sm:p-10 h-full">
                {/* Row 1 - Header */}
                <div className="mb-8 flex flex-col">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-400 to-pink-500 shadow-lg shadow-violet-500/40 mb-4">
                    <Smartphone className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">Pro</h3>
                  <p className="text-sm text-violet-300 font-medium">For single-branch growth</p>
                  <p className="text-slate-300 text-sm leading-relaxed mt-3 flex-1">
                    Everything in Essentials, plus your own WhatsApp Business API - single branch, full branding and marketing broadcasts.
                  </p>
                </div>

                {/* Row 2 - Pricing */}
                <div className="mb-8 pb-8 border-b border-violet-700/50">
                  <p className="text-sm text-violet-400 line-through mb-1">₹1,999/month</p>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-5xl font-extrabold text-white tracking-tight">₹1,199</span>
                    <span className="text-base text-slate-400 font-medium">/month</span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">₹14,388/year &nbsp;·&nbsp; Single branch &nbsp;·&nbsp; Billed yearly</p>
                </div>

                {/* Row 3 - CTA */}
                <button
                  onClick={() => setShowContactModal(true)}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-violet-50 active:scale-[0.98] transition-all shadow-lg hover:shadow-xl mb-8"
                >
                  Contact Sales
                  <ArrowRight className="h-4 w-4" />
                </button>

                {/* Row 4 - Features */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-3">Everything in Essentials, plus</p>
                  {[
                    { title: 'WhatsApp API Setup - one-time fee ₹3,500', desc: 'Meta verification, number registration & template approvals' },
                    { title: 'Up to 10 Staff Logins', desc: 'Double the team access of Essentials - 10 members with their own dashboards' },
                    { title: 'Own WhatsApp Business API', desc: 'Your phone number, your branding, full control' },
                    { title: 'WhatsApp Marketing Broadcasts', desc: 'Festival offers, birthdays, flash sales & win-back campaigns' },
                    { title: 'Win-Back Campaigns', desc: 'Automated 30-day & 60-day reminders with special offers to bring back inactive customers' },
                    { title: '50+ Marketing Templates', desc: 'Pre-approved for every occasion, ready to use' },
                    { title: 'Meta Charges on Your Account', desc: 'WhatsApp conversation fees are paid directly to Meta from your own WABA - transparent, no markup' },
                    { title: 'Priority Support', desc: 'WhatsApp & call support with <4hr response time' },
                    { title: 'Free Website Setup', desc: 'We build your salon website. Domain name registration charges apply separately (~₹800-₹1,200/year based on domain name)' },
                    { title: 'Free Business Email Setup', desc: 'Professional email like contact@yoursalon.com included with your domain' },
                  ].map(({ title, desc }) => (
                    <div key={title} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{title}</p>
                        <p className="text-xs text-slate-400">{desc}</p>
                      </div>
                    </div>
                  ))}

                  <div className="pt-5 mt-5 border-t border-violet-800/60 rounded-xl bg-violet-500/10 border border-violet-500/20 p-4">
                    <p className="text-xs font-semibold text-white mb-2">🎯 Perfect for:</p>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>• Single-branch salons wanting own WhatsApp branding</li>
                      <li>• Salons running marketing campaigns</li>
                      <li>• Independent owners going professional</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── GROWTH ─────────────────────────────────────── */}
            <div className="relative flex flex-col rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/50">
              {/* Solid dark background */}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-transparent to-violet-500/10 pointer-events-none" />

              {/* Top badge */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-violet-500 blur-lg opacity-60" />
                <div className="relative bg-gradient-to-r from-pink-500 to-violet-500 text-white text-[11px] font-extrabold tracking-widest uppercase text-center py-2">
                  PREMIUM
                </div>
              </div>

              <div className="relative grid grid-rows-[auto_auto_auto_1fr] p-8 sm:p-10 h-full">
                {/* Row 1 - Header */}
                <div className="mb-8 flex flex-col">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-pink-500 to-violet-500 shadow-lg shadow-pink-500/30 mb-4">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">Growth</h3>
                  <p className="text-sm text-slate-300 font-medium">For scaling salon brands</p>
                  <p className="text-slate-300 text-sm leading-relaxed mt-3 flex-1">
                    Everything in Pro, plus multi-branch management, dedicated support, and white-label onboarding for growing brands.
                  </p>
                </div>

                {/* Row 2 - Pricing */}
                <div className="mb-8 pb-8 border-b border-slate-700/60">
                  <p className="text-sm text-slate-500 line-through mb-1">₹2,999/month</p>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-5xl font-extrabold text-white tracking-tight">₹1,499</span>
                    <span className="text-base text-slate-400 font-medium">/month</span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">₹17,988/year &nbsp;·&nbsp; 2 branches incl. &nbsp;·&nbsp; +₹499/branch &nbsp;·&nbsp; Billed yearly</p>
                </div>

                {/* Row 3 - CTA */}
                <button
                  onClick={() => setShowContactModal(true)}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50 active:scale-[0.98] transition-all shadow-lg hover:shadow-xl mb-8"
                >
                  Contact Sales
                  <ArrowRight className="h-4 w-4" />
                </button>

                {/* Row 4 - Features */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-pink-400 mb-3">Everything in Pro, plus</p>
                  {[
                    { title: 'Multi-Branch Management', desc: 'Centralized dashboard, branch reports & inter-branch transfers' },
                    { title: '10 Staff Logins Per Branch', desc: 'Each branch gets up to 10 team members with their own dashboard access' },
                    { title: 'Dedicated Support Specialist', desc: 'Priority WhatsApp & call support with <4hr response time' },
                    { title: 'White-Label Onboarding', desc: 'Dedicated onboarding specialist & custom setup assistance' },
                    { title: 'Advanced Analytics', desc: 'Cross-branch revenue, staff performance & trend reports' },
                    { title: 'Free WhatsApp API Setup (₹3,500 value)', desc: 'Full setup: Meta verification, number & template approvals' },
                    { title: 'Meta Charges on Your Account', desc: 'WhatsApp conversation fees are paid directly to Meta from your own WABA - transparent, no markup' },
                    { title: 'Free Website Setup', desc: 'We build your salon website. Domain name registration charges apply separately (~₹800-₹1,200/year based on domain name)' },
                    { title: 'Free Business Email Setup', desc: 'Professional email like contact@yoursalon.com included with your domain' },
                  ].map(({ title, desc }) => (
                    <div key={title} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{title}</p>
                        <p className="text-xs text-slate-400">{desc}</p>
                      </div>
                    </div>
                  ))}

                  <div className="pt-5 mt-5 border-t border-slate-700/50 rounded-xl bg-pink-500/10 border border-pink-500/20 p-4">
                    <p className="text-xs font-semibold text-white mb-2">🚀 Perfect for:</p>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>• Multi-location salon chains</li>
                      <li>• Salon brands wanting full marketing control</li>
                      <li>• Growing businesses with 2+ locations</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
          {/* Trust badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto mt-8 reveal">
            <div className="text-center rounded-xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900 text-sm">&#8377;0 setup fee</p>
              <p className="text-xs text-slate-500 mt-1">We set up everything for free. No hidden onboarding charges.</p>
            </div>
            <div className="text-center rounded-xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900 text-sm">No hidden charges</p>
              <p className="text-xs text-slate-500 mt-1">₹799, ₹1,199, or ₹1,499 is exactly what you pay. No surprises.</p>
            </div>
            <div className="text-center rounded-xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900 text-sm">15-day full refund</p>
              <p className="text-xs text-slate-500 mt-1">If SnipandGlow doesn&apos;t work for you, we&apos;ll refund every rupee.</p>
            </div>
          </div>

        </div>
      </section>

      {/* ===== PRO & GROWTH REQUIREMENTS ===== */}
      <section className="py-8 sm:py-12 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #fafafa 0%, #f0f4ff 50%, #fafafa 100%)' }}>
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(99 102 241) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-10 reveal">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 mb-4">
              <Shield className="h-3.5 w-3.5 text-violet-600" />
              <span className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 uppercase tracking-wider">Setup Prerequisites</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
              Requirements for Pro &amp; Growth Plans
            </h2>
            <p className="text-slate-500 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              To activate WhatsApp and business automation features on Pro or Growth plans, salons must provide
              basic business verification details during onboarding. Here&apos;s everything you&apos;ll need - most
              salons already have it all.
            </p>
          </div>

          {/* 3-column requirement cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 reveal">

            {/* Card 1 — Legal Business Name */}
            <div className="rounded-2xl border border-violet-100 bg-white shadow-sm shadow-violet-100/50 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-md shadow-violet-200">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-500">Document 1</p>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Proof of Legal Business Name</h3>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed -mt-1">
                Provide one government-issued document showing the exact legal business name:
              </p>
              <ul className="space-y-2">
                {[
                  'GST Certificate',
                  'Certificate of Incorporation (COI)',
                  'Shop & Establishment Certificate',
                  'Udyam / MSME Registration Certificate',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-violet-400" />
                    <span className="text-xs text-slate-700 leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2 — Business Address & Phone */}
            <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm shadow-indigo-100/50 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 shadow-md shadow-indigo-200">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">Document 2</p>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Proof of Business Address &amp; Phone</h3>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed -mt-1">
                One document showing the legal business name and physical address matching your application:
              </p>
              <ul className="space-y-2">
                {[
                  'Recent utility bill (electricity, water, landline)',
                  'Business bank statement - within last 3 months',
                  'Rental or lease agreement',
                  'Government-issued business license',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-indigo-400" />
                    <span className="text-xs text-slate-700 leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 3 — Additional Prerequisites */}
            <div className="rounded-2xl border border-blue-100 bg-white shadow-sm shadow-blue-100/50 p-6 flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md shadow-blue-200">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">Prerequisites</p>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Additional Requirements</h3>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed -mt-1">
                A few additional items needed before WhatsApp Business API can be activated:
              </p>
              <ul className="space-y-3">
                {[
                  {
                    label: 'Clean phone number',
                    desc: 'Not registered to any personal or regular WhatsApp app - must be able to receive an OTP or voice call.',
                  },
                  {
                    label: 'Business website',
                    desc: 'A live, HTTPS-secure website showcasing your salon.',
                  },
                  {
                    label: 'Domain-based business email',
                    desc: 'E.g. contact@yoursalon.com - avoid free domains like Gmail or Yahoo for this step.',
                  },
                  {
                    label: 'Meta Business Account',
                    desc: 'A registered Facebook Business Page and admin access to Meta Business Manager.',
                  },
                ].map(({ label, desc }) => (
                  <li key={label} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400" />
                    <span className="text-xs text-slate-700 leading-snug">
                      <span className="font-semibold text-slate-800">{label}:</span>{' '}
                      {desc}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Reassurance strip */}
          <div className="mt-8 sm:mt-10 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 reveal">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <Headphones className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">Our team handles the entire setup for you.</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Once you upgrade to Pro or Growth, our onboarding team will guide you through document submission and
                WhatsApp API activation - step by step. Most salons go live within 2-3 business days.
              </p>
            </div>
            <a
              href={`https://wa.me/919449602995?text=${encodeURIComponent('Hi, I want to upgrade to Pro plan and need help with WhatsApp setup.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200 whitespace-nowrap"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Chat with Setup Team
            </a>
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
            <span className="text-lg">🚀</span>
            <span className="text-xs font-semibold uppercase tracking-widest bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              Done-for-you setup
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            We set it up{' '}
            <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-violet-500 bg-clip-text text-transparent italic">
              for you.
            </span>
            <br />
            <span className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-300">Your salon booking system, ready in 1 day.</span>
          </h2>

          {/* Subtext */}
          <p className="text-slate-400 mb-8 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            SnipandGlow configures your WhatsApp booking flow, service menu, staff calendar, reminders, invoices, and customer CRM - so you can focus on clients.
          </p>

          {/* Free Setup Card */}
          <div className="mx-auto max-w-xl mb-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-5 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-300 mb-1">Free Setup Included</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  We help you add your services, staff, prices, booking link, and WhatsApp flow. You can start taking bookings the same day.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 sm:px-10 py-4 rounded-2xl font-semibold text-white text-base shadow-lg shadow-pink-500/25 transition-transform hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #f97316, #ec4899, #8b5cf6)' }}
          >
            <Zap className="h-5 w-5" />
            {"Get Started - It's Free"}
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
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              15-day free trial
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
            Get your own snipandglow dashboard and start automating bookings, billing, and growth - all in one place.
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

      {/* Contact Sales Modal */}
      {showContactModal && <ContactSalesModal onClose={() => setShowContactModal(false)} />}

      {/* ===== RESOURCES SECTION ===== */}
      <section className="py-8 sm:py-12 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center mb-6 reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-2">Resources</p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Resources for beauty business growth</h2>
            <p className="text-slate-500 text-sm max-w-xl mx-auto">
              Practical guides for salon and spa WhatsApp marketing, staff scheduling, memberships and beauty parlour software in India.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 reveal">
            {[
              { href: '/salon-whatsapp-marketing', title: 'WhatsApp Marketing for Salons', desc: 'Automate bookings, reminders and repeat-visit campaigns.', emoji: '💬' },
              { href: '/spa-whatsapp-marketing', title: 'WhatsApp Marketing for Spas', desc: 'Manage treatment bookings, renewals and follow-ups.', emoji: '🌿' },
              { href: '/salon-staff-scheduling', title: 'Salon Staff Scheduling', desc: 'Manage availability, services and automated reminders.', emoji: '📅' },
              { href: '/salon-membership-program', title: 'Salon Membership Program', desc: 'Create plans, track renewals and reduce churn.', emoji: '👑' },
              { href: '/beauty-parlour-software-india', title: 'Beauty Parlour Software India', desc: 'WhatsApp bookings, GST billing and CRM for Indian parlours.', emoji: '🇮🇳' },
              { href: '/best-salon-software-india', title: 'Best Salon Software India', desc: 'What to look for in salon software for Indian beauty businesses.', emoji: '⭐' },
              { href: '/salon-software-pricing-india', title: 'Salon Software Pricing India', desc: 'Understand plans, features and WhatsApp costs before you buy.', emoji: '💰' },
              { href: '/whatsapp-appointment-booking-for-salons', title: 'WhatsApp Appointment Booking', desc: 'How customers book appointments directly through WhatsApp.', emoji: '📲' },
              { href: '/salon-crm-software-india', title: 'Salon CRM Software India', desc: 'Customer retention, visit history and WhatsApp follow-ups.', emoji: '🤝' },
              { href: '/salon-reminder-software', title: 'Salon Reminder Software', desc: 'Appointment, renewal and no-show reminders on WhatsApp.', emoji: '🔔' },
            ].map(({ href, title, desc, emoji }) => (
              <a
                key={href}
                href={href}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all group"
              >
                <span className="text-xl shrink-0 mt-0.5">{emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 leading-snug">{title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="py-10 sm:py-16 relative" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 20%, #ffffff 80%, #f8fafc 100%)' }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center mb-8 reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600 mb-3">FAQ</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-slate-500 text-sm sm:text-base">Everything you need to know before getting started.</p>
          </div>

          <div className="space-y-4 reveal">
            <FaqItem
              question="What is SnipandGlow?"
              answer="SnipandGlow is an all-in-one salon and spa management platform built for Indian businesses. It handles appointments, WhatsApp automation, billing, customer CRM, staff scheduling, payroll, memberships, analytics, and more - all from one dashboard. Available on three plans: Essentials (₹799/mo), Pro (₹1,199/mo), and Growth (₹1,499/mo, multi-branch)."
            />
            <FaqItem
              question="How long is the free trial?"
              answer="You get a full 15-day free trial with access to all features - no credit card required. If SnipandGlow doesn't work for you within those 15 days, you get a full refund, no questions asked."
            />
            <FaqItem
              question="What is the difference between Essentials, Pro, and Growth plans?"
              answer="Essentials (₹799/mo) covers all core operations - appointments, billing, WhatsApp automation, CRM, analytics, memberships, payroll - for a single branch, using the shared SnipandGlow WhatsApp number. Pro (₹1,199/mo) adds your own WhatsApp Business API (messages from your salon's own number), WhatsApp marketing broadcasts, 50+ pre-approved templates, and priority support - still single branch. Growth (₹1,499/mo) adds multi-branch management on top of everything in Pro, ideal for salon chains."
            />
            <FaqItem
              question="How does WhatsApp work on each plan?"
              answer="On Essentials, booking confirmations, appointment reminders, bills, and feedback requests are sent automatically from the shared SnipandGlow WhatsApp number - zero setup needed. On Pro and Growth, you connect your own WhatsApp Business number so all messages come from your salon's brand. Pro includes a one-time WhatsApp API setup fee of ₹3,500 (our team handles everything). Growth includes the same setup for free. Pro and Growth also unlock broadcast campaigns (birthday offers, festival deals, win-back messages) to all your customers at once."
            />
            <FaqItem
              question="How many staff can I give login access to?"
              answer="Each plan includes secure, role-based staff logins (each staff member logs in with their own mobile number and password set by you). Essentials includes up to 5 staff logins, Pro includes up to 10 staff logins, and Growth includes up to 10 staff logins per branch - perfect for multi-location chains. The owner account does not count against these limits, and you can deactivate a staff member anytime to free up a slot."
            />
            <FaqItem
              question="What do I need to connect my own WhatsApp Business API (Pro / Growth)?"
              answer="You need: (1) a Facebook/Meta account, (2) a Facebook Business Page or Instagram account for your salon, (3) a phone number that can receive an OTP and is not currently active on the WhatsApp app, and (4) a business document such as a GST certificate, shop licence, or Udyam registration. A website or domain-based email is not required - a Facebook Business Page is sufficient for most salons."
            />
            <FaqItem
              question="Do I need to do any technical setup for the WhatsApp API?"
              answer="No. On Pro and Growth plans, our team handles the complete WhatsApp API setup - Meta Business verification, number registration, and template approvals. On the Growth plan this is included free (₹3,500 value). On the Pro plan it is a one-time setup fee of ₹3,500. You just provide the required documents."
            />
            <FaqItem
              question="Will connecting my own WhatsApp API affect my existing WhatsApp Business app?"
              answer="Yes - once a number is registered with the WhatsApp Cloud API, it cannot simultaneously run the WhatsApp Business app on a phone. You will need a dedicated number for the API (separate from your day-to-day WhatsApp). Most salons use their main business number for the API and keep a personal number for the app."
            />
            <FaqItem
              question="Can I manage multiple branches?"
              answer="Yes. Multi-branch management is included in the Growth plan. You can manage all locations from a single dashboard with branch-level reporting, independent staff management, and consolidated analytics across branches."
            />
            <FaqItem
              question="Can my staff use it too?"
              answer="Yes. You can add staff members with role-based access - stylists view their own appointments, managers access reports, and owners have full control. There is no per-staff charge."
            />
            <FaqItem
              question="Do I need any technical knowledge?"
              answer="None. SnipandGlow is built for salon owners, not developers. We handle the full setup - services, staff, WhatsApp flow, booking link, and data import. The dashboard is as intuitive as using WhatsApp itself."
            />
            <FaqItem
              question="What payment methods do customers need to use?"
              answer="SnipandGlow tracks payments but does not process them. Customers pay you directly via cash, UPI, card, or any method you prefer. We record every transaction digitally and generate GST-ready invoices automatically."
            />
            <FaqItem
              question="Is my data safe?"
              answer="Yes. All data is encrypted at rest and in transit, hosted on secure cloud servers, and each salon's data is completely isolated. We never share or sell customer data. Access tokens for connected WhatsApp numbers are stored with AES-256 encryption."
            />
            <FaqItem
              question="Can I import my existing customer data?"
              answer="Yes. Our team migrates your existing customer database during onboarding - from Excel sheets, another software, or paper records - at no additional cost."
            />
            <FaqItem
              question="Can I cancel anytime?"
              answer="Yes, no lock-in contracts. Cancel anytime from the dashboard. Cancellations within the first 15 days qualify for a full refund."
            />
            <FaqItem
              question="How is SnipandGlow different from other salon software?"
              answer="Most salon software is built for Western markets and costs ₹3,000–5,000/mo. SnipandGlow is purpose-built for Indian salons - WhatsApp-first, GST billing, UPI tracking, free setup, and honest pricing. Essentials at ₹799/mo covers everything a single salon needs. Pro at ₹1,199/mo adds your own WhatsApp API and broadcast marketing. Growth at ₹1,499/mo adds multi-branch for expanding chains."
            />
            <FaqItem
              question="Do my customers need to download any app to book?"
              answer="No. Your customers book through WhatsApp or a simple booking link - no app download, no account creation, nothing to install. They use the same WhatsApp they already have on their phone, which is why booking rates are so high."
            />
            <FaqItem
              question="How soon will I see results?"
              answer="Most salons notice fewer no-shows within the first 2 weeks, simply because reminders go out automatically before every appointment. Marketing broadcasts and win-back campaigns (Pro/Growth) often pay for the plan within the first month."
            />
            <FaqItem
              question="What if my staff isn't tech-savvy?"
              answer="If your team can use WhatsApp, they can use SnipandGlow - it's that simple. We also handle the full setup for you and provide free training during onboarding, so your staff is comfortable from day one. Real human support is a WhatsApp message away."
            />
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="pt-12 pb-24 lg:pb-8" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #0f172a 6%, #020617 20%)' }}>
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
              <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
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
              &copy; {new Date().getFullYear()} SnipandGlow - <span className="text-slate-400">Snip and Glow by Pixalara</span>. WhatsApp CRM built for salon owners. Crafted with{' '}
              <span className="text-pink-500">❤️</span> by{' '}
              <a href="https://pixalara.io" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 font-medium transition-colors">
                Pixalara LLP
              </a>
              {' '}- A DPIIT Recognized Technology Company by Govt. of India
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
            <a href="https://www.instagram.com/snipandglowapp/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-9 w-9 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-all" aria-label="Instagram">
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
            <a href="mailto:snipandglow.support@pixalara.com" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Contact</a>
          </div>

          {/* SEO resources - crawlable internal links */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 pt-4 mt-1">
            <Link href="/salon-whatsapp-marketing" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">WhatsApp Marketing for Salons</Link>
            <Link href="/spa-whatsapp-marketing" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">WhatsApp Marketing for Spas</Link>
            <Link href="/salon-staff-scheduling" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">Salon Staff Scheduling</Link>
            <Link href="/salon-membership-program" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">Salon Membership Program</Link>
            <Link href="/beauty-parlour-software-india" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">Beauty Parlour Software India</Link>
            <Link href="/best-salon-software-india" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">Best Salon Software India</Link>
            <Link href="/salon-software-pricing-india" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">Salon Software Pricing India</Link>
            <Link href="/whatsapp-appointment-booking-for-salons" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">WhatsApp Appointment Booking</Link>
            <Link href="/salon-crm-software-india" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">Salon CRM Software India</Link>
            <Link href="/salon-reminder-software" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">Salon Reminder Software</Link>
          </div>
        </div>
      </footer>

      {/* Live activity FOMO toast */}
      <LiveActivityToast />

      {/* Sticky mobile CTA bar */}
      <StickyMobileCTA onDemo={() => setShowDemoModal(true)} />

      {/* Floating WhatsApp Button with pulse glow ring */}
      <a
        href="https://wa.me/919449602995?text=Hi%2C%20I%27m%20interested%20in%20SnipandGlow%20for%20my%20salon"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 lg:bottom-6 right-6 z-50 group"
        aria-label="Chat with us on WhatsApp"
      >
        {/* Pulsing glow rings */}
        <span className="absolute inset-0 rounded-full bg-[#25D366]/40 animate-wa-ping" />
        <span className="absolute inset-0 rounded-full bg-[#25D366]/20 animate-wa-ping-delayed" />
        {/* Button */}
        <span className="relative flex items-center justify-center gap-2 bg-[#25D366] text-white shadow-lg shadow-green-500/30 group-hover:shadow-xl group-hover:shadow-green-500/40 group-hover:scale-105 active:scale-95 transition-all duration-300 size-14 rounded-full lg:size-auto lg:px-4 lg:py-3">
          <svg className="size-6 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="text-sm font-semibold hidden lg:inline">Chat with Sales</span>
        </span>
      </a>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes wa-ping {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-wa-ping {
          animation: wa-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-wa-ping-delayed {
          animation: wa-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s;
        }
      `}} />

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

// =============================================================================
// Interactive no-show loss calculator (hero)
// =============================================================================
function NoShowCalculator({ onCta }: { onCta: () => void }) {
  const [missed, setMissed] = useState(2);
  const [avgPrice, setAvgPrice] = useState(500);
  const monthlyLoss = missed * avgPrice * 30;

  return (
    <div className="rounded-2xl border border-amber-300/70 bg-gradient-to-br from-amber-50 to-orange-50/60 px-4 py-4 sm:px-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xl shrink-0 mt-0.5">⚠️</span>
        <p className="text-sm sm:text-base font-semibold text-slate-800 leading-snug">
          How much are no-shows costing your salon?
        </p>
      </div>

      <div className="space-y-4 mb-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-600">Missed appointments / day</label>
            <span className="text-sm font-bold text-slate-900">{missed}</span>
          </div>
          <input
            type="range" min={1} max={10} step={1} value={missed}
            onChange={(e) => setMissed(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
            aria-label="Missed appointments per day"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-600">Average service price</label>
            <span className="text-sm font-bold text-slate-900">₹{avgPrice.toLocaleString('en-IN')}</span>
          </div>
          <input
            type="range" min={200} max={3000} step={100} value={avgPrice}
            onChange={(e) => setAvgPrice(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
            aria-label="Average service price"
          />
        </div>
      </div>

      <div className="rounded-xl bg-white/70 border border-amber-200 px-4 py-3 mb-4">
        <p className="text-sm text-slate-700 leading-snug">
          You could be losing{' '}
          <span className="text-red-600 font-bold text-lg sm:text-xl">₹{monthlyLoss.toLocaleString('en-IN')}</span>{' '}
          every month.{' '}
          <span className="text-slate-500">SnipandGlow sends automatic WhatsApp reminders before every visit.</span>
        </p>
      </div>

      <button
        onClick={onCta}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
      >
        Recover Lost Bookings
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// =============================================================================
// Live activity FOMO toast
// =============================================================================
const LIVE_ACTIVITY = [
  { name: 'Neha', city: 'Shimla', action: 'started a free trial' },
  { name: 'Rohan', city: 'Bangalore', action: 'connected their WhatsApp' },
  { name: 'Pooja', city: 'Jaipur', action: 'sent a festival broadcast' },
  { name: 'Sandeep', city: 'Hisar', action: 'booked a setup call' },
  { name: 'Sai Priya', city: 'Hyderabad', action: 'upgraded to Pro' },
  { name: 'Aanya', city: 'South Delhi', action: 'started a free trial' },
  { name: 'Karan', city: 'Bangalore', action: 'got 3 new bookings today' },
];

function LiveActivityToast() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    const cycle = () => {
      if (!mounted) return;
      setVisible(true);
      const hideTimer = setTimeout(() => setVisible(false), 4500);
      const nextTimer = setTimeout(() => {
        if (!mounted) return;
        setIndex((i) => (i + 1) % LIVE_ACTIVITY.length);
        cycle();
      }, 9000);
      return () => {
        clearTimeout(hideTimer);
        clearTimeout(nextTimer);
      };
    };
    const start = setTimeout(cycle, 3500);
    return () => {
      mounted = false;
      clearTimeout(start);
    };
  }, []);

  const item = LIVE_ACTIVITY[index];

  return (
    <div
      className={`hidden lg:flex fixed bottom-6 left-6 z-40 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg shadow-slate-200/60 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
      <div>
        <p className="text-xs font-semibold text-slate-900">{item.name} from {item.city}</p>
        <p className="text-[11px] text-slate-500">just {item.action} · moments ago</p>
      </div>
    </div>
  );
}

// =============================================================================
// Sticky mobile CTA bar
// =============================================================================
function StickyMobileCTA({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onDemo}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 active:scale-95 transition-transform"
        >
          Book Demo
        </button>
        <Link
          href="/signup"
          className="flex-[1.5] inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-3 py-3 text-sm font-semibold text-white shadow-md shadow-pink-200 active:scale-95 transition-transform"
        >
          Start Free Trial
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

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
          subject: `New Demo Booking - ${name}`,
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


// =============================================================================
// Contact Sales Modal - simple form for Pro/Growth plan inquiries
// =============================================================================

function ContactSalesModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isFormValid = name.trim() && phone.trim() && businessName.trim();

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
          subject: `Pro/Growth Plan Inquiry - ${businessName || name}`,
          name,
          phone,
          contact_email: email.trim() || 'Not provided',
          business_name: businessName,
          message: message || 'Interested in Pro/Growth plan',
          from_name: 'SnipandGlow Contact Sales',
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
        <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-4">
            <CheckCircle2 className="size-7 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">We&apos;ll be in touch!</h3>
          <p className="text-sm text-slate-500 mb-6">
            Our team will reach out on WhatsApp within a few hours.
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
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-violet-600 to-pink-500">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            aria-label="Close"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-white">Get in touch</h2>
          <p className="text-white/80 text-xs mt-1">We&apos;ll help you pick the right plan</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          <input
            type="text"
            placeholder="Your name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none"
            required
          />
          <input
            type="tel"
            placeholder="WhatsApp number *"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none"
            required
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Business name *"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none"
            required
          />
          <textarea
            placeholder="Any questions? (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 focus:outline-none resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !isFormValid}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
          >
            {submitting ? 'Sending...' : 'Send'}
          </button>
          <p className="text-center text-[11px] text-slate-400">
            We reply on WhatsApp within a few hours
          </p>
        </form>
      </div>
    </div>
  );
}

