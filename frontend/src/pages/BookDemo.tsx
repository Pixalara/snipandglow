// Snip & Glow — Book a Demo Page
// Premium demo booking form with date picker and feature highlights

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';

const FEATURES = [
  { icon: '💬', title: 'WhatsApp Booking', desc: 'Clients book appointments right inside WhatsApp' },
  { icon: '💇', title: 'Client Management', desc: 'Track packages, payments, and visit history' },
  { icon: '🏢', title: 'Multi-Branch', desc: 'Manage all salon locations from one dashboard' },
  { icon: '📊', title: 'Analytics & Reports', desc: 'Revenue, expenses, and conversion data' },
  { icon: '🎯', title: 'Lead Pipeline', desc: 'Track prospects from inquiry to conversion' },
  { icon: '🔐', title: 'Role-Based Access', desc: 'Branch managers, stylists, receptionists' },
];

function getNextDays(count: number) {
  const days = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

const TIME_SLOTS = ['10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function BookDemoPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gymName, setGymName] = useState('');
  const [city, setCity] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const nextDays = useMemo(() => getNextDays(7), []);

  // Scroll reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('demo-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );
    const els = document.querySelectorAll('.demo-reveal');
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isSubmitted]);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      alert('Please fill in your name, email, and phone number.');
      return;
    }
    if (!selectedDate || !selectedTime) {
      alert('Please pick a date and time for your demo.');
      return;
    }
    setIsSubmitting(true);
    const dateStr = selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    try {
      // Send email via Web3Forms (primary)
      const web3Res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: 'fcd8310c-f05c-4b4f-ba0f-42a269b7ea9d',
          subject: `🎯 New Demo Request — ${name.trim()} (${gymName.trim() || 'No salon name'})`,
          from_name: 'Snip & Glow Demo Booking',
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: `+91 ${phone.trim()}`,
          salon_name: gymName.trim() || 'Not provided',
          city: city.trim() || 'Not provided',
          client_count: memberCount.trim() || 'Not provided',
          preferred_date: dateStr,
          preferred_time: selectedTime,
          message: `Demo request from ${name.trim()}\n\nSalon: ${gymName.trim() || 'N/A'}\nCity: ${city.trim() || 'N/A'}\nClients: ${memberCount.trim() || 'N/A'}\nPhone: +91 ${phone.trim()}\nEmail: ${email.trim()}\n\nPreferred slot: ${dateStr} at ${selectedTime}`,
        }),
      });
      const web3Data = await web3Res.json();
      if (!web3Data.success) {
        console.error('Web3Forms error:', web3Data);
        throw new Error('Failed to submit form');
      }

      // Also save to Firestore for tracking (optional — don't block on failure)
      try {
        await addDoc(collection(db, 'demoRequests'), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        gymName: gymName.trim(),
        city: city.trim(),
        memberCount: memberCount.trim(),
        date: selectedDate.toISOString().split('T')[0],
        time: selectedTime,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      } catch (firestoreErr) {
        console.warn('Firestore save failed (non-blocking):', firestoreErr);
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Demo booking failed:', err);
      alert('Something went wrong. Please try again or email us at hello@pixalara.com');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '50px', padding: '0 18px', borderRadius: '14px',
    border: '1px solid #1E293B', backgroundColor: '#0F172A', color: '#F8FAFC',
    fontSize: '14px', fontFamily: "'Inter', sans-serif", outline: 'none',
    transition: 'border-color 200ms', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: '700', color: '#CBD5E1',
    marginBottom: '8px',
  };

  if (isSubmitted) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, #020617 0%, #0F172A 100%)',
        fontFamily: "'Inter', sans-serif", padding: '40px 20px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎉</div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '32px', fontWeight: '900', color: '#F8FAFC', margin: '0 0 12px' }}>
            Demo Booked!
          </h1>
          <p style={{ fontSize: '16px', color: '#94A3B8', lineHeight: '1.7', margin: '0 0 8px' }}>
            We'll reach out to you on WhatsApp at <span style={{ color: '#00D084', fontWeight: '700' }}>+91 {phone}</span> to confirm your slot.
          </p>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 32px' }}>
            {selectedDate?.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} at {selectedTime}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={() => navigate('/')} style={{
              padding: '14px 28px', borderRadius: '14px', border: 'none',
              background: 'linear-gradient(135deg, #E11D48, #BE123C)',
              color: '#FFF', fontSize: '15px', fontWeight: '800', cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(225,29,72,0.3)',
            }}>
              Back to Home
            </button>
            <button onClick={() => navigate('/signup')} style={{
              padding: '14px 28px', borderRadius: '14px',
              border: '1.5px solid #00D084', background: 'transparent',
              color: '#00D084', fontSize: '15px', fontWeight: '800', cursor: 'pointer',
            }}>
              Start Free Trial
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #020617 0%, #0F172A 50%, #020617 100%)',
      fontFamily: "'Inter', sans-serif",
      color: '#F8FAFC',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '10px', overflow: 'hidden' }}>
            <img src="/pingflow-logo.svg" alt="Snip & Glow" style={{ width: '100%', height: '100%' }} />
          </div>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '900', letterSpacing: '-0.02em' }}>Snip & Glow</span>
        </div>
        <button onClick={() => navigate('/signup')} style={{
          padding: '10px 20px', borderRadius: '10px', border: 'none',
          background: 'linear-gradient(135deg, #E11D48, #BE123C)',
          color: '#FFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
        }}>
          Start Free Trial
        </button>
      </div>

      {/* Hero */}
      <div className="demo-reveal" style={{ textAlign: 'center', padding: '40px 20px 20px', maxWidth: '700px', margin: '0 auto' }}>
        <span style={{ fontSize: '12px', fontWeight: '800', color: '#E11D48', textTransform: 'uppercase', letterSpacing: '0.15em' }}>BOOK A DEMO</span>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '40px', fontWeight: '900', margin: '12px 0 16px', letterSpacing: '-0.03em', lineHeight: '1.1' }}>
          See Snip & Glow in action
        </h1>
        <p style={{ fontSize: '16px', color: '#94A3B8', lineHeight: '1.6', maxWidth: '500px', margin: '0 auto' }}>
          15-minute live walkthrough. See how Snip & Glow automates bookings, manages clients, and grows your salon. No sales pressure.
        </p>
      </div>

      {/* Main Content */}
      <div className="lp-demo-grid" style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 20px 80px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>

        {/* Left: Form */}
        <div className="demo-reveal" style={{
          backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1E293B',
          borderRadius: '20px', padding: '32px',
          backdropFilter: 'blur(12px)',
        }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '800', margin: '0 0 24px' }}>Your Details</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Priya Sharma"
                onFocus={e => e.currentTarget.style.borderColor = '#E11D48'}
                onBlur={e => e.currentTarget.style.borderColor = '#1E293B'}
              />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="priya@mysalon.com"
                onFocus={e => e.currentTarget.style.borderColor = '#E11D48'}
                onBlur={e => e.currentTarget.style.borderColor = '#1E293B'}
              />
            </div>
            <div>
              <label style={labelStyle}>Phone *</label>
              <div style={{ display: 'flex' }}>
                <div style={{ height: '50px', padding: '0 14px', display: 'flex', alignItems: 'center', backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRight: 'none', borderRadius: '14px 0 0 14px', color: '#64748B', fontSize: '14px', fontWeight: '700' }}>+91</div>
                <input style={{ ...inputStyle, borderRadius: '0 14px 14px 0' }} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210"
                  onFocus={e => e.currentTarget.style.borderColor = '#E11D48'}
                  onBlur={e => e.currentTarget.style.borderColor = '#1E293B'}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Salon Name</label>
                <input style={inputStyle} value={gymName} onChange={e => setGymName(e.target.value)} placeholder="Glamour Studio"
                  onFocus={e => e.currentTarget.style.borderColor = '#E11D48'}
                  onBlur={e => e.currentTarget.style.borderColor = '#1E293B'}
                />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input style={inputStyle} value={city} onChange={e => setCity(e.target.value)} placeholder="Bangalore"
                  onFocus={e => e.currentTarget.style.borderColor = '#E11D48'}
                  onBlur={e => e.currentTarget.style.borderColor = '#1E293B'}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Number of Clients</label>
              <input style={inputStyle} value={memberCount} onChange={e => setMemberCount(e.target.value)} placeholder="e.g. 150"
                onFocus={e => e.currentTarget.style.borderColor = '#E11D48'}
                onBlur={e => e.currentTarget.style.borderColor = '#1E293B'}
              />
              <p style={{ fontSize: '11px', color: '#64748B', margin: '6px 0 0' }}>Helps us tailor the demo to your salon's size</p>
            </div>
          </div>
        </div>

        {/* Right: Date/Time Picker */}
        <div className="demo-reveal" style={{
          backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid #1E293B',
          borderRadius: '20px', padding: '32px',
          backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', gap: '24px',
        }}>
          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '800', margin: '0 0 16px' }}>Pick a Date</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {nextDays.map((d, i) => {
                const isSelected = selectedDate?.toDateString() === d.toDateString();
                const isToday = i === 0;
                const isSunday = d.getDay() === 0;
                return (
                  <button
                    key={i}
                    onClick={() => !isSunday && setSelectedDate(d)}
                    disabled={isSunday}
                    style={{
                      width: '72px', padding: '10px 0', borderRadius: '12px', cursor: isSunday ? 'not-allowed' : 'pointer',
                      border: isSelected ? '2px solid #E11D48' : '1px solid #1E293B',
                      backgroundColor: isSelected ? 'rgba(225,29,72,0.15)' : isSunday ? '#0B1120' : '#0F172A',
                      color: isSunday ? '#334155' : isSelected ? '#E11D48' : '#CBD5E1',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      transition: 'all 200ms',
                      opacity: isSunday ? 0.4 : 1,
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.06em' }}>
                      {isToday ? 'TODAY' : DAY_NAMES[d.getDay()]}
                    </span>
                    <span style={{ fontSize: '22px', fontWeight: '900', fontFamily: "'Outfit', sans-serif" }}>
                      {d.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '800', margin: '0 0 16px' }}>Pick a Time</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {TIME_SLOTS.map(time => {
                const isSelected = selectedTime === time;
                // Check if this time slot is in the past (only for today)
                const isToday = selectedDate?.toDateString() === new Date().toDateString();
                let isPast = false;
                if (isToday) {
                  const now = new Date();
                  const [rawTime, period] = time.split(' ');
                  const [hStr] = rawTime.split(':');
                  let hour = parseInt(hStr);
                  if (period === 'PM' && hour !== 12) hour += 12;
                  if (period === 'AM' && hour === 12) hour = 0;
                  isPast = now.getHours() >= hour;
                }
                return (
                  <button
                    key={time}
                    onClick={() => !isPast && setSelectedTime(time)}
                    disabled={isPast}
                    style={{
                      padding: '12px 0', borderRadius: '10px', cursor: isPast ? 'not-allowed' : 'pointer',
                      border: isSelected ? '2px solid #E11D48' : '1px solid #1E293B',
                      backgroundColor: isSelected ? 'rgba(225,29,72,0.15)' : isPast ? '#0B1120' : '#0F172A',
                      color: isSelected ? '#E11D48' : isPast ? '#334155' : '#CBD5E1',
                      fontSize: '13px', fontWeight: '700',
                      transition: 'all 200ms',
                      opacity: isPast ? 0.4 : 1,
                      textDecoration: isPast ? 'line-through' : 'none',
                    }}
                  >
                    {time}
                  </button>
                );
              })}
              {/* Show hint if today and all slots are past */}
              {selectedDate?.toDateString() === new Date().toDateString() && (() => {
                const now = new Date();
                const allPast = TIME_SLOTS.every(time => {
                  const [rawTime, period] = time.split(' ');
                  const [hStr] = rawTime.split(':');
                  let hour = parseInt(hStr);
                  if (period === 'PM' && hour !== 12) hour += 12;
                  if (period === 'AM' && hour === 12) hour = 0;
                  return now.getHours() >= hour;
                });
                return allPast ? (
                  <p style={{ gridColumn: 'span 3', fontSize: '12px', color: '#F59E0B', textAlign: 'center', margin: '8px 0 0' }}>
                    ⚠️ No slots available today. Please pick another date.
                  </p>
                ) : null;
              })()}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              width: '100%', height: '54px', borderRadius: '14px', border: 'none',
              background: 'linear-gradient(135deg, #E11D48, #BE123C)',
              color: '#FFF', fontSize: '16px', fontWeight: '800', cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(225,29,72,0.35)',
              transition: 'all 200ms', opacity: isSubmitting ? 0.7 : 1,
              fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.01em',
            }}
          >
            {isSubmitting ? 'Booking...' : 'Book My Demo →'}
          </button>

          <p style={{ fontSize: '12px', color: '#475569', textAlign: 'center', margin: 0 }}>
            🔒 Your data is safe. We never share your information with third parties.
          </p>
        </div>
      </div>

      {/* Feature Highlights */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px 80px' }}>
        <h3 className="demo-reveal" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#94A3B8', textAlign: 'center', margin: '0 0 24px' }}>
          What you'll see in the demo
        </h3>
        <div className="lp-demo-features" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {FEATURES.map(f => (
            <div key={f.title} className="demo-reveal" style={{
              padding: '20px', borderRadius: '14px',
              backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1E293B',
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>{f.icon}</div>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC', margin: '0 0 4px' }}>{f.title}</p>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
