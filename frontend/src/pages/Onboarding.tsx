// Snip & Glow — Onboarding Page
// Salon setup with high-end aesthetics

import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import type { Gym } from '@/types';

export default function OnboardingPage() {
  const { user, setGym } = useAuthStore();
  const { isMobile } = useResponsive();
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.phoneNumber && !phone) {
      setPhone(user.phoneNumber);
    }
  }, [user, phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!salonName.trim()) { setError('Please enter your salon name'); return; }
    if (!ownerName.trim()) { setError('Please enter your full name'); return; }
    if (!user) { setError('Session expired. Please login again.'); return; }

    setIsLoading(true);

    try {
      const gymData = {
        name: salonName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim() || user.phoneNumber || '',
        email: user.email,
        photoURL: user.photoURL || '',
        onboardingComplete: true,
      };

      await setDoc(doc(db, 'gyms', user.uid), gymData, { merge: true });
      setGym({ ...gymData, isActive: true } as unknown as Gym);
    } catch (error: any) {
      console.error('Firestore write failed:', error.code, error.message);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      minHeight: '100vh',
      backgroundColor: '#FAFBFC',
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* LEFT PANEL — Value Proposition */}
      {!isMobile && (
        <div style={{
          width: '42%',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          color: '#FFFFFF'
        }}>
          <div style={{
            position: 'absolute', top: '10%', right: '-10%',
            width: '300px', height: '300px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(225,29,72,0.1) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }} />

          <div style={{ zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '80px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 20px rgba(5,8,16,0.3)' }}>
                <img src="/pingflow-logo.svg" alt="Snip & Glow" style={{ width: '100%', height: '100%' }} />
              </div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: '900', color: '#FFFFFF', letterSpacing: '-1px' }}>Snip & Glow</span>
            </div>

            <h1 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: '42px', fontWeight: '900', lineHeight: '1.1',
              color: '#FFFFFF', marginBottom: '32px', letterSpacing: '-2px'
            }}>
              Your salon's growth, on autopilot.
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { title: 'Automated Reminders', desc: 'Auto-send membership renewal notices via WhatsApp.' },
                { title: 'Smart Retention', desc: 'Identify inactive clients before they stop coming.' },
                { title: 'Unified Billing', desc: 'One clean system for all payments and invoices.' }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF', margin: '0 0 4px' }}>{item.title}</p>
                    <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, fontWeight: '500', lineHeight: '1.5' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: '24px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: '16px',
            zIndex: 10
          }}>
            <div style={{ display: 'flex' }}>
              {[1,2,3,4].map((n) => (
                <img key={n} src={`https://i.pravatar.cc/100?u=${n}`} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #0F172A', marginLeft: n === 1 ? 0 : '-10px' }} alt="" />
              ))}
            </div>
            <p style={{ fontSize: '13px', color: '#CBD5E1', margin: 0, fontWeight: '600' }}>
              Join <span style={{ color: '#E11D48', fontWeight: '800' }}>140+ salon owners</span> automating their operations this week.
            </p>
          </div>
        </div>
      )}

      {/* RIGHT PANEL — Setup Form */}
      <div style={{
        flex: 1,
        padding: isMobile ? '40px 24px' : '40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', overflow: 'hidden' }}>
              <img src="/pingflow-logo.svg" alt="Snip & Glow" style={{ width: '100%', height: '100%' }} />
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px' }}>Snip & Glow</span>
          </div>
        )}

        <div className="fade-up" style={{ maxWidth: '440px', width: '100%' }}>

          {/* Progress Steps */}
          <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid #E11D48', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800' }}>✓</div>
            <div style={{ flex: 1, height: '2px', backgroundColor: '#E11D48', margin: '0 8px' }} />
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#E11D48', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', boxShadow: '0 4px 12px rgba(225,29,72,0.3)' }} className="float-anim">2</div>
            <div style={{ flex: 1, height: '2px', backgroundColor: '#F1F5F9', margin: '0 8px' }} />
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#F1F5F9', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800' }}>3</div>
          </div>

          <header style={{ marginBottom: '32px' }}>
            <p style={{ fontSize: '10px', fontWeight: '900', color: '#E11D48', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>Salon Setup</p>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Set Up Your Salon</h2>
            <p style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>Just a few details to get your CRM ready.</p>
          </header>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>SALON NAME *</label>
              <input
                style={{ height: '52px', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '0 18px', fontSize: '15px', color: '#0F172A', outline: 'none', transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)', fontWeight: '600' }}
                placeholder="e.g. Glamour Studio & Spa"
                value={salonName}
                onChange={(e) => { setSalonName(e.target.value); setError(''); }}
                onFocus={e => { e.target.style.borderColor = '#E11D48'; e.target.style.boxShadow = '0 0 0 3px rgba(225,29,72,0.08)'; }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                disabled={isLoading}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>OWNER / DIRECTOR NAME *</label>
              <input
                style={{ height: '52px', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '0 18px', fontSize: '15px', color: '#0F172A', outline: 'none', transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)', fontWeight: '600' }}
                placeholder="e.g. Priya Sharma"
                value={ownerName}
                onChange={(e) => { setOwnerName(e.target.value); setError(''); }}
                onFocus={e => { e.target.style.borderColor = '#E11D48'; e.target.style.boxShadow = '0 0 0 3px rgba(225,29,72,0.08)'; }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                disabled={isLoading}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>CONTACT PHONE</label>
              <div style={{ display: 'flex', height: '52px' }}>
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 15px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRight: 'none', borderRadius: '14px 0 0 14px', fontSize: '14px', color: '#475569', fontWeight: '700' }}>+91</div>
                <input
                  style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: '0 14px 14px 0', padding: '0 18px', fontSize: '15px', color: '#0F172A', outline: 'none', fontWeight: '600' }}
                  placeholder="9988776655"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(''); }}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Account Info */}
            <div style={{ padding: '16px', backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=E11D48&color=FFFFFF`} style={{ width: '38px', height: '38px', borderRadius: '12px' }} alt="User" />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', margin: '0 0 2px', textTransform: 'uppercase' }}>Admin Account</p>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</p>
              </div>
            </div>

            {error && (
              <div style={{ padding: '14px 18px', backgroundColor: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: '14px', color: '#E11D48', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !salonName.trim() || !ownerName.trim()}
              className="btn-press"
              style={{
                height: '60px',
                background: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)',
                color: '#FFFFFF', border: 'none', borderRadius: '16px',
                fontSize: '16px', fontWeight: '800', cursor: 'pointer',
                boxShadow: '0 10px 25px rgba(225,29,72,0.25)',
                transition: 'all 200ms ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                opacity: isLoading || !salonName.trim() || !ownerName.trim() ? 0.4 : 1,
              }}
            >
              {isLoading ? 'SETTING UP YOUR SALON...' : (
                <>
                  GET STARTED
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </>
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#94A3B8', marginTop: '32px', fontWeight: '500' }}>
            Free 14-day trial. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}
