import Link from "next/link";
import {
  Scissors,
  Calendar,
  Receipt,
  Users,
  BarChart3,
  MessageCircle,
  Star,
  CheckCircle2,
  ArrowRight,
  Building2,
  CreditCard,
  Send,
  Bell,
  FileText,
  UserCheck,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {/* ====== INLINE STYLES FOR ANIMATIONS ====== */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            @keyframes fade-in-up {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes heroRollUp {
              0%,15%   { transform: translateY(0); }
              20%,35%  { transform: translateY(-20%); }
              40%,55%  { transform: translateY(-40%); }
              60%,75%  { transform: translateY(-60%); }
              80%,95%  { transform: translateY(-80%); }
              100%     { transform: translateY(-100%); }
            }
            @keyframes wa-typing {
              0%,80%,100% { transform: translateY(0); opacity: 0.4; }
              40%         { transform: translateY(-5px); opacity: 1; }
            }
            @keyframes msg-pop {
              from { opacity: 0; transform: translateY(8px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes float {
              0%,100% { transform: translateY(0); }
              50%     { transform: translateY(-8px); }
            }
            @keyframes ping-dot {
              0%,100% { box-shadow: 0 0 12px rgba(0,208,132,0.4); }
              50%     { box-shadow: 0 0 24px rgba(0,208,132,0.7), 0 0 44px rgba(0,208,132,0.2); }
            }
            .animate-marquee { animation: marquee 25s linear infinite; }
            .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; opacity: 0; }
            .hero-roll-track { animation: heroRollUp 15s ease-in-out infinite; }
            .typing-dot { animation: wa-typing 1.2s ease-in-out infinite; }
            .msg-pop { animation: msg-pop 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }
            .float-anim { animation: float 3s ease-in-out infinite; }
            .logo-dot { animation: ping-dot 2s ease-in-out infinite; }
            .delay-100 { animation-delay: 0.1s; }
            .delay-200 { animation-delay: 0.2s; }
            .delay-300 { animation-delay: 0.3s; }
            .delay-400 { animation-delay: 0.4s; }
          `,
        }}
      />

      {/* ====== NAVBAR ====== */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(5,8,16,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)' }}>
              <Scissors className="size-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Snip & Glow</span>
            <span className="logo-dot ml-1 inline-block size-2 rounded-full" style={{ background: '#00D084' }} />
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {['How It Works', 'Features', 'Pricing'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} className="text-sm font-medium transition-colors" style={{ color: 'rgba(240,246,255,0.75)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,246,255,0.75)')}
              >{item}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex h-10 items-center rounded-lg px-5 text-sm font-semibold transition-all" style={{ border: '1px solid rgba(255,255,255,0.2)', color: '#fff', background: 'none' }}>
              Login
            </Link>
            <Link href="/login" className="inline-flex h-10 items-center rounded-lg px-5 text-sm font-semibold text-white transition-all" style={{ background: '#00D084', color: '#020c06', boxShadow: '0 0 20px rgba(0,208,132,0.3)' }}>
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ====== HERO SECTION — dark with WhatsApp phone mockup ====== */}
      <section style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #050810 0%, #0D1117 100%)', display: 'flex', alignItems: 'center', padding: '130px 0 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Ambient glow orbs */}
        <div style={{ position: 'absolute', top: '10%', left: '5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,208,132,0.06) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

            {/* LEFT — Copy */}
            <div className="animate-fade-in-up">
              {/* Badge */}
              <div className="mb-7 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(0,208,132,0.12)', border: '1px solid rgba(0,208,132,0.3)', color: '#00D084' }}>
                <span className="logo-dot inline-block size-1.5 rounded-full" style={{ background: '#00D084' }} />
                WhatsApp Booking for Salons
              </div>

              {/* Headline */}
              <h1 className="font-bold leading-tight text-white" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(38px, 5vw, 62px)', letterSpacing: '-0.035em', marginBottom: '0' }}>
                Your salon on<br />WhatsApp.
              </h1>

              {/* Rolling text */}
              <div style={{ height: 'clamp(52px, 6vw, 72px)', overflow: 'hidden', marginBottom: '24px' }}>
                <div className="hero-roll-track" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(38px, 5vw, 62px)', fontWeight: 800, letterSpacing: '-0.035em' }}>
                  {['Book appointments.', 'Send reminders.', 'Manage clients.', 'Grow revenue.', 'Book appointments.'].map((text, i) => (
                    <div key={i} style={{ height: 'clamp(52px, 6vw, 72px)', display: 'flex', alignItems: 'center', color: i % 4 === 0 ? '#ec4899' : i % 4 === 1 ? '#f59e0b' : i % 4 === 2 ? '#3b82f6' : '#8b5cf6' }}>
                      {text}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-lg leading-relaxed mb-10 max-w-lg" style={{ color: 'rgba(240,246,255,0.72)' }}>
                Clients book appointments, check services, and get reminders — all inside WhatsApp. No app downloads. No missed bookings. Your salon runs on autopilot.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-4 mb-12">
                <Link href="/login" className="inline-flex h-14 items-center gap-2 rounded-xl px-7 text-base font-bold transition-all" style={{ background: '#00D084', color: '#020c06', boxShadow: '0 6px 28px rgba(0,208,132,0.35)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#020c06"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.9.525 3.676 1.44 5.193L2 22l4.98-1.404A9.951 9.951 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm5.006 14.315c-.21.588-1.228 1.13-1.7 1.17-.44.038-.855.197-2.886-.6-2.45-.97-4.015-3.476-4.135-3.638-.12-.162-.978-1.302-.978-2.483 0-1.181.617-1.763.836-2.003.22-.24.48-.3.64-.3l.46.009c.148.006.345-.056.54.413.2.48.677 1.662.736 1.782.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.253.31-.36.416-.12.12-.245.25-.105.49.14.24.622.996 1.334 1.613.916.816 1.688 1.068 1.927 1.188.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.15 1.17z" /></svg>
                  Start 14-Day Free Trial
                </Link>
                <a href="#how-it-works" className="inline-flex h-14 items-center rounded-xl px-7 text-base font-semibold transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(240,246,255,0.85)', backdropFilter: 'blur(8px)' }}>
                  See How It Works ↓
                </a>
                <Link href="/login" className="inline-flex h-14 items-center rounded-xl px-7 text-base font-semibold transition-all" style={{ border: '1.5px solid #ec4899', color: '#ec4899', background: 'transparent' }}>
                  📅 Book a Demo
                </Link>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-0">
                {[
                  { val: '💬', label: 'WhatsApp booking' },
                  { val: '📋', label: 'Auto reminders' },
                  { val: '💰', label: 'Service menu' },
                  { val: '₹0', label: 'For 14 days' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center">
                    {i > 0 && <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.12)', margin: '0 20px' }} />}
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: 900, color: ['#00D084','#3b82f6','#8b5cf6','#ec4899'][i] }}>{s.val}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(240,246,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — WhatsApp Phone Mockup */}
            <div className="animate-fade-in-up delay-200 flex justify-center">
              <div className="float-anim" style={{ position: 'relative' }}>
                {/* Glow behind phone */}
                <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,208,132,0.18) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', filter: 'blur(20px)', pointerEvents: 'none' }} />

                {/* Phone shell */}
                <div style={{ width: '290px', background: '#111', borderRadius: '48px', border: '10px solid #1a1a1a', boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 40px 80px rgba(0,0,0,0.7), 0 0 60px rgba(0,208,132,0.08)', overflow: 'hidden' }}>
                  {/* Notch */}
                  <div style={{ width: '90px', height: '24px', background: '#111', borderRadius: '0 0 16px 16px', margin: '0 auto', position: 'relative', zIndex: 10 }} />

                  {/* Screen */}
                  <div style={{ background: '#0b141a', display: 'flex', flexDirection: 'column', height: '560px', overflow: 'hidden' }}>
                    {/* WA Header */}
                    <div style={{ background: '#1f2c34', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a5c2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#fff' }}>GS</div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#e9edef' }}>Glamour Salon</div>
                        <div style={{ fontSize: '11px', color: '#8696a0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00D084', display: 'inline-block' }} />
                          online
                        </div>
                      </div>
                    </div>

                    {/* Chat body */}
                    <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'hidden' }}>
                      {/* Customer message */}
                      <div style={{ alignSelf: 'flex-end', background: '#005c4b', borderRadius: '12px 12px 4px 12px', padding: '8px 12px 6px' }}>
                        <div style={{ fontSize: '13px', color: '#e9edef' }}>Hi 👋</div>
                        <div style={{ fontSize: '10px', color: '#8696a0', textAlign: 'right', marginTop: '2px' }}>10:04 AM</div>
                      </div>

                      {/* Bot welcome card */}
                      <div className="msg-pop" style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
                        <div style={{ background: '#1f2c34', border: '1px solid #2a3942', borderRadius: '12px 12px 12px 4px', overflow: 'hidden' }}>
                          {/* Green header */}
                          <div style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', padding: '8px 12px', borderLeft: '4px solid #16a34a' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>🏆 Glamour Studio</span>
                          </div>
                          <div style={{ padding: '10px 13px 8px', fontSize: '12.5px', color: '#d1d7db', lineHeight: 1.6 }}>
                            <div style={{ fontWeight: 700, color: '#e9edef', marginBottom: 4 }}>👋 Welcome to Glamour Studio!</div>
                            <div>How can we help you today?</div>
                          </div>
                          <div style={{ padding: '0 13px 8px', fontSize: '10px', color: '#8696a0', textAlign: 'right' }}>10:04 AM</div>
                        </div>
                        {/* Quick reply buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px' }}>
                          {['💇 Book Appointment', '📋 My Appointments', '💰 Services & Prices'].map((btn, i) => (
                            <div key={i} style={{ background: '#1a2730', border: '1px solid #2a3942', borderRadius: i === 2 ? '0 0 12px 12px' : '0', padding: '9px 12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 600, color: '#53bdeb', borderTop: i === 0 ? '1px solid #2a3942' : '1px solid #0d1418' }}>
                              {btn}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Customer taps Book */}
                      <div style={{ alignSelf: 'flex-end', background: '#005c4b', borderRadius: '12px 12px 4px 12px', padding: '8px 12px 6px' }}>
                        <div style={{ fontSize: '13px', color: '#e9edef' }}>💇 Book Appointment</div>
                        <div style={{ fontSize: '10px', color: '#8696a0', textAlign: 'right', marginTop: '2px' }}>10:05 AM</div>
                      </div>

                      {/* Booking confirmed */}
                      <div className="msg-pop" style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
                        <div style={{ background: '#1f2c34', border: '1px solid #2a3942', borderRadius: '12px 12px 12px 4px', padding: '10px 13px 8px', fontSize: '12.5px', color: '#d1d7db', lineHeight: 1.6 }}>
                          <div style={{ fontWeight: 700, color: '#25d366', marginBottom: 6 }}>✅ Booking Confirmed!</div>
                          <div>👤 Priya</div>
                          <div>✂️ Haircut</div>
                          <div>📅 10 May, 2:30 PM</div>
                          <div>📍 Glamour Salon</div>
                          <div style={{ marginTop: 6, color: '#e9edef' }}>See you soon! 😊</div>
                          <div style={{ fontSize: '10px', color: '#8696a0', textAlign: 'right', marginTop: 4 }}>10:05 AM</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px' }}>
                          {['Reschedule', 'Cancel'].map((btn, i) => (
                            <div key={i} style={{ background: '#1a2730', border: '1px solid #2a3942', borderRadius: i === 1 ? '0 0 12px 12px' : '0', padding: '9px 12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 600, color: '#53bdeb', borderTop: i === 0 ? '1px solid #2a3942' : '1px solid #0d1418' }}>
                              {btn}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Input bar */}
                    <div style={{ background: '#1f2c34', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ flex: 1, background: '#2a3942', borderRadius: '22px', height: '38px', display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: '13px', color: '#8696a0' }}>Type a message</div>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#00D084', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ====== CUSTOMER LOGOS ====== */}
      <section className="py-12 border-y border-gray-100 bg-gray-50/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-gray-500 mb-8">
            Trusted by <span className="font-bold text-gray-700">500+</span> salons & spas across India
          </p>
          <div className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-gray-50 to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-50 to-transparent z-10" />
            <div className="flex animate-marquee whitespace-nowrap">
              {[
                "Glamour Studio", "Style Hub", "Bliss Salon", "The Hair Lab",
                "Luxe Beauty", "Urban Chic", "Radiance Spa", "Glow Up Studio",
                "The Mane Room", "Aura Salon", "Velvet Touch", "Crown & Glory",
                "Glamour Studio", "Style Hub", "Bliss Salon", "The Hair Lab",
                "Luxe Beauty", "Urban Chic", "Radiance Spa", "Glow Up Studio",
                "The Mane Room", "Aura Salon", "Velvet Touch", "Crown & Glory",
              ].map((name, i) => (
                <span
                  key={i}
                  className="mx-8 text-lg font-bold text-gray-300 select-none tracking-wide"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====== FEATURE TAGS GRID ====== */}
      <section id="features" className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Everything You Need to Run Your Salon</h2>
            <p className="mt-3 text-gray-600">One platform. Every feature. Zero hassle.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: Calendar, label: "Appointment Scheduling" },
              { icon: MessageCircle, label: "WhatsApp Booking" },
              { icon: Receipt, label: "POS & Billing" },
              { icon: Users, label: "Customer Management" },
              { icon: CreditCard, label: "Memberships" },
              { icon: BarChart3, label: "Analytics & Reports" },
              { icon: Building2, label: "Multi-Branch" },
              { icon: UserCheck, label: "Staff Management" },
              { icon: Bell, label: "Automated Reminders" },
              { icon: FileText, label: "Invoice via WhatsApp" },
            ].map((tag, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 shadow-sm hover:shadow-md hover:border-pink-200 transition-all cursor-default"
              >
                <tag.icon className="size-4 text-pink-500" />
                <span className="text-sm font-medium text-gray-700">{tag.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== SECTION 1: WhatsApp Booking (Text Left, Mockup Right) ====== */}
      <section id="booking" className="py-20 lg:py-28 bg-pink-50/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Left — Text */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-1.5 text-sm font-medium text-green-700 mb-5">
                <MessageCircle className="size-4" />
                WhatsApp Native
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                Seamless WhatsApp Booking
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Your customers book appointments directly through WhatsApp chat. No app downloads, no website visits — just a simple conversation that converts.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Customers book in under 60 seconds via chat",
                  "Interactive buttons — no typing needed",
                  "Automatic confirmation & calendar sync",
                  "Works on any phone — no app install required",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — WhatsApp Chat Mockup */}
            <div className="flex justify-center">
              <div className="w-full max-w-sm rounded-3xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
                {/* Chat header */}
                <div className="bg-green-600 px-5 py-4 flex items-center gap-3">
                  <div className="size-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Scissors className="size-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Snip & Glow ✨</p>
                    <p className="text-[11px] text-green-100">online</p>
                  </div>
                </div>
                {/* Chat body */}
                <div className="bg-[#ece5dd] p-4 space-y-3 min-h-[320px]">
                  {/* Customer message */}
                  <div className="flex justify-end">
                    <div className="max-w-[75%] rounded-xl rounded-tr-sm bg-[#dcf8c6] px-3 py-2 shadow-sm">
                      <p className="text-[13px] text-gray-900">Hi! I want to book a haircut 💇‍♀️</p>
                      <span className="text-[10px] text-gray-500 flex justify-end mt-0.5">10:30 AM</span>
                    </div>
                  </div>
                  {/* Bot reply */}
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
                      <p className="text-[13px] text-gray-900">Welcome! 🌟 Choose a service:</p>
                      <span className="text-[10px] text-gray-500">10:30 AM</span>
                    </div>
                  </div>
                  {/* Quick reply buttons */}
                  <div className="flex flex-wrap gap-2 pl-2">
                    <span className="rounded-full border border-green-600/30 bg-white px-3 py-1 text-[11px] font-medium text-green-700 shadow-sm">💇 Haircut</span>
                    <span className="rounded-full border border-green-600/30 bg-white px-3 py-1 text-[11px] font-medium text-green-700 shadow-sm">💅 Nails</span>
                    <span className="rounded-full border border-green-600/30 bg-white px-3 py-1 text-[11px] font-medium text-green-700 shadow-sm">💆 Spa</span>
                  </div>
                  {/* Confirmation */}
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
                      <p className="text-[13px] text-gray-900 font-medium">✅ Booked!</p>
                      <div className="mt-1.5 space-y-0.5 text-[12px] text-gray-700">
                        <p>📅 Tomorrow, 11:00 AM</p>
                        <p>💇 Haircut + Blow Dry</p>
                        <p>👤 Stylist: Priya</p>
                      </div>
                      <span className="text-[10px] text-gray-500">10:31 AM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== SECTION 2: POS & Billing (Mockup Left, Text Right) ====== */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Left — Invoice Mockup */}
            <div className="flex justify-center order-2 lg:order-1">
              <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 p-6">
                {/* Invoice header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Invoice #SG-1247</h4>
                    <p className="text-[11px] text-gray-500">15 May 2026 · Koramangala Branch</p>
                  </div>
                  <div className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-semibold text-green-700">PAID</div>
                </div>
                {/* Customer */}
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                  <div className="size-9 rounded-full bg-pink-100 flex items-center justify-center">
                    <Users className="size-4 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Priya Sharma</p>
                    <p className="text-[10px] text-gray-500">+91 98765 43210</p>
                  </div>
                </div>
                {/* Line items */}
                <div className="space-y-3 mb-5">
                  {[
                    { service: "Haircut + Blow Dry", staff: "Stylist: Neha", amount: "₹800" },
                    { service: "Hair Color (L'Oréal)", staff: "Stylist: Neha", amount: "₹2,500" },
                    { service: "Head Massage (30 min)", staff: "Therapist: Ravi", amount: "₹500" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-800">{item.service}</p>
                        <p className="text-[10px] text-gray-500">{item.staff}</p>
                      </div>
                      <span className="text-xs font-semibold text-gray-900">{item.amount}</span>
                    </div>
                  ))}
                </div>
                {/* Totals */}
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Subtotal</span>
                    <span>₹3,800</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>GST (18%)</span>
                    <span>₹684</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Membership Discount (10%)</span>
                    <span className="text-green-600">-₹380</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>₹4,104</span>
                  </div>
                </div>
                {/* WhatsApp send button */}
                <div className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-green-50 border border-green-200 py-2.5 px-4">
                  <Send className="size-4 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">Sent via WhatsApp ✓</span>
                </div>
              </div>
            </div>

            {/* Right — Text */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 text-sm font-medium text-amber-700 mb-5">
                <Receipt className="size-4" />
                Smart Billing
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                Smart POS & GST Billing
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Generate professional GST-compliant invoices in seconds. Auto-send PDF bills via WhatsApp — your customers love the instant receipts.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "GST-compliant invoices with HSN codes",
                  "Auto-send invoice PDF via WhatsApp",
                  "Multiple payment modes — UPI, card, cash",
                  "Membership discounts applied automatically",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ====== SECTION 3: Revenue Analytics (Text Left, Mockup Right) ====== */}
      <section id="analytics" className="py-20 lg:py-28 bg-gray-50/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Left — Text */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-4 py-1.5 text-sm font-medium text-blue-700 mb-5">
                <BarChart3 className="size-4" />
                Analytics
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                Revenue Analytics & Insights
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Track performance across services, staff, and branches. Know exactly what&apos;s working and where to improve — all in real-time dashboards.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Daily, weekly, monthly revenue tracking",
                  "Top services & staff performance reports",
                  "Customer retention & visit frequency",
                  "Branch-wise comparison dashboards",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — Analytics Dashboard Mockup */}
            <div className="flex justify-center">
              <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 p-5 space-y-4">
                {/* Revenue chart */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-gray-800">Monthly Revenue</h4>
                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">↑ 23% vs last month</span>
                  </div>
                  {/* Bar chart */}
                  <div className="flex items-end gap-2 h-32">
                    {[
                      { h: 45, label: "Jan", val: "₹1.8L" },
                      { h: 55, label: "Feb", val: "₹2.2L" },
                      { h: 50, label: "Mar", val: "₹2.0L" },
                      { h: 70, label: "Apr", val: "₹2.8L" },
                      { h: 65, label: "May", val: "₹2.6L" },
                      { h: 85, label: "Jun", val: "₹3.4L" },
                      { h: 100, label: "Jul", val: "₹4.0L" },
                    ].map((bar, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t-md ${i === 6 ? "bg-pink-500" : "bg-pink-200"}`}
                          style={{ height: `${bar.h}%` }}
                        />
                        <span className="text-[9px] text-gray-500">{bar.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Top services */}
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-xs font-bold text-gray-800 mb-3">Top Services This Month</h4>
                  <div className="space-y-2.5">
                    {[
                      { name: "Hair Color", revenue: "₹1,20,000", pct: 85 },
                      { name: "Haircut", revenue: "₹85,000", pct: 60 },
                      { name: "Facial", revenue: "₹65,000", pct: 46 },
                      { name: "Bridal Package", revenue: "₹55,000", pct: 39 },
                    ].map((svc, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-gray-700">{svc.name}</span>
                          <span className="text-[11px] font-semibold text-gray-900">{svc.revenue}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-pink-600" style={{ width: `${svc.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== SECTION 4: Multi-Branch & Staff (Mockup Left, Text Right) ====== */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Left — Multi-branch Mockup */}
            <div className="flex justify-center order-2 lg:order-1">
              <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 p-5 space-y-4">
                {/* Branch switcher */}
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="size-8 rounded-lg bg-pink-100 flex items-center justify-center">
                    <Building2 className="size-4 text-pink-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-800">All Branches</p>
                    <p className="text-[10px] text-gray-500">3 locations active</p>
                  </div>
                  <ChevronRight className="size-4 text-gray-400" />
                </div>
                {/* Branch cards */}
                <div className="space-y-3">
                  {[
                    { name: "Koramangala", staff: 8, revenue: "₹4.2L", status: "Top Performer", statusColor: "bg-green-100 text-green-700" },
                    { name: "Indiranagar", staff: 6, revenue: "₹3.1L", status: "Growing", statusColor: "bg-blue-100 text-blue-700" },
                    { name: "HSR Layout", staff: 5, revenue: "₹2.8L", status: "New Branch", statusColor: "bg-amber-100 text-amber-700" },
                  ].map((branch, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-gray-800">{branch.name}</p>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${branch.statusColor}`}>{branch.status}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Users className="size-3 text-gray-400" />
                          <span className="text-[10px] text-gray-600">{branch.staff} staff</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="size-3 text-gray-400" />
                          <span className="text-[10px] text-gray-600">{branch.revenue}/mo</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Role badges */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Role-Based Access</p>
                  <div className="flex flex-wrap gap-2">
                    {["Owner", "Manager", "Stylist", "Receptionist"].map((role, i) => (
                      <span key={i} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">{role}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Text */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 border border-purple-200 px-4 py-1.5 text-sm font-medium text-purple-700 mb-5">
                <Building2 className="size-4" />
                Multi-Branch
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                Multi-Branch & Staff Management
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                Manage all your salon locations from a single dashboard. Assign roles, compare branch performance, and maintain control without micromanaging.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Centralized dashboard for all branches",
                  "Role-based access — owner, manager, stylist, receptionist",
                  "Branch-wise revenue & performance comparison",
                  "Staff scheduling & attendance tracking",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-purple-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ====== STATS SECTION ====== */}
      <section className="py-20 lg:py-24 bg-gradient-to-b from-pink-50/50 to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Trusted by Salon Owners Across India
            </h2>
            <p className="mt-3 text-gray-600">Numbers that speak for themselves</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: "500+", label: "Salons & Spas", description: "Across 50+ cities in India" },
              { value: "2L+", label: "Appointments Booked", description: "Via WhatsApp every month" },
              { value: "₹5Cr+", label: "Revenue Processed", description: "Monthly billing volume" },
              { value: "40%", label: "Fewer No-Shows", description: "With automated reminders" },
            ].map((stat, i) => (
              <div key={i} className="text-center rounded-2xl bg-white border border-gray-100 shadow-lg shadow-gray-100/50 p-6 lg:p-8">
                <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-pink-600">{stat.value}</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">{stat.label}</p>
                <p className="mt-1 text-xs text-gray-500">{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== PRICING SECTION ====== */}
      <section id="pricing" className="py-20 lg:py-28 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-pink-600 uppercase tracking-wider mb-2">Pricing</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-3 text-gray-600 max-w-lg mx-auto">
              Start free for 14 days. No credit card required. Upgrade when you&apos;re ready.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-lg shadow-gray-100/50 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900">Starter</h3>
                <p className="text-sm text-gray-500 mt-1">For single-location salons</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">₹999</span>
                <span className="text-gray-500 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Up to 100 customers",
                  "Appointment scheduling",
                  "WhatsApp booking",
                  "POS & GST billing",
                  "1 branch, 3 staff",
                  "Email support",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-gray-400 mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-600">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-gray-200 bg-white text-sm font-semibold text-gray-700 transition-all hover:border-pink-200 hover:bg-pink-50 w-full"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Pro — Highlighted */}
            <div className="rounded-2xl border-2 border-pink-500 bg-white p-7 shadow-xl shadow-pink-100/50 flex flex-col relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-pink-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">Most Popular</span>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900">Pro</h3>
                <p className="text-sm text-gray-500 mt-1">For growing salons & spas</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">₹2,499</span>
                <span className="text-gray-500 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Unlimited customers",
                  "Everything in Starter",
                  "Analytics & reports",
                  "Memberships & packages",
                  "Up to 3 branches, 10 staff",
                  "WhatsApp campaigns",
                  "Priority support",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-pink-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-700">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-pink-600 text-sm font-semibold text-white shadow-md shadow-pink-200 transition-all hover:bg-pink-700 w-full"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-lg shadow-gray-100/50 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900">Enterprise</h3>
                <p className="text-sm text-gray-500 mt-1">For salon chains & franchises</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">₹4,999</span>
                <span className="text-gray-500 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Everything in Pro",
                  "Unlimited branches & staff",
                  "Custom integrations",
                  "Dedicated account manager",
                  "White-label option",
                  "SLA & uptime guarantee",
                  "On-call support",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-gray-400 mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-600">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-gray-200 bg-white text-sm font-semibold text-gray-700 transition-all hover:border-pink-200 hover:bg-pink-50 w-full"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ====== CTA SECTION ====== */}
      <section className="py-20 lg:py-24 bg-gradient-to-br from-pink-600 to-pink-700">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
            Ready to Grow Your Salon Business?
          </h2>
          <p className="mt-4 text-lg text-pink-100 max-w-2xl mx-auto">
            Join 500+ salon owners who switched to Snip & Glow and saw 40% fewer no-shows, 2x faster billing, and happier customers.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-8 text-base font-semibold text-pink-600 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl"
            >
              Request a Free Demo
              <ArrowRight className="ml-2 size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border-2 border-white/30 px-8 text-base font-semibold text-white transition-all hover:bg-white/10"
            >
              Start 14-Day Free Trial
            </Link>
          </div>
          <p className="mt-5 text-sm text-pink-200">
            No credit card required · Setup in 2 minutes · Cancel anytime
          </p>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="bg-gray-900 text-gray-300 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-pink-600">
                  <Scissors className="size-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">Snip & Glow</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                All-in-one salon management software powered by WhatsApp. Built for Indian salons.
              </p>
              <p className="text-xs text-gray-500">by Pixalara · Made in India 🇮🇳</p>
            </div>

            {/* Features */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Features</h4>
              <ul className="space-y-2.5">
                {["Appointment Scheduling", "WhatsApp Booking", "POS & Billing", "Analytics", "Memberships"].map((item, i) => (
                  <li key={i}>
                    <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Solutions</h4>
              <ul className="space-y-2.5">
                {["Hair Salons", "Beauty Spas", "Nail Studios", "Barbershops", "Salon Chains"].map((item, i) => (
                  <li key={i}>
                    <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2.5">
                {["About Us", "Blog", "Careers", "Contact", "Partner Program"].map((item, i) => (
                  <li key={i}>
                    <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Refund Policy", href: "/refund" },
                ].map((item, i) => (
                  <li key={i}>
                    <Link href={item.href} className="text-sm text-gray-400 hover:text-white transition-colors">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              © 2026 Snip & Glow by Pixalara. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="mailto:hello@snipandglow.com" className="text-gray-400 hover:text-white transition-colors">
                <Mail className="size-5" />
              </a>
              <a href="tel:+919876543210" className="text-gray-400 hover:text-white transition-colors">
                <Phone className="size-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <MapPin className="size-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
