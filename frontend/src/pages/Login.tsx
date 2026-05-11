// Snip & Glow — Login Page
// Two options: Google OAuth or Email + Password

import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/services/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email is required'); return; }
    if (!password) { setError('Password is required'); return; }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Login failed. Please try again.');
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

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', backgroundColor: '#FAFBFC', position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Background blurs */}
      <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(225,29,72,0.05) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: 0 }} />

      <div className="fade-up" style={{
        width: '100%', maxWidth: '440px', backgroundColor: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(20px)', border: '1px solid #FFF', borderRadius: '28px',
        padding: '48px 36px', boxShadow: '0 20px 50px rgba(0,0,0,0.06)',
        position: 'relative', zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px',
            borderRadius: '18px', overflow: 'hidden',
            margin: '0 auto 16px', boxShadow: '0 8px 20px rgba(5,8,16,0.25)',
          }}>
            <img src="/pingflow-logo.svg" alt="Snip & Glow" style={{ width: '100%', height: '100%' }} />
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: '900', color: '#0F172A', margin: '0 0 6px', letterSpacing: '-1px' }}>Welcome back</h1>
          <p style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>Sign in to your Snip & Glow account</p>
        </div>

        {error && (
          <div style={{ marginBottom: '20px', padding: '12px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: '12px', color: '#E11D48', fontSize: '13px', fontWeight: '600' }}>{error}</div>
        )}

        {/* Google button */}
        <button onClick={handleGoogleSignIn} disabled={isLoading} className="btn-press" style={{
          width: '100%', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', color: '#0F172A',
          fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 20px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
          <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleEmailSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Email Address</label>
            <input type="email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Password</label>
            <input type="password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" />
          </div>
          <button type="submit" disabled={isLoading} className="btn-press" style={{
            height: '50px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF',
            border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '800', cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(225,29,72,0.25)', opacity: isLoading ? 0.7 : 1,
          }}>
            {isLoading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748B', marginTop: '24px' }}>
          Don't have an account? <a href="/signup" style={{ color: '#E11D48', fontWeight: '700', textDecoration: 'none' }}>Create one →</a>
        </p>
      </div>
    </div>
  );
}
