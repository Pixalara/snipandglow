// PingFlow — Premium Status Badge Component
// High-fidelity status indicators with pulse animations

import type { MemberStatus } from '@/types';

interface StatusBadgeProps {
  status: MemberStatus;
  style?: React.CSSProperties;
}

const statusConfig: Record<MemberStatus, { label: string; bg: string; color: string; dot: string; pulse?: boolean }> = {
  active: {
    label: 'ACTIVE',
    bg: '#ECFDF5',
    color: '#10B981',
    dot: '#10B981',
    pulse: true
  },
  expiring_soon: {
    label: 'EXPIRING',
    bg: '#FFFBEB',
    color: '#F59E0B',
    dot: '#F59E0B',
    pulse: true
  },
  expired: {
    label: 'EXPIRED',
    bg: '#FFF1F2',
    color: '#E11D48',
    dot: '#E11D48',
  },
  inactive: {
    label: 'INACTIVE',
    bg: '#F1F5F9',
    color: '#64748B',
    dot: '#94A3B8',
  },
};

export default function StatusBadge({ status, style }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        fontSize: '10px',
        fontWeight: '800',
        borderRadius: '20px',
        letterSpacing: '0.04em',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid transparent`,
        ...style
      }}
    >
      <span style={{
        width: '5px',
        height: '5px',
        borderRadius: '50%',
        marginRight: '6px',
        backgroundColor: config.dot,
        position: 'relative'
      }}>
        {config.pulse && (
          <span style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: '50%',
            backgroundColor: config.dot,
            opacity: 0.6,
            animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
          }} />
        )}
      </span>
      {config.label}
    </span>
  );
}
