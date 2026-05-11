// PingFlow — WhatsApp-Only OTP Verification (for Google signup users)

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/Toast';

function OTPBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);
  const verified = value.length === 6;

  const handleChange = (idx: number, char: string) => {
    const clean = char.replace(/\D/g, '');
    if (!clean && char !== '') return;
    const arr = digits.slice();
    arr[idx] = clean;
    onChange(arr.join('').slice(0, 6));
    if (clean && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs.current[idx - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }} onPaste={handlePaste}>
      {[0,1,2,3,4,5].map(i => (
        <input key={i} ref={el => { refs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
          value={digits[i] || ''} onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
          style={{
            width: '48px', height: '56px', textAlign: 'center', fontSize: '22px', fontWeight: '800',
            fontFamily: "'JetBrains Mono', monospace", borderRadius: '12px', outline: 'none',
            border: `2px solid ${digits[i] ? (verified ? '#10B981' : '#10B981') : '#E2E8F0'}`,
            backgroundColor: digits[i] ? '#F0FDF4' : '#FFF', color: '#0F172A', transition: 'all 150ms',
          }}
          onFocus={e => e.target.style.borderColor = '#10B981'}
          onBlur={e => e.target.style.borderColor = digits[i] ? '#10B981' : '#E2E8F0'}
        />
      ))}
    </div>
  );
}

export default function VerifyWhatsAppPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setIsWhatsAppVerified } = useAuthStore();
  const state = location.state as { verificationId?: string; phoneLast4?: string } | null;

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!state?.verificationId) navigate('/complete-profile', { replace: true });
  }, [state, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (isLocked || code.length !== 6) return;
    setError('');
    setIsVerifying(true);
    try {
      const functions = getFunctions(app, 'asia-south1');
      const fn = httpsCallable(functions, 'confirmWhatsAppOTP');
      const result = await fn({ verificationId: state!.verificationId, code });
      const data = result.data as { success: boolean };
      if (data.success) {
        setIsWhatsAppVerified(true);
        toast('WhatsApp verified! 🎉', 'success');
        navigate('/onboarding', { replace: true });
      }
    } catch (err: any) {
      const msg = err.message || 'Verification failed';
      if (msg.includes('Too many') || msg.includes('support')) { setIsLocked(true); }
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const functions = getFunctions(app, 'asia-south1');
      const fn = httpsCallable(functions, 'resendWhatsAppOTP');
      await fn({ verificationId: state!.verificationId });
      toast('New code sent!', 'success');
      setResendCooldown(60);
      setCode('');
    } catch (err: any) { toast(err.message || 'Failed', 'error'); }
  };

  if (!state?.verificationId) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif", padding: '24px' }}>
      <div className="fade-up" style={{ maxWidth: '440px', width: '100%', backgroundColor: '#FFF', borderRadius: '28px', border: '1px solid #E2E8F0', padding: '40px 32px', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #10B981, #059669)', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 20px rgba(16,185,129,0.25)' }}>
            <span style={{ fontSize: '26px' }}>💬</span>
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>Enter WhatsApp Code</h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            We sent a 6-digit code to WhatsApp ending <strong>****{state.phoneLast4}</strong>
          </p>
        </div>

        {error && <div style={{ padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: '12px', color: '#E11D48', fontSize: '13px', fontWeight: '600', marginBottom: '20px', textAlign: 'center' }}>{error}</div>}

        {isLocked ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: '0 0 20px' }}>Too many attempts</p>
            <a href="mailto:hello@pixalara.com" style={{ display: 'inline-flex', padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>📧 Contact hello@pixalara.com</a>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>
              <OTPBoxes value={code} onChange={setCode} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <button onClick={handleResend} disabled={resendCooldown > 0} style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: '700', color: resendCooldown > 0 ? '#94A3B8' : '#3B82F6', cursor: resendCooldown > 0 ? 'default' : 'pointer' }}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>

            <button onClick={handleVerify} disabled={isVerifying || code.length !== 6} className="btn-press" style={{
              width: '100%', height: '52px',
              background: code.length === 6 ? 'linear-gradient(135deg, #10B981, #059669)' : '#94A3B8',
              color: '#FFF', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '800',
              cursor: code.length === 6 ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              {isVerifying ? 'Verifying...' : '✓ Verify WhatsApp'}
            </button>
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748B', marginTop: '16px' }}>
          <button onClick={() => navigate('/complete-profile')} style={{ background: 'none', border: 'none', color: '#E11D48', fontWeight: '700', cursor: 'pointer' }}>← Change number</button>
        </p>
      </div>
    </div>
  );
}
