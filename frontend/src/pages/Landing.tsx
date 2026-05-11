// Snip & Glow — Landing Page v4
// Video as hero background · WhatsApp Phone Mockup with dynamic client alerts

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PLAN_PRICES } from '@/config/planConfig';
import InteractiveDashboard from '@/components/ui/InteractiveDashboard';
import './Landing.css';

/* ─── WhatsApp Conversation Flow Mockup ─────────────── */

// Typing indicator sub-component
function TypingDots() {
  return (
    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '4px',
      background: '#1f2c34', borderRadius: '12px 12px 12px 4px', padding: '10px 14px', marginBottom: '6px' }}>
      {[0, 200, 400].map(delay => (
        <span key={delay} style={{
          width: 7, height: 7, borderRadius: '50%', background: '#8696a0', display: 'inline-block',
          animation: 'wa-typing 1.2s ease-in-out infinite',
          animationDelay: `${delay}ms`,
        }} />
      ))}
    </div>
  );
}

// WhatsApp interactive card (bot message with optional buttons)
function BotCard({ children, buttons }: { children: React.ReactNode; buttons?: string[] }) {
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '88%', marginBottom: '6px' }}>
      <div style={{
        background: '#1f2c34', border: '1px solid #2a3942',
        borderRadius: '12px 12px 12px 4px', overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 13px 8px', fontSize: '12.5px', color: '#d1d7db', lineHeight: 1.55 }}>
          {children}
        </div>
        <div style={{ padding: '0 13px 8px', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '10px', color: '#8696a0' }}>
            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
      {buttons && buttons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px' }}>
          {buttons.map((btn, i) => (
            <div key={i} style={{
              background: '#1a2730', border: '1px solid #2a3942',
              borderRadius: i === 0 && buttons.length > 1 ? '0' : i === buttons.length - 1 ? '0 0 12px 12px' : '0',
              padding: '9px 12px', textAlign: 'center',
              fontSize: '12.5px', fontWeight: 600, color: '#53bdeb',
              borderTop: i === 0 ? '1px solid #2a3942' : '1px solid #0d1418',
            }}>
              {btn}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Customer bubble (right side, green)
function CustomerBubble({ text }: { text: string }) {
  return (
    <div style={{ alignSelf: 'flex-end', maxWidth: '75%', marginBottom: '6px' }}>
      <div style={{
        background: '#005c4b', borderRadius: '12px 12px 4px 12px',
        padding: '8px 12px 6px',
      }}>
        <div style={{ fontSize: '12.5px', color: '#e9edef', lineHeight: 1.5 }}>{text}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
          <span style={{ fontSize: '10px', color: '#8696a0' }}>
            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            <svg width="13" height="9" viewBox="0 0 16 11" fill="none" style={{ marginLeft: 3, verticalAlign: 'middle' }}>
              <path d="M1 5.5L5 9.5L10 1" stroke="#53d769" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 5.5L10 9.5L15 1" stroke="#53d769" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

// Screen content definitions
type ScreenDef = {
  label: string;
  render: (showTyping: boolean, showBot: boolean, showExtra: boolean) => React.ReactNode;
};

const SCREENS: ScreenDef[] = [
  {
    label: 'Welcome Flow',
    render: (showTyping, showBot) => (
      <>
        <CustomerBubble text="Hi 👋" />
        {showTyping && !showBot && <TypingDots />}
        {showBot && (
          <BotCard buttons={['💇 Book Appointment', '📋 My Appointments', '💰 Services & Prices', '📞 Contact Us']}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#e9edef', marginBottom: 6 }}>
              👋 Welcome to Glamour Studio!
            </div>
            <div>How can we help you today?</div>
          </BotCard>
        )}
      </>
    ),
  },
  {
    label: 'Booking Confirmed',
    render: (showTyping, showBot) => (
      <>
        <CustomerBubble text="💇 Book Appointment" />
        {showTyping && !showBot && <TypingDots />}
        {showBot && (
          <BotCard buttons={['Reschedule', 'Cancel']}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#25d366', marginBottom: 6 }}>
              ✅ Booking Confirmed!
            </div>
            <div>👤 Priya</div>
            <div>✂️ Haircut</div>
            <div>📅 10 May 2026, 2:30 PM</div>
            <div>📍 Glamour Salon, Koramangala</div>
            <div style={{ marginTop: 6, color: '#e9edef' }}>See you soon! 😊</div>
          </BotCard>
        )}
      </>
    ),
  },
  {
    label: '30-Day Reminder',
    render: (showTyping, showBot) => (
      <>
        {showTyping && !showBot && <TypingDots />}
        {showBot && (
          <>
            {/* Green header banner like the image */}
            <div style={{ alignSelf: 'flex-start', maxWidth: '88%', marginBottom: '6px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', borderRadius: '12px 12px 0 0',
                padding: '8px 12px', borderLeft: '4px solid #16a34a',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>🏆 Glamour Studio</span>
              </div>
              <div style={{
                background: '#1f2c34', border: '1px solid #2a3942', borderTop: 'none',
                borderRadius: '0 0 12px 4px', padding: '12px 13px 10px',
              }}>
                <div style={{ fontSize: '13px', color: '#e9edef', lineHeight: 1.6 }}>
                  Hi <strong style={{ color: '#fff' }}>Priya</strong>! 👋
                </div>
                <div style={{ fontSize: '13px', color: '#d1d7db', lineHeight: 1.6, marginTop: 6 }}>
                  We miss you at <strong style={{ color: '#fff' }}>Glamour Studio</strong>! ✨
                </div>
                <div style={{ fontSize: '13px', color: '#d1d7db', lineHeight: 1.6, marginTop: 6 }}>
                  It's been a while since your last visit. Your hair deserves some love! 💕
                </div>
                <div style={{ fontSize: '13px', color: '#d1d7db', lineHeight: 1.6, marginTop: 6 }}>
                  Reply <strong style={{ color: '#fff' }}>Book</strong> to schedule your next appointment — or tap below! 👇
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <span style={{ fontSize: '10px', color: '#8696a0' }}>10:04 AM</span>
                </div>
              </div>
              {/* CTA Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px' }}>
                <div style={{ background: '#1a2730', border: '1px solid #2a3942', padding: '9px 12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 600, color: '#53bdeb', borderTop: '1px solid #2a3942' }}>
                  📅 Book Appointment
                </div>
                <div style={{ background: '#1a2730', border: '1px solid #2a3942', borderRadius: '0 0 12px 12px', padding: '9px 12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 600, color: '#53bdeb', borderTop: '1px solid #0d1418' }}>
                  💰 View Our Services
                </div>
              </div>
            </div>
          </>
        )}
      </>
    ),
  },
  {
    label: 'Digital Receipt',
    render: (showTyping, showBot) => (
      <>
        {showTyping && !showBot && <TypingDots />}
        {showBot && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '90%', marginBottom: '6px' }}>
            {/* Status bubble */}
            <div style={{
              background: '#1f2c34', borderRadius: '12px', padding: '8px 12px', marginBottom: '4px',
              border: '1px solid #2a3942',
            }}>
              <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 700 }}>✂️ Appointment completed!</span>
              <div style={{ fontSize: '11px', color: '#8696a0', marginTop: 2 }}>Generating your invoice...</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                <span style={{ fontSize: '10px', color: '#8696a0' }}>3:45 PM</span>
              </div>
            </div>
            {/* Invoice card */}
            <div style={{
              background: '#1f2c34', border: '1px solid #2a3942',
              borderRadius: '12px 12px 12px 4px', overflow: 'hidden',
            }}>
              {/* Purple header */}
              <div style={{
                background: 'linear-gradient(135deg, #f3e8ff, #ede9fe)', padding: '8px 12px',
                borderLeft: '4px solid #7c3aed',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#6d28d9' }}>🧾 Glamour Studio</span>
                <div style={{ fontSize: '10px', color: '#7c3aed', marginTop: 1 }}>Invoice #INV-2026-00142</div>
              </div>
              {/* Body */}
              <div style={{ padding: '10px 13px 8px', fontSize: '12px', color: '#d1d7db', lineHeight: 1.6 }}>
                <div>Hi <strong style={{ color: '#fff' }}>Priya</strong>, thank you for visiting! 🙏</div>
                <div>Your digital bill is ready.</div>
                {/* Services table */}
                <div style={{ marginTop: 8, padding: '8px 10px', background: '#111b21', borderRadius: '8px', border: '1px solid #2a3942' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#8696a0', letterSpacing: '0.08em', marginBottom: 6 }}>SERVICES</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#e9edef' }}>Haircut</span>
                    <span style={{ color: '#e9edef', fontWeight: 600 }}>₹300</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#e9edef' }}>Hair Color</span>
                    <span style={{ color: '#e9edef', fontWeight: 600 }}>₹800</span>
                  </div>
                  <div style={{ borderTop: '1px dashed #3d5060', paddingTop: 6, marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8696a0' }}>Subtotal</span>
                      <span style={{ color: '#d1d7db' }}>₹1,100</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{ color: '#25d366', fontSize: '11px' }}>Gold Member (10%)</span>
                      <span style={{ color: '#25d366', fontSize: '11px' }}>-₹110</span>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #3d5060', paddingTop: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '13px' }}>Total</span>
                      <span style={{ color: '#25d366', fontWeight: 700, fontSize: '13px' }}>₹990</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                      <span style={{ color: '#8696a0', fontSize: '11px' }}>Payment</span>
                      <span style={{ color: '#8696a0', fontSize: '11px' }}>💳 UPI · Paid</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8, color: '#e9edef' }}>Hope to see you again soon! 💖</div>
              </div>
              <div style={{ padding: '0 13px 8px', display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '10px', color: '#8696a0' }}>3:46 PM</span>
              </div>
            </div>
            {/* CTA Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px' }}>
              <div style={{ background: '#1a2730', border: '1px solid #2a3942', padding: '9px 12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 600, color: '#ef4444' }}>
                📄 Download PDF Receipt
              </div>
              <div style={{ background: '#1a2730', border: '1px solid #2a3942', borderRadius: '0 0 12px 12px', padding: '9px 12px', textAlign: 'center', fontSize: '12.5px', fontWeight: 600, color: '#53bdeb', borderTop: '1px solid #0d1418' }}>
                📅 Book Next Appointment
              </div>
            </div>
          </div>
        )}
      </>
    ),
  },
  {
    label: 'Services & Prices',
    render: (showTyping, showBot) => (
      <>
        <CustomerBubble text="💰 Services & Prices" />
        {showTyping && !showBot && <TypingDots />}
        {showBot && (
          <BotCard buttons={['Book Now']}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#e9edef', marginBottom: 4 }}>
              💇 Our Services
            </div>
            <div style={{ color: '#53bdeb', fontSize: '11px', marginBottom: 4 }}>─────────────────</div>
            {[
              ['Haircut', '₹300'],
              ['Hair Color', '₹800'],
              ['Highlights', '₹1200'],
              ['Facial', '₹600'],
              ['Threading', '₹50'],
              ['Full Package', '₹1500'],
            ].map(([name, price]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span>{name}</span>
                <span style={{ color: '#25d366', fontWeight: 600 }}>{price}</span>
              </div>
            ))}
            <div style={{ color: '#53bdeb', fontSize: '11px', marginTop: 4 }}>─────────────────</div>
          </BotCard>
        )}
      </>
    ),
  },
  {
    label: 'My Appointments',
    render: (showTyping, showBot) => (
      <>
        <CustomerBubble text="📋 My Appointments" />
        {showTyping && !showBot && <TypingDots />}
        {showBot && (
          <BotCard buttons={['Book New Appointment']}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#e9edef', marginBottom: 6 }}>
              📋 Your Appointments
            </div>
            <div style={{ fontSize: '10px', color: '#53bdeb', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>
              UPCOMING
            </div>
            <div>✂️ Haircut</div>
            <div>📅 10 May, 2:30 PM</div>
            <div>👤 Priya</div>
            <div style={{ fontSize: '10px', color: '#8696a0', fontWeight: 700, letterSpacing: '0.08em', margin: '8px 0 4px' }}>
              PAST
            </div>
            <div>🏆 Facial — 2 Apr, 11:00 AM</div>
            <div>🏆 Hair Color — 15 Mar, 3 PM</div>
          </BotCard>
        )}
      </>
    ),
  },
];

/* ─── WhatsApp Phone Mockup ───────────────────────── */
function WhatsAppMockup() {
  const [screenIdx, setScreenIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [showTyping, setShowTyping] = useState(false);
  const [showBot, setShowBot] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAll = () => {
    timers.current.forEach(t => clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    // Reset state for new screen
    setVisible(true);
    setShowTyping(false);
    setShowBot(false);
    setShowExtra(false);

    const t1 = setTimeout(() => setShowTyping(true), 400);
    const t2 = setTimeout(() => setShowBot(true), 1200);
    const t3 = setTimeout(() => setShowExtra(true), 2400);
    // Fade out before advancing
    const t4 = setTimeout(() => setVisible(false), 4800);
    const t5 = setTimeout(() => {
      setScreenIdx(p => (p + 1) % SCREENS.length);
    }, 5400);

    timers.current = [t1, t2, t3, t4, t5];
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenIdx]);

  const screen = SCREENS[screenIdx];

  return (
    <div className="phone-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {/* Flow label above phone */}
      <div style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: '#53bdeb', background: 'rgba(83,189,235,0.1)', border: '1px solid rgba(83,189,235,0.25)',
        borderRadius: '20px', padding: '4px 14px',
        transition: 'opacity 400ms ease',
        opacity: visible ? 1 : 0,
        minWidth: '140px', textAlign: 'center',
      }}>
        {screen.label}
      </div>

      <div className="phone-glow" />

      {/* Phone shell — fade in/out on screen change */}
      <div
        className="phone-shell"
        style={{
          transition: 'opacity 500ms ease, transform 500ms ease',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        <div className="phone-notch" />
        <div className="phone-screen">

          {/* WhatsApp header — always Glamour Salon */}
          <div className="wa-header">
            <div className="wa-back">
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                <path d="M8 2L2 8L8 14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="wa-avatar" style={{ background: '#1a5c2a' }}>GS</div>
            <div className="wa-contact">
              <div className="wa-contact-name">Glamour Salon</div>
              <div className="wa-contact-status">
                <span className="wa-online-dot" />
                online
              </div>
            </div>
          </div>

          {/* Chat body */}
          <div className="wa-body" style={{ display: 'flex', flexDirection: 'column', padding: '10px 10px 6px' }}>
            {screen.render(showTyping, showBot, showExtra)}
          </div>

          {/* Input bar */}
          <div className="wa-input-bar">
            <div className="wa-input-field">Type a message</div>
            <div className="wa-send-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Flow indicator dots */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {SCREENS.map((_, i) => (
          <div key={i} style={{
            width: i === screenIdx ? 18 : 6,
            height: 6,
            borderRadius: 3,
            background: i === screenIdx ? '#53bdeb' : 'rgba(83,189,235,0.25)',
            transition: 'all 400ms ease',
          }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Icon helpers ────────────────────────────────── */
const CheckIcon = ({ color = '#00D084' }: { color?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#020c06">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.9.525 3.676 1.44 5.193L2 22l4.98-1.404A9.951 9.951 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm5.006 14.315c-.21.588-1.228 1.13-1.7 1.17-.44.038-.855.197-2.886-.6-2.45-.97-4.015-3.476-4.135-3.638-.12-.162-.978-1.302-.978-2.483 0-1.181.617-1.763.836-2.003.22-.24.48-.3.64-.3l.46.009c.148.006.345-.056.54.413.2.48.677 1.662.736 1.782.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.253.31-.36.416-.12.12-.245.25-.105.49.14.24.622.996 1.334 1.613.916.816 1.688 1.068 1.927 1.188.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.15 1.17z" />
  </svg>
);

/* ─── Scroll Counter Component ────────────────────── */
function ScrollCounter({ end, prefix = '', suffix = '', color }: { end: number; prefix?: string; suffix?: string; color: string }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 1800;
          const steps = 60;
          const increment = end / steps;
          let current = 0;
          let step = 0;
          const timer = setInterval(() => {
            step++;
            current = Math.min(current + increment + (increment * Math.random() * 0.5), end);
            setCount(Math.round(current));
            if (step >= steps) { setCount(end); clearInterval(timer); }
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  return (
    <p ref={ref} style={{ fontFamily: "'Outfit', sans-serif", fontSize: '42px', fontWeight: '900', color, margin: '0 0 8px', letterSpacing: '-0.03em' }}>
      {prefix}{count.toLocaleString('en-IN')}{suffix}
    </p>
  );
}

/* ─── Main Page ───────────────────────────────────── */
export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isYearly, setIsYearly] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    const els = document.querySelectorAll('.reveal, .reveal-scale, .reveal-left, .reveal-right, .reveal-stagger, .reveal-item');
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="lp">

      {/* ── NAVBAR ── */}
      <header className={`lp nav ${isScrolled ? 'pinned' : ''}`}>
        <div className="wrap nav-inner">
          <div className="logo">Snip &amp; Glow <div className="logo-dot" /></div>
          <nav className="nav-links">
            <a href="#how-it-works">How It Works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="nav-login-btn"
              onClick={() => navigate(user ? '/' : '/login')}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', padding: '8px 20px', borderRadius: '10px',
                fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                transition: 'all 200ms',
              }}
            >
              {user ? 'Dashboard' : 'Login'}
            </button>
            <button className="nav-cta" id="nav-cta-btn" onClick={() => navigate(user ? '/' : '/signup')}>
              {user ? 'Open Dashboard →' : 'Start Free Trial'}
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="lp hero" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(225,29,72,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 40%), var(--bg)' }}>
        {/* Animated gradient orbs instead of gym video */}
        <div style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
        }}>
          <div style={{
            position: 'absolute', top: '10%', left: '5%', width: '500px', height: '500px',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(225,29,72,0.12) 0%, transparent 70%)',
            filter: 'blur(60px)', animation: 'float 8s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: '10%', right: '10%', width: '400px', height: '400px',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
            filter: 'blur(50px)', animation: 'float 10s ease-in-out infinite reverse',
          }} />
          <div style={{
            position: 'absolute', top: '40%', right: '30%', width: '300px', height: '300px',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,208,132,0.06) 0%, transparent 70%)',
            filter: 'blur(40px)', animation: 'float 12s ease-in-out infinite',
          }} />
        </div>

        <div className="wrap hero-inner" style={{ position: 'relative', zIndex: 2 }}>
          {/* LEFT — Copy & CTAs */}
          <div className="hero-left">
            <div className="hero-badge">
              <div className="hero-badge-dot" />
              WhatsApp Booking for Salons
            </div>
            <h1>
              Your salon on<br />
              WhatsApp.
            </h1>
            <div className="hero-roll-container">
              <div className="hero-roll-track">
                <div className="hero-roll-item" style={{ color: '#E11D48' }}>Book appointments.</div>
                <div className="hero-roll-item" style={{ color: '#F59E0B' }}>Send reminders.</div>
                <div className="hero-roll-item" style={{ color: '#3B82F6' }}>Manage clients.</div>
                <div className="hero-roll-item" style={{ color: '#8B5CF6' }}>Grow revenue.</div>
                <div className="hero-roll-item" style={{ color: '#E11D48' }}>Book appointments.</div>
              </div>
            </div>
            <p className="hero-sub">
              Clients book appointments, check services, and get reminders — all inside WhatsApp. No app downloads. No missed bookings. Your salon runs on autopilot.
            </p>
            <div className="hero-ctas">
              <button className="btn-primary" id="hero-start-btn" onClick={() => navigate(user ? '/' : '/signup')}>
                <WhatsAppIcon />
                {user ? 'Go to Dashboard' : 'Start 14-Day Free Trial'}
              </button>
              <a href="#how-it-works" className="btn-ghost" style={{ textDecoration: 'none' }}>
                See How It Works ↓
              </a>
              <button
                className="btn-ghost"
                onClick={() => navigate('/book-demo')}
                style={{ border: '1.5px solid #E11D48', color: '#E11D48', background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                📅 Book a Demo
              </button>
            </div>
            <div className="hero-stats">
              <div>
                <div className="hero-stat-val" style={{ color: '#00D084' }}>💬</div>
                <div className="hero-stat-label">WhatsApp booking</div>
              </div>
              <div className="hero-stat-divider" />
              <div>
                <div className="hero-stat-val" style={{ color: '#3B82F6' }}>📋</div>
                <div className="hero-stat-label">Auto reminders</div>
              </div>
              <div className="hero-stat-divider" />
              <div>
                <div className="hero-stat-val" style={{ color: '#8B5CF6' }}>💰</div>
                <div className="hero-stat-label">Service menu</div>
              </div>
              <div className="hero-stat-divider" />
              <div>
                <div className="hero-stat-val" style={{ color: '#E11D48' }}>₹0</div>
                <div className="hero-stat-label">For 14 days</div>
              </div>
            </div>
          </div>

          {/* RIGHT — WhatsApp Phone Mockup */}
          <div className="hero-right">
            <WhatsAppMockup />
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="lp trust" style={{ background: 'linear-gradient(180deg, var(--bg) 0%, var(--surface) 30%, var(--surface) 70%, var(--surface) 100%)' }}>
        <div className="wrap">
          <div className="trust-inner reveal-stagger">
            {[
              { icon: '🔒', label: 'Data stays in your account only' },
              { icon: '✅', label: 'Meta-verified WhatsApp number' },
              { icon: '⚡', label: 'Runs automatically every morning at 9 AM' },
              { icon: '📄', label: 'GST-ready professional invoices' },
            ].map((item) => (
              <div className="trust-item" key={item.label}>
                <div className="trust-icon">
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                </div>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── KEY METRICS CARD ── */}
      <section className="lp" style={{ background: 'var(--surface)', padding: '0 0 60px' }}>
        <div className="wrap">
          <div className="reveal" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px',
            background: '#1a2540', borderRadius: '16px', overflow: 'hidden',
            border: '1px solid #1a2540',
          }}>
            {[
              { value: '82%', label: 'repeat visit recovery' },
              { value: '24/7', label: 'WhatsApp booking assistant' },
              { value: '1 CRM', label: 'for all branches and tenants' },
            ].map((stat) => (
              <div key={stat.value} style={{
                padding: '32px 28px', background: '#0D1117',
              }}>
                <div style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: '32px', fontWeight: '900',
                  color: '#00D084', letterSpacing: '-0.02em', marginBottom: '6px',
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '14px', color: '#8094b4', fontWeight: '500' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT FLOWS ── */}
      <section className="lp" style={{ background: 'linear-gradient(180deg, #0D1117 0%, #131a2b 100%)', padding: '80px 0' }}>
        <div className="wrap">
          <h2 className="reveal" style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: '900', color: '#F0F6FF', lineHeight: '1.15',
            letterSpacing: '-0.03em', marginBottom: '48px', maxWidth: '700px',
          }}>
            Appointments, reminders, and follow-ups flow without front-desk chaos.
          </h2>
          <div className="reveal-stagger" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
          }}>
            {[
              {
                num: '01',
                title: 'Client chats on WhatsApp',
                desc: 'They ask for services, prices, available slots, or staff from the same chat they already use daily.',
              },
              {
                num: '02',
                title: 'Bot books the appointment',
                desc: 'Snip & Glow checks branch calendars, staff timing, service duration, and captures the booking.',
              },
              {
                num: '03',
                title: 'CRM automates retention',
                desc: 'Renewal reminders, no-show nudges, birthday offers, and inactive-client campaigns run in the background.',
              },
            ].map((card) => (
              <div key={card.num} style={{
                padding: '28px 24px', borderRadius: '16px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid #1E293B',
              }}>
                <div style={{
                  fontSize: '14px', fontWeight: '800', color: '#53bdeb',
                  marginBottom: '14px',
                }}>
                  {card.num}
                </div>
                <h3 style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800',
                  color: '#F0F6FF', margin: '0 0 10px', letterSpacing: '-0.01em',
                }}>
                  {card.title}
                </h3>
                <p style={{
                  fontSize: '14px', color: '#8094b4', lineHeight: '1.6', margin: 0,
                }}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SALON COMMAND CENTER ── */}
      <section className="lp" style={{ background: 'linear-gradient(180deg, #0a1018 0%, #0D1117 100%)', padding: '80px 0' }}>
        <div className="wrap">
          <h2 className="reveal" style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: '900', color: '#F0F6FF', lineHeight: '1.15',
            letterSpacing: '-0.03em', marginBottom: '48px', maxWidth: '600px',
          }}>
            Every salon gets a focused command center.
          </h2>

          {/* Dashboard mockup */}
          <div className="reveal" style={{
            borderRadius: '16px', border: '1px solid #1E293B',
            background: '#0B1120', overflow: 'hidden',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr' }}>

              {/* Left sidebar — salon list */}
              <div style={{
                borderRight: '1px solid #1E293B', padding: '20px 16px',
                display: 'flex', flexDirection: 'column', gap: '12px',
              }}>
                {[
                  { initials: 'GS', color: '#10B981', name: 'Glamour Studio', branches: '3 branches' },
                ].map((salon, i) => (
                  <div key={salon.name} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '10px',
                    background: i === 0 ? 'rgba(16,185,129,0.08)' : 'transparent',
                    border: i === 0 ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent',
                    cursor: 'pointer',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: salon.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: '800', color: '#fff',
                    }}>
                      {salon.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#F0F6FF' }}>{salon.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{salon.branches}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right content — appointments */}
              <div style={{ padding: '20px 24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#F0F6FF', margin: '0 0 4px' }}>
                      Today's Appointments
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>42 bookings, 9 renewal reminders queued</p>
                  </div>
                  <div style={{
                    padding: '8px 16px', borderRadius: '20px',
                    background: '#00D084', color: '#020c06',
                    fontSize: '12px', fontWeight: '800',
                  }}>
                    New Campaign
                  </div>
                </div>

                {/* Appointment rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {[
                    { time: '10:30', name: 'Priya Sharma', desc: 'Hair spa renewal · WhatsApp confirmed', status: 'Booked', statusColor: '#10B981' },
                    { time: '12:00', name: 'Aisha Khan', desc: 'Facial package reminder · reply pending', status: 'Nudge', statusColor: '#F59E0B' },
                    { time: '16:15', name: 'Meera Nair', desc: 'Color touch-up · assigned to Riya', status: 'Booked', statusColor: '#10B981' },
                  ].map((appt) => (
                    <div key={appt.time} style={{
                      display: 'grid', gridTemplateColumns: '60px 1fr auto',
                      alignItems: 'center', gap: '16px',
                      padding: '14px 16px', borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.5)', border: '1px solid #1E293B',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#00D084', fontFamily: "'JetBrains Mono', monospace" }}>
                        {appt.time}
                      </span>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#F0F6FF' }}>{appt.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{appt.desc}</div>
                      </div>
                      <span style={{
                        fontSize: '12px', fontWeight: '700', color: appt.statusColor,
                        fontStyle: 'italic',
                      }}>
                        {appt.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BUILT FOR SALON TEAMS ── */}
      <section className="lp" style={{ background: 'linear-gradient(180deg, #131a2b 0%, #0a1018 100%)', padding: '80px 0' }}>
        <div className="wrap">
          <div className="reveal" style={{ marginBottom: '48px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '100px',
              background: 'rgba(0,208,132,0.1)', border: '1px solid rgba(0,208,132,0.25)',
              marginBottom: '20px',
            }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00D084' }} />
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#00D084', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Features</span>
            </div>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: '900', color: '#F0F6FF', lineHeight: '1.15',
              letterSpacing: '-0.03em', maxWidth: '700px',
            }}>
              Built for salon teams that want more bookings with less chasing.
            </h2>
          </div>
          <div className="reveal-stagger" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px',
          }}>
            {[
              {
                title: 'WhatsApp Appointment Booking',
                desc: 'Service menu, slot selection, staff preference, booking confirmation, and reschedule flows.',
              },
              {
                title: 'Automation Engine',
                desc: 'Trigger reminders before visits, after visits, on birthdays, for packages, and for missed appointments.',
              },
              {
                title: 'Renewal Reminders',
                desc: 'Bring clients back for haircuts, color touch-ups, facials, waxing, and membership renewals.',
              },
              {
                title: 'Multi-Tenant CRM',
                desc: 'Manage multiple salons, branches, staff, permissions, customer lists, and campaigns from one console.',
              },
              {
                title: 'Client Management',
                desc: 'Add clients with packages, track visit history, filter by status, and view full payment records.',
              },
              {
                title: 'Dashboard & Analytics',
                desc: 'Real-time stats on active clients, revenue, expiring packages, and automation delivery rates.',
              },
              {
                title: 'GST-Ready Invoicing',
                desc: 'Generate professional PDF invoices with GSTIN, HSN code, itemized billing, and WhatsApp delivery.',
              },
              {
                title: 'Automation Logs',
                desc: 'Every WhatsApp message sent or failed is recorded with timestamps, delivery status, and event type.',
              },
              {
                title: 'Multi-Branch Control Centre',
                desc: 'Switch between branches, compare performance, and run automation independently per location.',
              },
              {
                title: 'Employee Access Control',
                desc: 'Role-based login for stylists, receptionists, and managers. No shared passwords, full accountability.',
              },
              {
                title: 'Lead Pipeline',
                desc: '7-stage pipeline from walk-in to conversion. Source tracking, WhatsApp follow-ups, and analytics.',
              },
              {
                title: 'Expense Tracking',
                desc: 'Log rent, salaries, products, utilities, and repairs. Monthly totals and category breakdowns.',
              },
              {
                title: 'Payment Recording',
                desc: 'Record cash, UPI, card payments. Track partial dues, send instant WhatsApp receipts to clients.',
              },
              {
                title: 'Audit Logs',
                desc: 'Track every action — who added a client, changed a payment, or triggered automation. Full trail.',
              },
            ].map((card) => (
              <div key={card.title} style={{
                padding: '28px 22px', borderRadius: '16px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid #1E293B',
              }}>
                <h3 style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: '800',
                  color: '#F0F6FF', margin: '0 0 12px', lineHeight: '1.3',
                }}>
                  {card.title}
                </h3>
                <p style={{
                  fontSize: '13.5px', color: '#8094b4', lineHeight: '1.65', margin: 0,
                }}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SIMPLE PRICING ── */}
      <section className="lp" style={{ background: '#0a1018', padding: '80px 0' }}>
        <div className="wrap">
          <div className="reveal" style={{ marginBottom: '48px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '100px',
              background: 'rgba(0,208,132,0.1)', border: '1px solid rgba(0,208,132,0.25)',
              marginBottom: '20px',
            }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00D084' }} />
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#00D084', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pricing</span>
            </div>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: '900', color: '#F0F6FF', lineHeight: '1.15',
              letterSpacing: '-0.03em', maxWidth: '600px',
            }}>
              Start lean, then add branches as your salon grows.
            </h2>
          </div>

          <div className="reveal-stagger" style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px',
            maxWidth: '700px',
          }}>
            {/* Starter */}
            <div style={{
              padding: '32px 28px', borderRadius: '16px',
              background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1E293B',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#F0F6FF', marginBottom: '16px' }}>Starter</div>
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '36px', fontWeight: '900', color: '#F0F6FF' }}>₹599</span>
                <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>/mo</span>
              </div>
              <p style={{ fontSize: '13.5px', color: '#8094b4', lineHeight: '1.6', margin: '0 0 24px', flex: 1 }}>
                For single-location salons moving bookings to WhatsApp.
              </p>
              <button onClick={() => navigate(user ? '/' : '/signup')} style={{
                width: '100%', padding: '12px 0', borderRadius: '10px',
                border: '1px solid #334155', background: 'transparent',
                color: '#F0F6FF', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                transition: 'all 200ms',
              }}>
                Start Trial
              </button>
            </div>

            {/* Growth */}
            <div style={{
              padding: '32px 28px', borderRadius: '16px',
              background: 'linear-gradient(160deg, rgba(0,208,132,0.12) 0%, rgba(15,23,42,0.8) 100%)',
              border: '1px solid rgba(0,208,132,0.25)',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#F0F6FF', marginBottom: '16px' }}>Growth</div>
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '36px', fontWeight: '900', color: '#F0F6FF' }}>₹999</span>
                <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>/mo</span>
              </div>
              <p style={{ fontSize: '13.5px', color: '#8094b4', lineHeight: '1.6', margin: '0 0 24px', flex: 1 }}>
                Automation, renewal reminders, staff calendar, and CRM campaigns.
              </p>
              <button onClick={() => navigate(user ? '/' : '/signup')} style={{
                width: '100%', padding: '12px 0', borderRadius: '10px',
                border: 'none', background: 'linear-gradient(135deg, #00D084, #059669)',
                color: '#020c06', fontSize: '14px', fontWeight: '800', cursor: 'pointer',
                transition: 'all 200ms',
              }}>
                Choose Growth
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp how" id="how-it-works" style={{ background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface) 60%, var(--bg) 100%)' }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="section-label">Simple Setup</span>
            <h2 className="section-title">Up and running in minutes</h2>
            <p className="section-sub">
              No complicated setup. Sign up, add your clients, and Snip &amp; Glow handles the rest — automatically, every morning.
            </p>
          </div>
          <div className="steps reveal-stagger">
            <div className="step">
              <div className="step-num green">1</div>
              <h4>Create your salon profile</h4>
              <p>Set up your salon in 2 minutes. One click with Google — no forms, no card needed.</p>
            </div>
            <div className="step">
              <div className="step-num blue">2</div>
              <h4>Add your clients</h4>
              <p>Add clients with their package, start date, and phone number. Status is auto-calculated daily.</p>
            </div>
            <div className="step">
              <div className="step-num amber">3</div>
              <h4>Automation runs daily</h4>
              <p>Every morning at 9 AM, Snip &amp; Glow checks expiries and fires the right WhatsApp — no action needed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE DASHBOARD PREVIEW ── */}
      <section className="lp" style={{ background: 'linear-gradient(180deg, var(--bg) 0%, #020617 100%)', padding: '80px 0 60px', overflow: 'hidden' }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="section-label">Dashboard Preview</span>
            <h2 className="section-title">Beautifully designed. Incredibly powerful.</h2>
            <p className="section-sub">Click the sidebar to explore each module. Everything you need to run your salon — in one clean, fast dashboard.</p>
          </div>
          <div className="reveal-scale">
            <InteractiveDashboard />
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp" id="features" style={{ background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg) 70%, var(--surface) 100%)' }}>
        <div className="wrap">
          <div className="section-head reveal">
            <span className="section-label">Everything Included</span>
            <h2 className="section-title">Built specifically<br />for salon owners</h2>
            <p className="section-sub">
              Every feature was designed around how salons actually work — not a generic CRM adapted for beauty.
            </p>
          </div>
          <div className="features-grid">

            <div className="feat-card wide reveal-item" style={{ background: 'linear-gradient(135deg, rgba(0,208,132,0.06), var(--card))', borderColor: 'rgba(0,208,132,0.2)' }}>
              <div className="feat-icon green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D084" strokeWidth="2.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>WhatsApp Automation Engine</h3>
              <p>
                Snip &amp; Glow automatically sends WhatsApp messages via your AiSensy integration. Clients get a reminder 3 days before expiry, a final alert on expiry day, and a win-back follow-up 2 days later. Every message is logged with full delivery status.
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
                {['D-3 Renewal Reminder', 'D-0 Expiry Alert', 'D+2 Win-Back', 'Auto Dedup', 'Delivery Logs'].map(tag => (
                  <span key={tag} style={{ padding: '5px 12px', borderRadius: '8px', background: 'var(--primary-dim)', color: '#00D084', fontSize: '12px', fontWeight: '700', border: '1px solid rgba(0,208,132,0.2)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="feat-card reveal-item">
              <div className="feat-icon blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3>Client Management</h3>
              <p>Add and manage all salon clients. Search, filter by status (Active / Expiring / Expired), track packages, and view full payment history.</p>
            </div>

            <div className="feat-card reveal-item">
              <div className="feat-icon amber">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </div>
              <h3>Dashboard &amp; Analytics</h3>
              <p>See active, expiring, and expired clients at a glance. Watch your automation run live with real-time counters and message delivery stats.</p>
            </div>

            <div className="feat-card reveal-item">
              <div className="feat-icon red">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h3>GST-Ready Invoicing</h3>
              <p>Generate professional PDF invoices with GST number, HSN code, and itemized billing. Send invoices instantly to clients over WhatsApp.</p>
            </div>

            <div className="feat-card reveal-item">
              <div className="feat-icon purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2.2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h3>Automation Logs</h3>
              <p>Every message sent or failed is recorded. Filter by event type (D-3, D-0, D+2) or delivery status. Full transparency always.</p>
            </div>

            <div className="feat-card reveal-item">
              <div className="feat-icon green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D084" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3>Service Packages</h3>
              <p>Define your own monthly, quarterly, or annual packages with custom durations and prices. Status is auto-calculated from package end dates.</p>
            </div>

            {/* ── Multi-Branch ── */}
            <div className="feat-card reveal-item">
              <div className="feat-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <path d="M14 17.5h7M17.5 14v7"/>
                </svg>
              </div>
              <h3>Multi-Branch Dashboard</h3>
              <p>Manage multiple salon branches from a single login. Switch between branches, view unified analytics, and run automation independently per location.</p>
            </div>

            {/* ── Staff Access Control ── */}
            <div className="feat-card reveal-item">
              <div className="feat-icon" style={{ background: 'rgba(20,184,166,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 11l-4 4-2-2"/>
                </svg>
              </div>
              <h3>Staff Access Control</h3>
              <p>Grant staff role-based login access — receptionists can add clients, managers see reports, owners control everything. No shared passwords.</p>
            </div>

            {/* ── Audit Logs ── */}
            <div className="feat-card reveal-item">
              <div className="feat-icon" style={{ background: 'rgba(251,146,60,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <path d="M9 15l2 2 4-4"/>
                </svg>
              </div>
              <h3>Audit Logs</h3>
              <p>Track every action — who added a client, who changed a payment, who triggered automation. Full accountability across your entire team.</p>
            </div>

            {/* ── Lead Pipeline ── */}
            <div className="feat-card reveal-item">
              <div className="feat-icon" style={{ background: 'rgba(236,72,153,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>
                </svg>
              </div>
              <h3>Lead Pipeline</h3>
              <p>Track prospects from walk-in to conversion. 7-stage pipeline with source tracking, WhatsApp follow-ups, and conversion analytics.</p>
            </div>

            {/* ── Broadcast ── */}
            <div className="feat-card reveal-item">
              <div className="feat-icon" style={{ background: 'rgba(34,211,238,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2.2">
                  <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
              </div>
              <h3>WhatsApp Broadcast</h3>
              <p>Send bulk WhatsApp messages to all clients, active only, or inactive. AI-powered message composer with quick templates for offers and announcements.</p>
            </div>

            {/* ── Expense Tracking ── */}
            <div className="feat-card reveal-item">
              <div className="feat-icon" style={{ background: 'rgba(244,63,94,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth="2.2">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <h3>Expense Tracking</h3>
              <p>Log rent, salaries, equipment, utilities, and repairs. See monthly totals, category breakdowns, and profit margins at a glance.</p>
            </div>

            {/* ── Inactivity Alerts ── */}
            <div className="feat-card reveal-item">
              <div className="feat-icon" style={{ background: 'rgba(168,85,247,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3>Inactivity Alerts</h3>
              <p>Detect clients who haven't visited for 5 or 10 days. Automated WhatsApp nudges bring them back before they churn.</p>
            </div>

            {/* ── WhatsApp Wallet ── */}
            <div className="feat-card reveal-item">
              <div className="feat-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <h3>WhatsApp Wallet</h3>
              <p>Prepaid wallet for WhatsApp messages. Top up anytime, track usage per message, and never worry about running out mid-automation.</p>
            </div>

            {/* ── OTP Security ── */}
            <div className="feat-card reveal-item">
              <div className="feat-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h3>OTP-Protected Actions</h3>
              <p>Destructive actions like deleting clients or staff require WhatsApp OTP verification. No accidental data loss — ever.</p>
            </div>

            {/* ── Payment Recording ── */}
            <div className="feat-card reveal-item">
              <div className="feat-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.2">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><path d="M7 15h4"/>
                </svg>
              </div>
              <h3>Payment Recording</h3>
              <p>Record cash, UPI, card, or bank payments. Track partial payments, pending dues, and send instant WhatsApp receipts with invoice details.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── AUTOMATION TIMELINE ── */}
      <section className="lp timeline-section" id="automation" style={{ background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface) 70%, var(--bg) 100%)' }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="section-label">Automation Flow</span>
            <h2 className="section-title">The right message<br />at the right time</h2>
            <p className="section-sub">
              Snip &amp; Glow's automation runs every day at 9 AM IST. Here's exactly what happens for each client.
            </p>
          </div>
          <div className="timeline reveal-stagger">
            <div className="tl-item">
              <div className="tl-badge d3">D-3</div>
              <div className="tl-body">
                <h4>Renewal Reminder — 3 days before expiry</h4>
                <p>A friendly heads-up sent before the package lapses. Most renewals happen at this stage.</p>
                <div className="tl-msg">
                  "Your beauty package at <strong>Glamour Studio</strong> expires in <strong>3 days</strong> on 15 Apr. ✨ Don't let your glow fade! Renew today and keep looking your best."
                </div>
              </div>
            </div>
            <div className="tl-item">
              <div className="tl-badge d0">D-0</div>
              <div className="tl-body">
                <h4>Expiry Alert — on the day the package ends</h4>
                <p>Clients who didn't renew get a final alert. Creates urgency without being aggressive.</p>
                <div className="tl-msg">
                  "Your package at <strong>The Hair Lab</strong> expires <strong>TODAY</strong>. 💇‍♀️ Renew now to keep your appointments active and your hair looking fabulous!"
                </div>
              </div>
            </div>
            <div className="tl-item">
              <div className="tl-badge d2">D+2</div>
              <div className="tl-body">
                <h4>Win-Back Follow-up — 2 days after expiry</h4>
                <p>A final message to lapsed clients. This alone recovers a significant portion of lost packages.</p>
                <div className="tl-msg">
                  "Hi <strong>Anjali Singh</strong>! 👋 We miss you at <strong>Luxe Salon</strong>! Your package expired on 10 Apr. Come back and treat yourself — your stylist is waiting! ✨"
                </div>
              </div>
            </div>
            <div className="tl-item">
              <div className="tl-badge pay">PAY</div>
              <div className="tl-body">
                <h4>Payment Receipt — after every collection</h4>
                <p>A professional receipt with invoice number, amount, package, and GST breakdown is sent via WhatsApp instantly after you record a payment.</p>
                <div className="tl-msg">
                  "Payment confirmed for <strong>Radiance Beauty</strong>! 🎉 🧾 Invoice: <strong>SG-2026-0041</strong> | 💰 Amount: ₹<strong>2,360</strong> | 📋 Package: Monthly Glow | ✅ Package Active"
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF STATS ── */}
      <section className="lp" style={{ background: 'linear-gradient(180deg, var(--bg) 0%, #050a12 50%, #050a12 100%)', padding: '80px 0' }}>
        <div className="wrap">
          <div className="lp-stats-grid reveal-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', textAlign: 'center' }}>
            <div style={{ padding: '24px 16px' }}>
              <ScrollCounter end={500} suffix="+" color="#00D084" />
              <p style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '600', margin: 0 }}>Salons Trust Snip &amp; Glow</p>
            </div>
            <div style={{ padding: '24px 16px' }}>
              <ScrollCounter end={50} suffix="K+" color="#3B82F6" />
              <p style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '600', margin: 0 }}>WhatsApp Messages Sent</p>
            </div>
            <div style={{ padding: '24px 16px' }}>
              <ScrollCounter end={2} prefix="₹" suffix="Cr+" color="#F59E0B" />
              <p style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '600', margin: 0 }}>Revenue Recovered</p>
            </div>
            <div style={{ padding: '24px 16px' }}>
              <ScrollCounter end={98} suffix="%" color="#E11D48" />
              <p style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '600', margin: 0 }}>Delivery Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BEFORE vs AFTER ── */}
      <section className="lp" style={{ background: 'linear-gradient(180deg, #050a12 0%, #050a12 60%, var(--bg) 100%)', padding: '80px 0' }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="section-label">The Difference</span>
            <h2 className="section-title">Before vs After Snip &amp; Glow</h2>
          </div>
          <div className="lp-compare-grid reveal-stagger" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
            {/* Before */}
            <div style={{ padding: '32px', borderRadius: '20px', backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p style={{ fontSize: '14px', fontWeight: '800', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 20px' }}>❌ Without Snip &amp; Glow</p>
              {[
                'Manually tracking expiry dates in Excel',
                'Forgetting to follow up with expired clients',
                'No idea which clients are about to lapse',
                'Chasing renewals over phone calls',
                'Zero visibility into revenue leakage',
                'Staff sharing one login — no accountability',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
                  <span style={{ color: '#EF4444', fontSize: '14px', flexShrink: 0, marginTop: '2px' }}>✗</span>
                  <span style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.5' }}>{item}</span>
                </div>
              ))}
            </div>
            {/* After */}
            <div style={{ padding: '32px', borderRadius: '20px', backgroundColor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <p style={{ fontSize: '14px', fontWeight: '800', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 20px' }}>✅ With Snip &amp; Glow</p>
              {[
                'Automated WhatsApp reminders at D-3, D-0, D+2',
                'Clients renew before they even forget',
                'Real-time dashboard shows who\'s expiring',
                'GST invoices generated and sent instantly',
                'Analytics show revenue, expenses, and profit',
                'Role-based access for every staff member',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
                  <span style={{ color: '#10B981', fontSize: '14px', flexShrink: 0, marginTop: '2px' }}>✓</span>
                  <span style={{ fontSize: '14px', color: '#CBD5E1', lineHeight: '1.5' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="lp" style={{ background: 'var(--bg)', padding: '80px 0' }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="section-label">Testimonials</span>
            <h2 className="section-title">Salon owners love Snip &amp; Glow</h2>
          </div>
          <div className="lp-testimonials-grid reveal-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', maxWidth: '960px', margin: '0 auto' }}>
            {[
              { name: 'Sunita Agarwal', salon: 'Glamour Studio, Bangalore', quote: 'We recovered ₹1.2L in the first month just from automated renewal reminders. Clients renew before we even have to ask. This is a game changer for our salon.', rating: 5 },
              { name: 'Meera Nair', salon: 'Luxe Salon, Mumbai', quote: 'The Multi-Branch Dashboard is incredible. I manage 3 salon locations from my phone. My staff has role-based access — no more shared passwords or confusion.', rating: 5 },
              { name: 'Pooja Sharma', salon: 'Radiance Beauty, Hyderabad', quote: 'Lead pipeline + WhatsApp follow-ups = 40% more conversions. The GST invoicing alone saves us hours every week. Snip & Glow pays for itself in the first week.', rating: 5 },
            ].map(t => (
              <div key={t.name} style={{
                padding: '28px', borderRadius: '18px',
                backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid #1E293B',
                display: 'flex', flexDirection: 'column', gap: '16px',
              }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <span key={i} style={{ color: '#FBBF24', fontSize: '16px' }}>★</span>
                  ))}
                </div>
                <p style={{ fontSize: '14px', color: '#CBD5E1', lineHeight: '1.7', margin: 0, fontStyle: 'italic' }}>"{t.quote}"</p>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC', margin: '0 0 2px' }}>{t.name}</p>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>{t.salon}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA BANNER (red gradient) ── */}
      <section style={{
        background: 'linear-gradient(180deg, var(--bg) 0%, #E11D48 15%, #BE123C 50%, #9F1239 85%, var(--bg) 100%)',
        padding: '80px 20px', textAlign: 'center',
      }}>
        <div className="reveal" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '32px', fontWeight: '900', color: '#FFFFFF', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Ready to stop losing clients?
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)', margin: '0 0 28px', lineHeight: '1.6' }}>
            Join 500+ salon owners who automated their renewals and recovered lost revenue. Start your free 14-day trial today.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(user ? '/' : '/signup')}
              style={{
                padding: '16px 32px', borderRadius: '14px', border: 'none',
                backgroundColor: '#FFFFFF', color: '#E11D48',
                fontSize: '16px', fontWeight: '800', cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {user ? 'Go to Dashboard' : 'Start Free Trial — No Card Needed'}
            </button>
            <button
              onClick={() => navigate('/book-demo')}
              style={{
                padding: '16px 32px', borderRadius: '14px',
                border: '2px solid rgba(255,255,255,0.4)', backgroundColor: 'transparent',
                color: '#FFFFFF', fontSize: '16px', fontWeight: '800', cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              📅 Book a Demo
            </button>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="lp" id="pricing" style={{ background: 'var(--bg)' }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="section-label">Pricing</span>
            <h2 className="section-title">Simple, honest pricing</h2>
            <p className="section-sub">
              Start free for 14 days. No credit card required. Upgrade when your salon is ready to scale.
            </p>
          </div>

          {/* Monthly / Yearly Toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '48px' }}>
            <div style={{
              display: 'inline-flex', background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '4px', gap: '4px',
            }}>
              <button
                onClick={() => setIsYearly(false)}
                style={{
                  padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-body)',
                  background: !isYearly ? 'var(--primary)' : 'transparent',
                  color: !isYearly ? '#020c06' : 'var(--text-muted)',
                  transition: 'all 0.2s var(--ease)',
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsYearly(true)}
                style={{
                  padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-body)',
                  background: isYearly ? 'var(--primary)' : 'transparent',
                  color: isYearly ? '#020c06' : 'var(--text-muted)',
                  transition: 'all 0.2s var(--ease)',
                }}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="pricing-grid reveal-stagger">
            {/* ── Starter Card ── */}
            <div className="price-card" style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
                background: 'var(--card)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: '11px', fontWeight: 900,
                padding: '5px 16px', borderRadius: '100px', textTransform: 'uppercase',
                letterSpacing: '0.1em', whiteSpace: 'nowrap',
              }}>
                14-day free trial
              </div>
              <div className="price-tier">Starter</div>
              <div className="price-amount">
                ₹{isYearly ? PLAN_PRICES.starter.yearly.toLocaleString('en-IN') : PLAN_PRICES.starter.monthly}
                <span>/{isYearly ? 'yr' : 'mo'}</span>
              </div>
              <div className="price-desc">For single-location salons getting started</div>
              <ul className="price-features">
                {[
                  '100 clients',
                  '2 staff members',
                  '1 branch',
                  'Basic billing &amp; invoicing',
                  'WhatsApp automations (D-3, D-0, D+2)',
                ].map(f => (
                  <li key={f}><CheckIcon color="#64748B" /> <span dangerouslySetInnerHTML={{ __html: f }} /></li>
                ))}
              </ul>
              <button className="btn-price-ghost" id="starter-cta-btn" onClick={() => navigate(user ? '/' : '/signup')}>Start Free Trial</button>
            </div>

            {/* ── Pro Card ── */}
            <div style={{
              background: 'linear-gradient(135deg, #E11D48, #8B5CF6)',
              borderRadius: '26px', padding: '2px', position: 'relative',
            }}>
              <div className="price-card" style={{
                borderRadius: '24px', border: 'none', position: 'relative',
                background: 'linear-gradient(160deg, #1a0a20 0%, var(--card) 100%)',
              }}>
                <div style={{
                  position: 'absolute', top: '-14px', left: '20px',
                  background: 'linear-gradient(135deg, #E11D48, #BE123C)',
                  color: '#FFFFFF', fontSize: '11px', fontWeight: 900,
                  padding: '5px 16px', borderRadius: '100px', textTransform: 'uppercase',
                  letterSpacing: '0.1em', whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(225,29,72,0.4)',
                }}>
                  🔥 Most Popular
                </div>
                <div style={{
                  position: 'absolute', top: '-14px', right: '20px',
                  background: 'var(--card)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontSize: '11px', fontWeight: 900,
                  padding: '5px 16px', borderRadius: '100px', textTransform: 'uppercase',
                  letterSpacing: '0.1em', whiteSpace: 'nowrap',
                }}>
                  14-day free trial
                </div>
                <div className="price-tier" style={{ color: '#00D084', marginTop: '10px' }}>Pro</div>
                <div className="price-amount">
                  ₹{isYearly ? PLAN_PRICES.pro.yearly.toLocaleString('en-IN') : PLAN_PRICES.pro.monthly}
                  <span>/{isYearly ? 'yr' : 'mo'}</span>
                </div>
                <div className="price-desc">For growing salons that need everything</div>
                <ul className="price-features">
                  {[
                    'Unlimited clients',
                    'Unlimited staff members',
                    'Unlimited branches',
                    'WhatsApp automations (D-3, D-0, D+2)',
                    'Inactivity alerts (D-5, D-10)',
                    'WhatsApp broadcasting',
                    'Lead pipeline & conversion tracking',
                    'Expense tracking & profit reports',
                    'Advanced analytics & dashboards',
                    'Global view (all branches)',
                    'Role-based staff access control',
                    'OTP-protected actions',
                    'Audit trails & activity logs',
                    'Priority support',
                  ].map(f => (
                    <li key={f} style={{ color: '#94a3b8' }}><CheckIcon color="#00D084" /> {f}</li>
                  ))}
                </ul>
                <button className="btn-price-primary" id="pro-cta-btn" onClick={() => navigate(user ? '/' : '/signup')}>Start Free Trial</button>
              </div>
            </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: '40px', fontSize: '14px', color: 'var(--text-muted)' }}>
            Both plans include a <strong style={{ color: 'var(--text)' }}>14-day free trial</strong>. No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="lp cta-banner">
        <div className="wrap">
          <div className="cta-inner reveal-scale">
            <h2>Ready to stop chasing<br />expired packages?</h2>
            <p>Set it up once. Snip &amp; Glow runs every morning and recovers your salon's revenue — automatically.</p>
            <div className="cta-btns">
              <button className="btn-primary" id="final-cta-btn" onClick={() => navigate(user ? '/' : '/signup')} style={{ minWidth: '240px', justifyContent: 'center' }}>
                <WhatsAppIcon />
                {user ? 'Go to Dashboard' : 'Get Started Free — 14 Days'}
              </button>
              <a href="#how-it-works" className="btn-ghost" style={{ textDecoration: 'none' }}>See How It Works</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp">
        <div className="wrap">
          <div className="footer-inner">
            <div className="logo">Snip &amp; Glow <div className="logo-dot" /></div>
            <nav className="footer-links">
              <a href="#how-it-works">How It Works</a>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
            </nav>
            <button className="nav-cta" onClick={() => navigate(user ? '/' : '/signup')}>
              {user ? 'Dashboard' : 'Start Free Trial'}
            </button>
          </div>
          <p className="footer-copy">
            © 2026 Snip &amp; Glow — Built for Indian Salon Owners.{' '}
            Crafted with ❤️ by{' '}
            <a
              href="https://pixalara.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#00D084', fontWeight: 700, textDecoration: 'none', transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Pixalara
            </a>
            {' '}
            <span style={{ color: '#64748B', fontSize: '11px' }}>·</span>
            {' '}
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
              A DPIIT Recognized Startup by Govt. of India
            </span>
          </p>
          {/* Social Media Links */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '16px' }}>
            <a href="https://www.linkedin.com/company/pixalara/" target="_blank" rel="noopener noreferrer" title="LinkedIn" style={{ color: '#64748B', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#0A66C2')} onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://x.com/pixalara" target="_blank" rel="noopener noreferrer" title="X (Twitter)" style={{ color: '#64748B', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')} onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://www.instagram.com/pixalara/" target="_blank" rel="noopener noreferrer" title="Instagram" style={{ color: '#64748B', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#E4405F')} onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <a href="https://www.youtube.com/@pixalara" target="_blank" rel="noopener noreferrer" title="YouTube" style={{ color: '#64748B', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#FF0000')} onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>
          {/* Legal Links */}
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '/terms' },
              { label: 'Refund Policy', href: '/refund' },
              { label: 'Contact', href: 'mailto:hello@pixalara.com' },
            ].map(link => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith('mailto') ? undefined : '_blank'}
                rel="noopener noreferrer"
                style={{
                  fontSize: '12px', fontWeight: '600', color: '#64748B',
                  textDecoration: 'none', transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#00D084')}
                onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
