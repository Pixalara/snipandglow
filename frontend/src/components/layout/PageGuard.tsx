// PingFlow — Page-Level Access Guard
// Blocks unauthorized page access based on role permissions

import { useRole } from '@/hooks/useRole';
import type { Resource } from '@/config/permissionMap';

interface PageGuardProps {
  resource: Resource;
  children: React.ReactNode;
}

export default function PageGuard({ resource, children }: PageGuardProps) {
  const { can } = useRole();

  if (!can('read', resource)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '40px 20px',
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #FEF2F2, #FECDD3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '22px',
          fontWeight: '800',
          color: '#0F172A',
          margin: '0 0 8px',
          letterSpacing: '-0.02em',
        }}>
          Access Denied
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#64748B',
          margin: 0,
          maxWidth: '360px',
          lineHeight: '1.6',
          fontWeight: '500',
        }}>
          You don't have permission to view this page. Contact your gym admin to request access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
