// PingFlow — Complete Profile (WhatsApp Verification for Google Users)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user, gym } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) { setError('Enter a valid 10-digit WhatsApp number'); return; }

    setIsLoading(true);
    try {
      const functions = getFunctions(app, 'asia-south1');
      const sendFn = httpsCallable(functions, 'sendWhatsAppOnlyOTP');
      const result = await sendFn({ phone: cleanPhone });
      const data = result.data as { success: boolean; verificationId: string; phoneLast4: string };

      if (data.success) {
        navigate('/verify-whatsapp', {
          state: {
            verificationId: data.verificationId,
            phoneLast4: data.phoneLast4,
          },
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif", padding: '24px' }}>
      <div className="fade-up" style={{ maxWidth: '440px', width: '100%', backgroundColor: '#FFF', borderRadius: '28px', border: '1px solid #E2E8F0', padding: '40px 32px', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '18px', overflow: 'hidden', margin: '0 auto 16px', boxShadow: '0 8px 20px rgba(5,8,16,0.25)' }}>
            <img src="/pingflow-logo.svg" alt="PingFlow" style={{ width: '100%', height: '100%' }} />
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>One More Step</h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: '1.5' }}>
            Hi <strong style={{ color: '#0F172A' }}>{gym?.ownerName || user?.displayName || 'there'}</strong>! Verify your WhatsApp number to activate your PingFlow account.
          </p>
        </div>

        {/* Why WhatsApp */}
        <div style={{ padding: '14px 16px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', color: '#166534', fontWeight: '600', margin: 0, lineHeight: '1.5' }}>
            💬 Snip & Glow sends automated WhatsApp messages to your salon clients. We need to verify your number to ensure delivery.
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: '12px', color: '#E11D48', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>{error}</div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>WhatsApp Phone Number *</label>
          <div style={{ display: 'flex', height: '50px' }}>
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 14px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRight: 'none', borderRadius: '12px 0 0 12px', fontSize: '14px', color: '#475569', fontWeight: '700' }}>+91</div>
            <input
              style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: '0 12px 12px 0', padding: '0 16px', fontSize: '15px', color: '#0F172A', outline: 'none', fontWeight: '600' }}
              placeholder="9876543210"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
            />
          </div>
        </div>

        <button onClick={handleSendOTP} disabled={isLoading || phone.replace(/\D/g, '').length < 10} className="btn-press" style={{
          width: '100%', height: '52px',
          background: phone.replace(/\D/g, '').length >= 10 ? 'linear-gradient(135deg, #10B981, #059669)' : '#94A3B8',
          color: '#FFF', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '800',
          cursor: phone.replace(/\D/g, '').length >= 10 ? 'pointer' : 'not-allowed',
          boxShadow: phone.replace(/\D/g, '').length >= 10 ? '0 8px 20px rgba(16,185,129,0.25)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          {isLoading ? 'Sending code...' : '💬 Send WhatsApp Verification Code'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#94A3B8', marginTop: '16px' }}>
          We'll send a 6-digit code to your WhatsApp
        </p>
      </div>
    </div>
  );
}
