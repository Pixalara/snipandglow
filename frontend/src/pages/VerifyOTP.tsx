// PingFlow — Dual OTP Verification Page
// 6-box inputs for Email OTP + WhatsApp OTP with retry limits

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { auth } from '@/services/firebase';
import { toast } from '@/components/ui/Toast';

function OTPBoxes({ value, onChange, label, icon, verified }: {
  value: string; onChange: (v: string) => void; label: string; icon: string; verified: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  const handleChange = (idx: number, char: string) => {
    const clean = char.replace(/\D/g, '');
    if (!clean && char !== '') return;
    const arr = digits.slice();
    arr[idx] = clean;
    const newVal = arr.join('').slice(0, 6);
    onChange(newVal);
    if (clean && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: icon === 'email' ? '#EFF6FF' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon === 'email' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          )}
        </div>
        <span style={{ fontSize: '12px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        {verified && <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '700' }}>✓ Entered</span>}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }} onPaste={handlePaste}>
        {[0,1,2,3,4,5].map(i => (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i] || ''}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            style={{
              width: '48px', height: '56px', textAlign: 'center',
              fontSize: '22px', fontWeight: '800', fontFamily: "'JetBrains Mono', monospace",
              borderRadius: '12px', outline: 'none',
              border: `2px solid ${digits[i] ? (verified ? '#10B981' : '#E11D48') : '#E2E8F0'}`,
              backgroundColor: digits[i] ? '#FAFBFC' : '#FFF',
              color: '#0F172A', transition: 'all 150ms',
            }}
            onFocus={e => e.target.style.borderColor = '#E11D48'}
            onBlur={e => e.target.style.borderColor = digits[i] ? (verified ? '#10B981' : '#CBD5E1') : '#E2E8F0'}
          />
        ))}
      </div>
    </div>
  );
}

export default function VerifyOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { verificationId?: string; email?: string; phoneLast4?: string; name?: string } | null;

  const [emailCode, setEmailCode] = useState('');
  const [whatsappCode, setWhatsappCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!state?.verificationId) navigate('/signup', { replace: true });
  }, [state, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (isLocked) return;
    setError('');
    if (emailCode.length !== 6) { setError('Enter the 6-digit email code'); return; }
    if (whatsappCode.length !== 6) { setError('Enter the 6-digit WhatsApp code'); return; }

    setIsVerifying(true);
    try {
      const functions = getFunctions(app, 'asia-south1');
      const confirmFn = httpsCallable(functions, 'confirmSignup');
      const result = await confirmFn({
        verificationId: state!.verificationId,
        emailCode,
        whatsappCode,
      });
      const data = result.data as { success: boolean; customToken?: string };

      if (data.success && data.customToken) {
        await signInWithCustomToken(auth, data.customToken);
        toast('Account verified! Welcome to PingFlow 🎉', 'success');
      }
    } catch (err: any) {
      const msg = err.message || 'Verification failed';
      if (msg.includes('Too many') || msg.includes('support')) {
        setIsLocked(true);
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendWhatsApp = async () => {
    if (resendCooldown > 0) return;
    try {
      const functions = getFunctions(app, 'asia-south1');
      const resendFn = httpsCallable(functions, 'resendWhatsAppOTP');
      await resendFn({ verificationId: state!.verificationId });
      toast('New WhatsApp code sent!', 'success');
      setResendCooldown(60);
      setWhatsappCode('');
    } catch (err: any) {
      toast(err.message || 'Failed to resend', 'error');
    }
  };

  if (!state?.verificationId) return null;

  const bothEntered = emailCode.length === 6 && whatsappCode.length === 6;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif", padding: '24px' }}>
      <div className="fade-up" style={{ maxWidth: '460px', width: '100%', backgroundColor: '#FFF', borderRadius: '28px', border: '1px solid #E2E8F0', padding: '40px 32px', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '60px', height: '60px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 10px 25px rgba(225,29,72,0.3)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>Verify Your Identity</h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: '1.5' }}>
            We sent codes to <strong style={{ color: '#0F172A' }}>{state.email}</strong> and WhatsApp ending <strong style={{ color: '#0F172A' }}>****{state.phoneLast4}</strong>
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: '12px', color: '#E11D48', fontSize: '13px', fontWeight: '600', marginBottom: '20px', textAlign: 'center' }}>{error}</div>
        )}

        {/* Locked state — too many attempts */}
        {isLocked ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: '0 0 8px' }}>Verification Locked</p>
            <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 20px' }}>Too many failed attempts. Please contact support.</p>
            <a href="mailto:hello@pixalara.com" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #E11D48, #BE123C)',
              color: '#FFF', textDecoration: 'none', fontSize: '14px', fontWeight: '700',
            }}>
              📧 Contact hello@pixalara.com
            </a>
          </div>
        ) : (
          <>
            {/* Email OTP */}
            <OTPBoxes value={emailCode} onChange={setEmailCode} label="Email Code" icon="email" verified={emailCode.length === 6} />

            {/* WhatsApp OTP */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-28px', position: 'relative', zIndex: 1 }}>
                <button onClick={handleResendWhatsApp} disabled={resendCooldown > 0} style={{
                  background: 'none', border: 'none', fontSize: '11px', fontWeight: '700',
                  color: resendCooldown > 0 ? '#94A3B8' : '#3B82F6', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                }}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
              <OTPBoxes value={whatsappCode} onChange={setWhatsappCode} label="WhatsApp Code" icon="whatsapp" verified={whatsappCode.length === 6} />
            </div>

            {/* Verify Button */}
            <button onClick={handleVerify} disabled={isVerifying || !bothEntered} className="btn-press" style={{
              width: '100%', height: '52px',
              background: bothEntered ? 'linear-gradient(135deg, #E11D48, #BE123C)' : '#94A3B8',
              color: '#FFF', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '800',
              cursor: bothEntered ? 'pointer' : 'not-allowed',
              boxShadow: bothEntered ? '0 8px 20px rgba(225,29,72,0.25)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              {isVerifying ? (
                <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #FFF', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Verifying...</>
              ) : '✓ Verify & Create Account'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '11px', color: '#94A3B8', marginTop: '14px' }}>Codes expire in 5 minutes</p>
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748B', marginTop: '16px' }}>
          <button onClick={() => navigate('/signup')} style={{ background: 'none', border: 'none', color: '#E11D48', fontWeight: '700', cursor: 'pointer' }}>← Back to Signup</button>
        </p>
      </div>
    </div>
  );
}
