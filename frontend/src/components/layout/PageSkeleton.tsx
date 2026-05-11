// PingFlow — Lightweight Page Skeleton
// Shows instantly during lazy-load instead of full LoadingScreen (feels faster)

export default function PageSkeleton() {
  return (
    <div style={{ padding: '0', animation: 'fadeIn 200ms ease' }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div className="skeleton" style={{ width: '200px', height: '32px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ width: '120px', height: '36px', borderRadius: '8px' }} />
      </div>

      {/* Stat cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ padding: '20px', borderRadius: '12px', background: 'var(--pf-surface)' }}>
            <div className="skeleton" style={{ width: '60%', height: '14px', marginBottom: '12px', borderRadius: '6px' }} />
            <div className="skeleton" style={{ width: '40%', height: '28px', borderRadius: '8px' }} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div style={{ borderRadius: '12px', background: 'var(--pf-surface)', padding: '20px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: i < 5 ? '1px solid var(--pf-border)' : 'none' }}>
            <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: `${60 + (i * 5)}%`, height: '14px', marginBottom: '8px', borderRadius: '6px' }} />
              <div className="skeleton" style={{ width: '30%', height: '12px', borderRadius: '6px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
