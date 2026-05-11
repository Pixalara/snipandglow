// PingFlow — Signup Page
// Two options: Google OAuth or Email + Magic Link

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { auth, db } from '@/services/firebase';

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignup = async () => {
    setError('');
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userRef = doc(db, 'gyms', result.user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          ownerName: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
          plan: 'trial',
          planStartDate: serverTimestamp(),
          planEndDate: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
          isActive: true,
          isWhatsAppVerified: true, // Bypassed — Meta API not integrated yet
          onboardingComplete: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-up failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Full name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    if (!phone.trim() || phone.replace(/\D/g, '').length !== 10) { setError('Enter a valid 10-digit WhatsApp number'); return; }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setIsLoading(true);
    try {
      const functions = getFunctions(app, 'asia-south1');
      const triggerFn = httpsCallable(functions, 'triggerSignupVerification');
      const result = await triggerFn({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      });
      const data = result.data as { success: boolean; verificationId: string; phoneLast4: string; error?: string };

      if (data.success) {
        // Navigate to OTP verification page
        navigate('/verify-otp', {
          state: {
            verificationId: data.verificationId,
            email: email.trim().toLowerCase(),
            phoneLast4: data.phoneLast4,
            name: name.trim(),
          },
        });
      } else {
        setError(data.error || 'Failed to send verification codes');
      }
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        setError('This email is already registered. Try logging in instead.');
      } else {
        setError(err.message || 'Sign-up failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '50px', padding: '0 16px',
    borderRadius: '12px', border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF', color: '#0F172A',
    fontSize: '14px', fontFamily: "'Inter', sans-serif",
    outline: 'none', transition: 'all 200ms',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: '700',
    color: '#334155', marginBottom: '6px',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif" }}>

      {/* Left panel — attractive value prop with rolling text */}
      <div style={{ display: 'none', width: '42%', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)', padding: '60px', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden', color: '#FFF' }} className="signup-left">
        <style>{`
          @media (min-width: 768px) { .signup-left { display: flex !important; } }
          @keyframes rollUp {
            0%      { transform: translateY(0); }
            15%     { transform: translateY(0); }
            20%     { transform: translateY(-20%); }
            35%     { transform: translateY(-20%); }
            40%     { transform: translateY(-40%); }
            55%     { transform: translateY(-40%); }
            60%     { transform: translateY(-60%); }
            75%     { transform: translateY(-60%); }
            80%     { transform: translateY(-80%); }
            95%     { transform: translateY(-80%); }
            100%    { transform: translateY(-100%); }
          }
          .roll-container { height: 52px; overflow: hidden; }
          .roll-track { animation: rollUp 15s ease-in-out infinite; }
          .roll-item { height: 52px; display: flex; align-items: center; }
        `}</style>

        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: '-20%', right: '-15%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(225,29,72,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', filter: 'blur(50px)' }} />

        <div style={{ zIndex: 10 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 20px rgba(5,8,16,0.3)' }}>
              <img src="/pingflow-logo.svg" alt="Snip & Glow" style={{ width: '100%', height: '100%' }} />
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: '900', letterSpacing: '-1px' }}>Snip & Glow</span>
          </div>

          {/* Trial badge — moved up */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: '24px', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '32px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#10B981' }}>14-day free trial · Full access · No card needed</span>
          </div>

          {/* Headline with rolling text */}
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '36px', fontWeight: '900', lineHeight: '1.15', letterSpacing: '-1.5px', marginBottom: '12px' }}>
            Stop losing clients to
          </h1>
          <div className="roll-container" style={{ marginBottom: '28px' }}>
            <div className="roll-track">
              <div className="roll-item"><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '36px', fontWeight: '900', letterSpacing: '-1.5px', color: '#E11D48' }}>forgotten renewals.</span></div>
              <div className="roll-item"><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '36px', fontWeight: '900', letterSpacing: '-1.5px', color: '#F59E0B' }}>missed follow-ups.</span></div>
              <div className="roll-item"><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '36px', fontWeight: '900', letterSpacing: '-1.5px', color: '#3B82F6' }}>manual tracking.</span></div>
              <div className="roll-item"><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '36px', fontWeight: '900', letterSpacing: '-1.5px', color: '#8B5CF6' }}>lost revenue.</span></div>
              <div className="roll-item"><span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '36px', fontWeight: '900', letterSpacing: '-1.5px', color: '#E11D48' }}>forgotten renewals.</span></div>
            </div>
          </div>

          <p style={{ fontSize: '15px', color: '#94A3B8', lineHeight: '1.7', marginBottom: '40px', maxWidth: '340px' }}>
            Snip & Glow sends WhatsApp reminders automatically — so your salon recovers revenue on autopilot.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: '💬', text: 'WhatsApp booking & reminders', color: '#3B82F6' },
              { icon: '🧾', text: 'GST-ready invoices with one click', color: '#10B981' },
              { icon: '📊', text: 'Real-time client & revenue dashboard', color: '#F59E0B' },
              { icon: '⚡', text: 'Runs every morning at 9 AM — zero effort', color: '#E11D48' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>{item.icon}</div>
                <span style={{ fontSize: '13px', color: '#CBD5E1', fontWeight: '600' }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div className="fade-up" style={{ maxWidth: '420px', width: '100%' }}>

          <div style={{ marginBottom: '8px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: 0 }}>← Back to site</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', overflow: 'hidden' }}>
              <img src="/pingflow-logo.svg" alt="Snip & Glow" style={{ width: '100%', height: '100%' }} />
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>Snip & Glow</span>
          </div>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '26px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Create your account</h2>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 28px' }}>Sign up with Google to get started instantly. No forms, no hassle.</p>

          {/* Trial badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: '#ECFDF5', borderRadius: '10px', border: '1px solid #D1FAE5', marginBottom: '20px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>14-day free trial · Full access · No card needed</span>
          </div>

          {error && (
            <div style={{ padding: '12px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: '12px', color: '#E11D48', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>{error}</div>
          )}

          {/* Google button */}
          <button onClick={handleGoogleSignup} disabled={isLoading} className="btn-press" style={{
            width: '100%', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            backgroundColor: '#FFF', border: '1.5px solid #E2E8F0', borderRadius: '14px', color: '#0F172A',
            fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            opacity: isLoading ? 0.7 : 1,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {isLoading ? 'Signing up...' : 'Continue with Google'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#94A3B8', marginBottom: '24px' }}>
            One click. No passwords. Your salon is ready in 2 minutes.
          </p>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748B', marginTop: '24px' }}>
            Already have an account? <a href="/login" style={{ color: '#E11D48', fontWeight: '700', textDecoration: 'none' }}>Sign in →</a>
          </p>
        </div>
      </div>
    </div>
  );
}
