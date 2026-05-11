// PingFlow — Reusable Top-Up Modal
// Centralized wallet top-up with preset amounts

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import { toast } from '@/components/ui/Toast';
import { topUpWallet, COST_PER_MESSAGE } from '@/services/wallet.service';
import { useAuthStore } from '@/store/authStore';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
}

export default function TopUpModal({ isOpen, onClose, currentBalance }: TopUpModalProps) {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState('500');
  const [isLoading, setIsLoading] = useState(false);

  const handleTopUp = async () => {
    if (!user?.uid) return;
    const val = Number(amount);
    if (!val || val < 100) { toast('Minimum top-up is ₹100', 'error'); return; }

    setIsLoading(true);
    try {
      await topUpWallet(user.uid, val);
      toast(`₹${val} added to wallet!`, 'success');
      onClose();
    } catch (err: any) {
      toast(err.message || 'Top-up failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '46px', padding: '0 16px', borderRadius: '12px',
    border: '1px solid #E2E8F0', backgroundColor: '#FFF', color: '#0F172A',
    fontSize: '18px', fontWeight: '800', textAlign: 'center',
    fontFamily: "'Inter', sans-serif", outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Top Up Wallet" subtitle="Add funds to send broadcasts" footer={
      <><GhostButton onClick={onClose}>Cancel</GhostButton><PrimaryButton onClick={handleTopUp} loading={isLoading}>Add ₹{amount}</PrimaryButton></>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', margin: '0 0 4px', textTransform: 'uppercase' }}>Current Balance</p>
          <p style={{ fontSize: '28px', fontWeight: '900', color: '#0F172A', margin: 0, fontFamily: "'Outfit', sans-serif" }}>₹{currentBalance.toFixed(2)}</p>
        </div>
        <div>
          <label style={labelStyle}>Top-Up Amount (₹)</label>
          <input type="number" style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} min="100" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['500', '1000', '2000', '5000'].map(amt => (
            <button key={amt} onClick={() => setAmount(amt)} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: amount === amt ? '2px solid #E11D48' : '1px solid #E2E8F0',
              backgroundColor: amount === amt ? '#FFF1F2' : '#FFF',
              color: amount === amt ? '#E11D48' : '#334155',
              fontSize: '13px', fontWeight: '700', cursor: 'pointer',
            }}>₹{amt}</button>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
          Each broadcast message costs ₹{COST_PER_MESSAGE} per recipient
        </p>
      </div>
    </Modal>
  );
}
