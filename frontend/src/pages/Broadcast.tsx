// PingFlow — Broadcast Page
// Send WhatsApp broadcasts to filtered member groups with AI-assisted message writing

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { useWallet } from '@/hooks/useWallet';
import { subscribeMembers } from '@/services/members.service';
import {
  calculateBroadcastCost,
  deductWallet,
  COST_PER_MESSAGE,
} from '@/services/wallet.service';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/services/firebase';
import { toast } from '@/components/ui/Toast';
import type { Member, BroadcastTargetGroup } from '@/types';

export default function BroadcastPage() {
  const { user, gym } = useAuthStore();
  const { isMobile } = useResponsive();
  const { balance: walletBalance } = useWallet();

  const [members, setMembers] = useState<Member[]>([]);

  // Broadcast form
  const [targetGroup, setTargetGroup] = useState<BroadcastTargetGroup>('all');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [vibeIndex, setVibeIndex] = useState(0);

  const gymId = user?.uid;

  useEffect(() => {
    if (!gymId) return;
    const unsubMembers = subscribeMembers(gymId, (data) => { setMembers(data); }, () => {});
    return () => { unsubMembers(); };
  }, [gymId]);

  const filteredMembers = useMemo(() => {
    if (targetGroup === 'active') return members.filter(m => m.status === 'active');
    if (targetGroup === 'inactive') return members.filter(m => m.status === 'inactive' || m.status === 'expired');
    return members;
  }, [members, targetGroup]);

  const inactiveCount = useMemo(() => members.filter(m => m.status === 'inactive' || m.status === 'expired').length, [members]);

  const recipientCount = filteredMembers.length;
  const totalCost = calculateBroadcastCost(recipientCount);
  const hasBalance = walletBalance >= totalCost;

  const handleAiAssist = () => {
    if (!message.trim()) { toast('Write a draft message first', 'error'); return; }
    setIsAiLoading(true);

    const gymName = gym?.name || 'our gym';
    const draft = message.trim();
    const vibes = [
      // Energetic
      `Hey *${gymName}* family! 🏋️‍♂️\n\n${draft} 💪\n\nDon't miss out — this won't last long! Reply *YES* to grab your spot! 🔥`,
      // Friendly
      `Hi there! 👋\n\nQuick update from *${gymName}*:\n\n${draft}\n\nWe'd love to see you! Reply to know more. 😊`,
      // Urgent
      `⚡ *URGENT* from *${gymName}*\n\n${draft}\n\n⏰ Limited time only! Slots filling fast.\n\nReply *NOW* before it's gone! 🚨`,
      // Festive
      `🎉 *Exciting News* from *${gymName}*! 🎊\n\n${draft}\n\nCelebrate with us! Reply *YES* to join the party! 🥳`,
      // Premium
      `*${gymName}* — Exclusive Update\n\n${draft}\n\nThis is available to select members only. Reply to claim your spot. ✨`,
    ];

    const idx = vibeIndex % vibes.length;
    const vibeNames = ['Energetic 💪', 'Friendly 🤝', 'Urgent ⏰', 'Festive 🎉', 'Premium ✨'];

    setTimeout(() => {
      setMessage(vibes[idx]);
      setVibeIndex(prev => prev + 1);
      toast(`Enhanced with ${vibeNames[idx]} vibe! Click again for a different style.`, 'success');
      setIsAiLoading(false);
    }, 800);
  };

  const handleSendBroadcast = async () => {
    if (!gymId || !message.trim()) { toast('Write a message first', 'error'); return; }
    if (recipientCount === 0) { toast('No recipients in this group', 'error'); return; }
    if (!hasBalance) { toast('Insufficient wallet balance. Top up first.', 'error'); return; }

    setIsSending(true);
    try {
      // Deduct wallet
      await deductWallet(gymId, totalCost, `Broadcast to ${recipientCount} members`);

      // Send via Cloud Function (uses server-side API key)
      const functions = getFunctions(app, 'asia-south1');
      const broadcastFn = httpsCallable(functions, 'sendBroadcast');
      const result = await broadcastFn({
        gymId,
        message,
        recipients: filteredMembers.map(m => ({ name: m.name, phone: m.phone })),
      });
      const data = result.data as { sent: number; failed: number };

      toast(`✅ Broadcast submitted! ${data.sent} queued, ${data.failed} failed.`, 'success');
      setMessage('');
    } catch (err: any) {
      toast(err.message || 'Broadcast failed', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '46px', padding: '0 16px', borderRadius: '12px',
    border: '1px solid #E2E8F0', backgroundColor: '#FFF', color: '#0F172A',
    fontSize: '14px', fontFamily: "'Inter', sans-serif", outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Broadcast</h1>
        <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>Send WhatsApp messages to your members</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '24px' }}>
        {/* Left — Compose */}
        <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 20px' }}>Compose Message</h2>

          {/* Target group */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Recipients</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([
                { key: 'all' as BroadcastTargetGroup, label: `All (${members.length})` },
                { key: 'active' as BroadcastTargetGroup, label: `Active (${members.filter(m => m.status === 'active').length})` },
                { key: 'inactive' as BroadcastTargetGroup, label: `Inactive (${inactiveCount})` },
              ]).map(g => (
                <button key={g.key} onClick={() => { setTargetGroup(g.key); setVibeIndex(0); }} style={{
                  padding: '8px 18px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  backgroundColor: targetGroup === g.key ? (g.key === 'inactive' ? '#FEF2F2' : '#FFF1F2') : '#F1F5F9',
                  color: targetGroup === g.key ? (g.key === 'inactive' ? '#DC2626' : '#E11D48') : '#64748B',
                }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message input */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ ...labelStyle, margin: 0 }}>Message</label>
              <button onClick={handleAiAssist} disabled={isAiLoading || !message.trim()} style={{
                padding: '5px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: isAiLoading ? '#F5F3FF' : '#FFF',
                fontSize: '12px', fontWeight: '700', color: '#8B5CF6', cursor: isAiLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', opacity: !message.trim() ? 0.5 : 1,
              }}>
                {isAiLoading ? '✨ Generating...' : vibeIndex === 0 ? '✨ AI Assist' : `✨ Try Different Vibe (${vibeIndex})`}
              </button>
            </div>
            <textarea
              style={{ ...inputStyle, height: '160px', padding: '14px 16px', resize: 'none', lineHeight: '1.6' }}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your broadcast message here... e.g. 'Summer offer: 3 months at the price of 2! Valid till April 30.'"
            />
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: '6px 0 0', fontWeight: '500' }}>
              {message.length}/1024 characters
            </p>
          </div>

          {/* Cost breakdown */}
          <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: '#64748B', fontWeight: '600' }}>Recipients</span>
              <span style={{ color: '#0F172A', fontWeight: '700' }}>{recipientCount} members</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: '#64748B', fontWeight: '600' }}>Cost per message</span>
              <span style={{ color: '#0F172A', fontWeight: '700' }}>₹{COST_PER_MESSAGE}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '800', borderTop: '1px dashed #E2E8F0', paddingTop: '10px', marginTop: '6px' }}>
              <span style={{ color: '#0F172A' }}>Total Cost</span>
              <span style={{ color: '#E11D48' }}>₹{totalCost.toFixed(2)}</span>
            </div>
          </div>

          {/* Low balance warning */}
          {!hasBalance && recipientCount > 0 && (
            <div style={{ padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FECDD3', borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#DC2626', margin: 0 }}>Insufficient Balance</p>
                <p style={{ fontSize: '12px', color: '#EF4444', margin: '2px 0 0' }}>
                  You need ₹{totalCost.toFixed(2)} but have ₹{walletBalance.toFixed(2)}. Top up from the sidebar wallet.
                </p>
              </div>
            </div>
          )}

          {/* Send button */}
          <button
            onClick={handleSendBroadcast}
            disabled={isSending || !message.trim() || !hasBalance || recipientCount === 0}
            className="btn-press"
            style={{
              width: '100%', height: '50px',
              background: (isSending || !hasBalance || !message.trim()) ? '#94A3B8' : 'linear-gradient(135deg, #E11D48, #BE123C)',
              color: '#FFF', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '800',
              cursor: (isSending || !hasBalance) ? 'not-allowed' : 'pointer',
              boxShadow: hasBalance ? '0 6px 20px rgba(225,29,72,0.25)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            }}
          >
            {isSending ? (
              <><div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #FFF', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> Sending...</>
            ) : (
              <>📢 Send Broadcast to {recipientCount} Members</>
            )}
          </button>
        </div>

        {/* Right — Preview */}
        <div>
          <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: '0 0 14px' }}>📱 Preview</h3>
            <div style={{ backgroundColor: '#0b141a', borderRadius: '14px', padding: '16px', minHeight: '200px' }}>
              {isAiLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0' }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} className="skeleton" style={{ height: '16px', borderRadius: '6px', width: i === 4 ? '60%' : '100%', backgroundColor: '#1a2730' }} />
                  ))}
                  <p style={{ fontSize: '11px', color: '#8696a0', textAlign: 'center', marginTop: '8px' }}>✨ AI is crafting your message...</p>
                </div>
              ) : message.trim() ? (
                <div style={{ backgroundColor: '#1a2730', borderRadius: '10px', padding: '12px', maxWidth: '100%' }}>
                  <p style={{ fontSize: '13px', color: '#e9edef', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-line' }}>{message}</p>
                  <p style={{ fontSize: '10px', color: '#8696a0', margin: '8px 0 0', textAlign: 'right' }}>
                    {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: '#8696a0', textAlign: 'center', padding: '40px 0' }}>Your message preview will appear here</p>
              )}
            </div>
          </div>

          {/* Quick templates */}
          <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 12px' }}>Quick Templates</h3>
            {[
              { label: '🎉 Festival Offer', text: `🎊 Happy Festive Season from ${gym?.name || 'our gym'}!\n\nCelebrate with us — get 20% OFF on all plans this week only!\n\nVisit us or reply to grab the deal. 💪` },
              { label: '🏋️ New Batch', text: `Hey! 👋\n\nExciting news from ${gym?.name || 'our gym'}!\n\n🆕 New morning batch starting next Monday at 6 AM.\n\nLimited spots — reply YES to reserve yours! 🔥` },
              { label: '📢 Maintenance', text: `Hi! 👋\n\n${gym?.name || 'Our gym'} will be closed for maintenance on [DATE].\n\nWe'll be back stronger! Regular hours resume the next day. 🙏` },
            ].map(t => (
              <button key={t.label} onClick={() => setMessage(t.text)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px',
                fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer',
                marginBottom: '8px',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// AI-powered broadcast generation is handled by the generateAIBroadcast Cloud Function
