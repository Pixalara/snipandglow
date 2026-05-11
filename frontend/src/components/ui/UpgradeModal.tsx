// PingFlow — Upgrade Modal
// Shows plan comparison and upgrade CTA when a user hits a plan gate

import React from 'react';
import Modal from '@/components/ui/Modal';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

const STARTER_FEATURES = [
  '100 Members',
  '2 Employees',
  '1 Branch',
  'Billing & Invoicing',
  'WhatsApp Automations',
];

const PRO_FEATURES = [
  'Unlimited Members',
  'Unlimited Employees',
  'Unlimited Branches',
  'Everything in Starter',
  'Broadcasting',
  'Expense Tracking',
  'Advanced Analytics',
  'Global View',
  'Audit Trails',
];

const REASON_LABELS: Record<string, string> = {
  broadcast: 'Broadcasting',
  expenses: 'Expense Tracking',
  analytics: 'Advanced Analytics',
  globalView: 'Global View',
};

function formatReason(reason?: string): string {
  if (!reason) return 'This feature requires a Pro plan';
  if (reason.toLowerCase().includes('limit')) return reason;
  const label = REASON_LABELS[reason] || reason;
  return `${label} is a Pro feature`;
}

const CheckIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upgrade Your Plan"
      subtitle={formatReason(reason)}
      maxWidth="640px"
      footer={
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              height: '46px',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFF',
              color: '#64748B',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
              e.currentTarget.style.borderColor = '#CBD5E1';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#FFF';
              e.currentTarget.style.borderColor = '#E2E8F0';
            }}
          >
            Maybe Later
          </button>
          <a
            href="https://pixalara.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              height: '46px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #E11D48, #8B5CF6)',
              color: '#FFF',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              boxShadow: '0 8px 20px -6px rgba(225, 29, 72, 0.35)',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(225, 29, 72, 0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 20px -6px rgba(225, 29, 72, 0.35)';
            }}
          >
            Upgrade to Pro
          </a>
        </div>
      }
    >
      {/* Plan comparison columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Starter Column */}
        <div style={{
          padding: '20px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          backgroundColor: '#FAFBFC',
        }}>
          <p style={{
            fontSize: '11px',
            fontWeight: '800',
            color: '#94A3B8',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '0 0 4px',
          }}>Starter</p>
          <p style={{
            fontSize: '24px',
            fontWeight: '900',
            color: '#0F172A',
            margin: '0 0 16px',
            fontFamily: "'Outfit', sans-serif",
          }}>₹499<span style={{ fontSize: '13px', fontWeight: '500', color: '#94A3B8' }}>/mo</span></p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {STARTER_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', fontWeight: '500' }}>
                <span style={{ color: '#10B981', flexShrink: 0 }}><CheckIcon /></span>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Pro Column */}
        <div style={{
          padding: '20px',
          borderRadius: '14px',
          border: '2px solid transparent',
          background: 'linear-gradient(#FFF, #FFF) padding-box, linear-gradient(135deg, #E11D48, #8B5CF6) border-box',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: '-1px',
            right: '16px',
            background: 'linear-gradient(135deg, #E11D48, #8B5CF6)',
            color: '#FFF',
            fontSize: '10px',
            fontWeight: '800',
            padding: '3px 10px',
            borderRadius: '0 0 8px 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>Popular</div>
          <p style={{
            fontSize: '11px',
            fontWeight: '800',
            color: '#8B5CF6',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '0 0 4px',
          }}>Pro</p>
          <p style={{
            fontSize: '24px',
            fontWeight: '900',
            color: '#0F172A',
            margin: '0 0 16px',
            fontFamily: "'Outfit', sans-serif",
          }}>₹999<span style={{ fontSize: '13px', fontWeight: '500', color: '#94A3B8' }}>/mo</span></p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {PRO_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', fontWeight: '500' }}>
                <span style={{ color: '#8B5CF6', flexShrink: 0 }}><CheckIcon /></span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
