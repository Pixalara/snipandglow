// PingFlow — Branch Comparison Chart
// Simple CSS-based horizontal bar chart showing revenue/members per branch
// Only visible in Global View (All Branches) for admins

import type { Branch } from '@/types';

interface BranchStat {
  branch: Branch;
  memberCount: number;
  revenue: number;
}

interface Props {
  data: BranchStat[];
  isLoading?: boolean;
}

const COLORS = ['#E11D48', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export default function BranchComparisonChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div style={{ padding: '20px' }}>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '40px', marginBottom: '10px', borderRadius: '8px' }} />)}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: '#64748B' }}>No branch data available</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const maxMembers = Math.max(...data.map(d => d.memberCount), 1);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Revenue by Branch */}
      <div>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Revenue by Branch</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.map((item, i) => {
            const pct = (item.revenue / maxRevenue) * 100;
            const color = COLORS[i % COLORS.length];
            return (
              <div key={item.branch.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>{item.branch.name}</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color, fontFamily: "'JetBrains Mono', monospace" }}>₹{item.revenue.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, backgroundColor: color,
                    borderRadius: '4px', transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Members by Branch */}
      <div>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Members by Branch</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.map((item, i) => {
            const pct = (item.memberCount / maxMembers) * 100;
            const color = COLORS[i % COLORS.length];
            return (
              <div key={item.branch.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>{item.branch.name}</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color, fontFamily: "'JetBrains Mono', monospace" }}>{item.memberCount}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, backgroundColor: color,
                    borderRadius: '4px', transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
