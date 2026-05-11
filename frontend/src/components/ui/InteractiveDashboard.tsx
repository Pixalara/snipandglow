// Snip & Glow — Interactive Dashboard Preview for Landing Page
// Clickable sidebar switches between mock module views

import React, { useState } from 'react';

type Module = 'dashboard' | 'members' | 'leads' | 'billing' | 'automations' | 'analytics' | 'plans' | 'broadcast' | 'expenses' | 'employees' | 'branches' | 'activitylog' | 'settings';

const MODULES: { key: Module; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'members', label: 'Clients', icon: '👥' },
  { key: 'leads', label: 'Leads', icon: '🎯' },
  { key: 'billing', label: 'Billing', icon: '💳' },
  { key: 'automations', label: 'Automations', icon: '⚡' },
  { key: 'analytics', label: 'Analytics', icon: '📈' },
  { key: 'plans', label: 'Packages', icon: '📋' },
  { key: 'broadcast', label: 'Broadcast', icon: '📢' },
  { key: 'expenses', label: 'Expenses', icon: '💰' },
  { key: 'employees', label: 'Staff', icon: '👤' },
  { key: 'branches', label: 'Branches', icon: '🏢' },
  { key: 'activitylog', label: 'Activity Log', icon: '📋' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

function DashboardView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <div>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 2px' }}>Good afternoon, Priya 👋</h3>
          <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Here's what's happening at <span style={{ fontWeight: '700', color: '#334155' }}>Glamour Studio</span> today</p>
        </div>
        <div style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', fontSize: '11px', fontWeight: '700' }}>+ Add Client</div>
      </div>

      {/* Stat Cards Row */}
      <div className="idp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Total Clients', value: '10', icon: '👥', color: '#3B82F6', iconBg: 'rgba(59,130,246,0.1)' },
          { label: 'Active', value: '2', icon: '⚡', color: '#10B981', iconBg: 'rgba(16,185,129,0.1)' },
          { label: 'Expiring Soon', value: '7', icon: '⏳', color: '#F59E0B', iconBg: 'rgba(245,158,11,0.1)' },
          { label: 'Expired', value: '1', icon: '🚨', color: '#EF4444', iconBg: 'rgba(239,68,68,0.1)' },
        ].map(c => (
          <div key={c.label} style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${c.color}, transparent)`, opacity: 0.6 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <p style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{c.label}</p>
              <div style={{ width: '24px', height: '24px', borderRadius: '7px', backgroundColor: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>{c.icon}</div>
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '26px', fontWeight: '900', color: '#0F172A', margin: 0, lineHeight: 1 }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Row + Wallet */}
      <div className="idp-grid-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Revenue This Month', value: '₹8,748', icon: '💰', color: '#10B981', iconBg: 'rgba(16,185,129,0.08)' },
          { label: 'Pending Dues', value: '₹4,579', icon: '📋', color: '#F59E0B', iconBg: 'rgba(245,158,11,0.08)' },
          { label: 'Revenue This Year', value: '₹8,748', icon: '📊', color: '#3B82F6', iconBg: 'rgba(59,130,246,0.08)' },
        ].map(c => (
          <div key={c.label} style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${c.color}, transparent)`, opacity: 0.6 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <p style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{c.label}</p>
              <div style={{ width: '24px', height: '24px', borderRadius: '7px', backgroundColor: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>{c.icon}</div>
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '900', color: '#0F172A', margin: 0, lineHeight: 1 }}>{c.value}</p>
          </div>
        ))}
        {/* Wallet Card */}
        <div style={{ padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg, #0F172A, #1E293B)', border: '1px solid #334155', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #8B5CF6, transparent)', opacity: 0.6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <p style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>WhatsApp Wallet</p>
            <div style={{ width: '24px', height: '24px', borderRadius: '7px', backgroundColor: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>💎</div>
          </div>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '900', color: '#F0F6FF', margin: '0 0 6px', lineHeight: 1 }}>₹480.00</p>
          <span style={{ fontSize: '8px', fontWeight: '800', color: '#60A5FA', backgroundColor: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: '5px' }}>+ TOP UP</span>
        </div>
      </div>

      {/* Expiring Soon + Activity Log */}
      <div className="idp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* Expiring Soon */}
        <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#FFF', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px' }}>🔔</span>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A' }}>Expiring Soon</span>
              <span style={{ fontSize: '9px', fontWeight: '800', color: '#F59E0B', backgroundColor: '#FFFBEB', padding: '1px 6px', borderRadius: '8px' }}>6</span>
            </div>
            <span style={{ fontSize: '9px', fontWeight: '700', color: '#E11D48', cursor: 'pointer' }}>View All →</span>
          </div>
          {[
            { name: 'Priya Sharma', plan: 'Monthly Package', date: '30 Apr', time: 'in about 14 hours', initial: 'P', color: '#E11D48' },
            { name: 'Neha Kapoor', plan: 'Monthly Package', date: '30 Apr', time: 'in about 14 hours', initial: 'N', color: '#3B82F6' },
            { name: 'Anjali Singh', plan: 'Quarterly Package', date: '02 May', time: 'in 3 days', initial: 'A', color: '#10B981' },
            { name: 'Kavya Reddy', plan: 'Monthly Package', date: '03 May', time: 'in 4 days', initial: 'K', color: '#8B5CF6' },
            { name: 'Meera Nair', plan: 'Monthly Package', date: '03 May', time: 'in 4 days', initial: 'M', color: '#10B981' },
          ].map(m => (
            <div key={m.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: `linear-gradient(135deg, ${m.color}20, ${m.color}10)`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '800' }}>{m.initial}</div>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A', margin: 0 }}>{m.name}</p>
                  <p style={{ fontSize: '8px', color: '#94A3B8', margin: 0 }}>{m.plan}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '10px', fontWeight: '700', color: '#0F172A', margin: 0 }}>{m.date}</p>
                <p style={{ fontSize: '8px', color: '#E11D48', fontWeight: '600', margin: 0 }}>{m.time}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Activity Log */}
        <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#FFF', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px' }}>📋</span>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A' }}>Activity Log</span>
            </div>
            <span style={{ fontSize: '9px', fontWeight: '700', color: '#E11D48', cursor: 'pointer' }}>View All →</span>
          </div>
          {[
            { name: 'Priya Sharma', time: '15 days ago' },
            { name: 'Neha Kapoor', time: '15 days ago' },
            { name: 'Anjali Singh', time: '15 days ago' },
            { name: 'Kavya Reddy', time: '16 days ago' },
            { name: 'Meera Nair', time: '16 days ago' },
            { name: 'Priya Sharma', time: '17 days ago' },
            { name: 'Neha Kapoor', time: '17 days ago' },
            { name: 'Anjali Singh', time: '17 days ago' },
          ].map((a, idx) => (
            <div key={a.name + idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#E11D48', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#334155' }}>{a.name}</span>
              </div>
              <span style={{ fontSize: '9px', color: '#94A3B8', fontWeight: '500' }}>{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function MembersView() {
  const members = [
    { name: 'Priya Sharma', plan: 'Gold Package', status: 'Active', color: '#10B981', expiry: '24 Jul 2026' },
    { name: 'Neha Kapoor', plan: 'Monthly', status: 'Expiring', color: '#F59E0B', expiry: '19 Apr 2026' },
    { name: 'Anjali Singh', plan: 'Monthly', status: 'Active', color: '#10B981', expiry: '26 May 2026' },
    { name: 'Kavya Reddy', plan: 'Quarterly', status: 'Active', color: '#10B981', expiry: '15 Jun 2026' },
    { name: 'Meera Nair', plan: 'Monthly', status: 'Active', color: '#10B981', expiry: '10 Jul 2026' },
    { name: 'Sunita Agarwal', plan: 'Gold Package', status: 'Active', color: '#10B981', expiry: '01 Sep 2026' },
    { name: 'Pooja Sharma', plan: 'Quarterly', status: 'Expired', color: '#EF4444', expiry: '15 Mar 2026' },
    { name: 'Divya Menon', plan: 'Monthly', status: 'Expiring', color: '#F59E0B', expiry: '03 May 2026' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Clients</h3>
        <div style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', fontSize: '11px', fontWeight: '700' }}>+ Add Client</div>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {['All', 'Active', 'Expiring', 'Expired'].map((t, i) => (
          <span key={t} style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', backgroundColor: i === 0 ? '#FFF1F2' : '#F1F5F9', color: i === 0 ? '#E11D48' : '#64748B', cursor: 'pointer' }}>{t}</span>
        ))}
      </div>
      <div style={{ backgroundColor: '#FFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '8px 14px', backgroundColor: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
          {['Client', 'Plan', 'Expiry', 'Status'].map(h => (
            <span key={h} style={{ fontSize: '9px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>
        {members.map((m, idx) => (
          <div key={m.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 14px', borderBottom: '1px solid #F8FAFC', alignItems: 'center', backgroundColor: idx % 2 === 1 ? '#FAFBFC' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(135deg, #FFF1F2, #FECDD3)', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700' }}>{m.name[0]}</div>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>{m.name}</span>
            </div>
            <span style={{ fontSize: '11px', color: '#334155', fontWeight: '600' }}>{m.plan}</span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>{m.expiry}</span>
            <span style={{ fontSize: '9px', fontWeight: '700', color: m.color, backgroundColor: m.color + '15', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', width: 'fit-content' }}>{m.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadsView() {
  const [activeTab, setActiveTab] = useState('converted');
  const stages = [
    { key: 'new', label: 'New', icon: '🆕', count: 3, color: '#3B82F6' },
    { key: 'contacted', label: 'Contacted', icon: '📞', count: 1, color: '#8B5CF6' },
    { key: 'trial_scheduled', label: 'Trial Scheduled', icon: '📅', count: 0, color: '#F59E0B' },
    { key: 'trial_done', label: 'Trial Done', icon: '✅', count: 0, color: '#10B981' },
    { key: 'negotiation', label: 'Negotiation', icon: '💬', count: 0, color: '#F97316' },
    { key: 'converted', label: 'Converted', icon: '🎉', count: 1, color: '#10B981' },
    { key: 'lost', label: 'Lost', icon: '✗', count: 0, color: '#EF4444' },
  ];
  const leads = [
    { name: 'Shreya Patel', source: 'Walk-in', phone: '98******30', assignee: 'Unassigned', date: '27 Apr 2026', status: 'Converted', initial: 'S', color: '#E11D48' },
    { name: 'Ritu Verma', source: 'Referral', phone: '98******11', assignee: 'Priya', date: '25 Apr 2026', status: 'New', initial: 'R', color: '#3B82F6' },
    { name: 'Ananya Joshi', source: 'Social Media', phone: '87******45', assignee: 'Priya', date: '24 Apr 2026', status: 'New', initial: 'A', color: '#8B5CF6' },
    { name: 'Deepa Nair', source: 'Walk-in', phone: '99******23', assignee: 'Unassigned', date: '23 Apr 2026', status: 'Contacted', initial: 'D', color: '#F59E0B' },
    { name: 'Sonal Mehta', source: 'Social Media', phone: '88******34', assignee: 'Priya', date: '22 Apr 2026', status: 'New', initial: 'S', color: '#10B981' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Leads Pipeline</h3>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#3B82F6', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '8px' }}>5</span>
          </div>
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: '2px 0 0' }}>Track and convert prospective clients</p>
        </div>
        <div style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', fontSize: '11px', fontWeight: '700' }}>+ Add Lead</div>
      </div>

      {/* Stat Cards */}
      <div className="idp-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Total Leads', value: '5', color: '#0F172A', border: '#3B82F6' },
          { label: 'Active Pipeline', value: '4', color: '#3B82F6', border: '#8B5CF6' },
          { label: 'Converted', value: '1', color: '#10B981', border: '#10B981' },
          { label: 'Conversion Rate', value: '50%', color: '#8B5CF6', border: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${s.border}, transparent)`, opacity: 0.6 }} />
            <p style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{s.label}</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: '900', color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Stages — scrollable tabs */}
      <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
        {stages.map(s => {
          const isActive = activeTab === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActiveTab(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '20px', border: 'none',
                backgroundColor: isActive ? `${s.color}15` : '#F8FAFC',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'all 150ms',
                outline: isActive ? `2px solid ${s.color}` : 'none',
                outlineOffset: '-1px',
              }}
            >
              <span style={{ fontSize: '10px' }}>{s.icon}</span>
              <span style={{ fontSize: '10px', fontWeight: isActive ? '800' : '600', color: isActive ? s.color : '#64748B' }}>{s.label}</span>
              <span style={{
                fontSize: '9px', fontWeight: '800',
                color: isActive ? '#FFF' : '#94A3B8',
                backgroundColor: isActive ? s.color : '#E2E8F0',
                width: '18px', height: '18px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms',
              }}>{s.count}</span>
            </button>
          );
        })}
      </div>

      {/* Lead Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {leads.map((l, idx) => (
          <div key={l.name + idx} style={{
            padding: '10px 12px', borderRadius: '10px',
            backgroundColor: '#FFF', border: '1px solid #E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: 'all 150ms',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '10px',
                background: `linear-gradient(135deg, ${l.color}20, ${l.color}10)`,
                color: l.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '800',
              }}>{l.initial}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>{l.name}</span>
                  <span style={{ fontSize: '8px', fontWeight: '700', color: '#64748B', backgroundColor: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>{l.source}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '9px', color: '#94A3B8' }}>{l.phone}</span>
                  <span style={{ fontSize: '9px', color: '#CBD5E1' }}>·</span>
                  <span style={{ fontSize: '9px', color: '#94A3B8' }}>{l.assignee}</span>
                  <span style={{ fontSize: '9px', color: '#CBD5E1' }}>·</span>
                  <span style={{ fontSize: '9px', color: '#94A3B8' }}>📅 {l.date}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '9px', fontWeight: '700',
                color: l.status === 'Converted' ? '#10B981' : l.status === 'Contacted' ? '#8B5CF6' : '#3B82F6',
                backgroundColor: l.status === 'Converted' ? '#ECFDF5' : l.status === 'Contacted' ? '#F5F3FF' : '#EFF6FF',
                padding: '3px 8px', borderRadius: '6px',
              }}>{l.status === 'Converted' ? '🎉' : ''} {l.status}</span>
              {/* Action icons */}
              <div style={{ display: 'flex', gap: '3px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', cursor: 'pointer' }}>💬</div>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', cursor: 'pointer' }}>✏️</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BillingView() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Financial Ledger</h3>
        <div style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', fontSize: '11px', fontWeight: '700' }}>+ Record Payment</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
        {[
          { label: 'Monthly Revenue', value: '₹6,069', color: '#3B82F6' },
          { label: 'Pending', value: '₹178', color: '#F59E0B' },
          { label: 'Defaulters', value: '0', color: '#EF4444' },
          { label: 'Payments Today', value: '1', color: '#10B981' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderTop: `3px solid ${s.color}` }}>
            <p style={{ fontSize: '9px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 4px' }}>{s.label}</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '900', color: '#0F172A', margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>
      <div style={{ backgroundColor: '#FFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1fr', padding: '8px 14px', backgroundColor: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
          {['Invoice', 'Client', 'Amount', 'Status', 'Mode'].map(h => (
            <span key={h} style={{ fontSize: '9px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>
        {[
          { inv: 'INV-0005', name: 'Priya Sharma', amount: '₹824', status: 'PARTIAL', mode: 'CARD', statusColor: '#F59E0B' },
          { inv: 'INV-0004', name: 'Neha Kapoor', amount: '₹1,885', status: 'PARTIAL', mode: 'CASH', statusColor: '#F59E0B' },
          { inv: 'INV-0003', name: 'Anjali Singh', amount: '₹824', status: 'PAID', mode: 'CASH', statusColor: '#10B981' },
          { inv: 'INV-0002', name: 'Kavya Reddy', amount: '₹1,886', status: 'PARTIAL', mode: 'CARD', statusColor: '#F59E0B' },
          { inv: 'INV-0001', name: 'Meera Nair', amount: '₹824', status: 'PARTIAL', mode: 'UPI', statusColor: '#F59E0B' },
        ].map((p, idx) => (
          <div key={p.inv} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 1fr 1fr', padding: '10px 14px', borderBottom: '1px solid #F8FAFC', alignItems: 'center', backgroundColor: idx % 2 === 1 ? '#FAFBFC' : 'transparent' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#E11D48', fontFamily: "'JetBrains Mono', monospace" }}>{p.inv}</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A' }}>{p.name}</span>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A' }}>{p.amount}</span>
            <span style={{ fontSize: '8px', fontWeight: '800', color: p.statusColor, backgroundColor: p.statusColor + '15', padding: '2px 6px', borderRadius: '8px', width: 'fit-content' }}>{p.status}</span>
            <span style={{ fontSize: '8px', fontWeight: '700', color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '6px', width: 'fit-content' }}>{p.mode}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function AutomationsView() {
  const logs = [
    { time: '14 Apr, 09:00', name: 'Priya Sharma', initial: 'P', event: 'Overdue +2', eventColor: '#E11D48', eventBg: '#FEF2F2', status: 'Submitted', statusColor: '#F59E0B' },
    { time: '14 Apr, 09:00', name: 'Neha Kapoor', initial: 'N', event: 'Overdue +2', eventColor: '#E11D48', eventBg: '#FEF2F2', status: 'Submitted', statusColor: '#F59E0B' },
    { time: '14 Apr, 09:00', name: 'Anjali Singh', initial: 'A', event: 'Overdue +2', eventColor: '#E11D48', eventBg: '#FEF2F2', status: 'Submitted', statusColor: '#F59E0B' },
    { time: '13 Apr, 09:00', name: 'Kavya Reddy', initial: 'K', event: 'D-3 Warning', eventColor: '#F59E0B', eventBg: '#FFFBEB', status: 'Submitted', statusColor: '#F59E0B' },
    { time: '13 Apr, 09:00', name: 'Meera Nair', initial: 'M', event: 'D-3 Warning', eventColor: '#F59E0B', eventBg: '#FFFBEB', status: 'Submitted', statusColor: '#F59E0B' },
    { time: '12 Apr, 03:57', name: 'Priya Sharma', initial: 'P', event: 'Expiry Today', eventColor: '#E11D48', eventBg: '#FEF2F2', status: 'Submitted', statusColor: '#F59E0B' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <div>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 2px' }}>Automation Logs</h3>
          <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Track your automated WhatsApp reminders</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFF', fontSize: '9px', fontWeight: '700', color: '#334155' }}>🔄 Sync Status</div>
          <div style={{ padding: '5px 10px', borderRadius: '8px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', fontSize: '9px', fontWeight: '700' }}>▶ Run Manual Trigger</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Total Sent', value: '40', border: '#3B82F6', gradient: 'linear-gradient(135deg, #EFF6FF, #FFF)' },
          { label: 'Successful', value: '37', border: '#10B981', gradient: 'linear-gradient(135deg, #ECFDF5, #FFF)' },
          { label: 'Failed', value: '3', border: '#EF4444', gradient: 'linear-gradient(135deg, #FEF2F2, #FFF)' },
          { label: 'Today', value: '0', border: '#8B5CF6', gradient: 'linear-gradient(135deg, #F5F3FF, #FFF)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px', borderRadius: '10px', background: s.gradient, border: '1px solid #E2E8F0', borderTop: `3px solid ${s.border}`, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{s.label}</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '22px', fontWeight: '900', color: '#0F172A', margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Log Table */}
      <div style={{ backgroundColor: '#FFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 0.8fr', padding: '8px 14px', backgroundColor: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
          {['Time', 'Client', 'Event', 'Status'].map(h => (
            <span key={h} style={{ fontSize: '8px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>
        {logs.map((l, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 0.8fr', padding: '9px 14px', borderBottom: '1px solid #F8FAFC', alignItems: 'center', backgroundColor: idx % 2 === 1 ? '#FAFBFC' : 'transparent' }}>
            <span style={{ fontSize: '9px', fontWeight: '600', color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{l.time}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg, #FFF1F2, #FECDD3)', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '800', flexShrink: 0 }}>{l.initial}</div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A' }}>{l.name}</span>
            </div>
            <span style={{ fontSize: '9px', fontWeight: '700', color: l.eventColor, backgroundColor: l.eventBg, padding: '2px 8px', borderRadius: '8px', width: 'fit-content' }}>{l.event}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: l.statusColor }} />
              <span style={{ fontSize: '9px', fontWeight: '600', color: l.statusColor }}>{l.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsView() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const revenue = [45, 52, 48, 65, 72, 80];
  const expenses = [20, 25, 22, 30, 28, 35];
  const profit = revenue.map((r, i) => r - expenses[i]);
  const maxVal = Math.max(...revenue);
  const maxProfit = Math.max(...profit);
  const expenseCategories = [
    { name: 'Rent', amount: 25000, pct: 39, color: '#8B5CF6' },
    { name: 'Salary', amount: 45000, pct: 70, color: '#10B981' },
    { name: 'Utilities', amount: 1500, pct: 2, color: '#3B82F6' },
    { name: 'Equipment', amount: 25000, pct: 39, color: '#E11D48' },
    { name: 'Repair', amount: 12500, pct: 20, color: '#F59E0B' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0, paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>Analytics</h3>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Revenue', value: '₹1.2L', trend: '↑ 18%', trendColor: '#10B981', gradient: 'linear-gradient(135deg, #ECFDF5, #FFF)', border: '#10B981' },
          { label: 'Expenses', value: '₹64,000', trend: '↑ 5%', trendColor: '#F59E0B', gradient: 'linear-gradient(135deg, #FFF1F2, #FFF)', border: '#E11D48' },
          { label: 'Net Profit', value: '₹56,000', trend: '↑ 24%', trendColor: '#10B981', gradient: 'linear-gradient(135deg, #EFF6FF, #FFF)', border: '#3B82F6' },
          { label: 'Margin', value: '47%', trend: '↑ 6%', trendColor: '#10B981', gradient: 'linear-gradient(135deg, #F5F3FF, #FFF)', border: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px', borderRadius: '10px', background: s.gradient, border: '1px solid #E2E8F0', borderTop: `3px solid ${s.border}`, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{s.label}</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '900', color: '#0F172A', margin: '0 0 2px' }}>{s.value}</p>
            <p style={{ fontSize: '8px', fontWeight: '700', color: s.trendColor, margin: 0 }}>{s.trend}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* Revenue vs Expenses Bar Chart */}
        <div style={{ backgroundColor: '#FFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Revenue vs Expenses</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><div style={{ width: '6px', height: '6px', borderRadius: '2px', backgroundColor: '#10B981' }} /><span style={{ fontSize: '7px', color: '#94A3B8', fontWeight: '600' }}>Revenue</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><div style={{ width: '6px', height: '6px', borderRadius: '2px', backgroundColor: '#E11D48' }} /><span style={{ fontSize: '7px', color: '#94A3B8', fontWeight: '600' }}>Expenses</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px' }}>
            {months.map((m, i) => (
              <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '65px' }}>
                  <div style={{ width: '12px', height: `${(revenue[i] / maxVal) * 65}px`, background: 'linear-gradient(180deg, #34D399, #10B981)', borderRadius: '3px' }} />
                  <div style={{ width: '12px', height: `${(expenses[i] / maxVal) * 65}px`, background: 'linear-gradient(180deg, #FB7185, #E11D48)', borderRadius: '3px' }} />
                </div>
                <span style={{ fontSize: '7px', fontWeight: '700', color: '#94A3B8' }}>{m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Profit Trend */}
        <div style={{ backgroundColor: '#FFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '12px' }}>
          <p style={{ fontSize: '10px', fontWeight: '800', color: '#0F172A', margin: '0 0 10px' }}>Profit Trend</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {months.map((m, i) => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '7px', fontWeight: '700', color: '#94A3B8', width: '20px' }}>{m}</span>
                <div style={{ flex: 1, height: '12px', backgroundColor: '#F1F5F9', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(profit[i] / maxProfit) * 100}%`, background: profit[i] >= 0 ? 'linear-gradient(90deg, #34D399, #10B981)' : 'linear-gradient(90deg, #FB7185, #EF4444)', borderRadius: '6px', transition: 'width 300ms' }} />
                </div>
                <span style={{ fontSize: '8px', fontWeight: '800', color: profit[i] >= 0 ? '#059669' : '#DC2626', minWidth: '24px', textAlign: 'right' }}>₹{profit[i]}K</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expense Breakdown */}
      <div style={{ backgroundColor: '#FFF', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '12px' }}>
        <p style={{ fontSize: '10px', fontWeight: '800', color: '#0F172A', margin: '0 0 10px' }}>Expense Breakdown</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {expenseCategories.map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '9px', fontWeight: '600', color: '#334155', width: '56px' }}>{c.name}</span>
              <div style={{ flex: 1, height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${c.pct}%`, backgroundColor: c.color, borderRadius: '4px', transition: 'width 300ms' }} />
              </div>
              <span style={{ fontSize: '8px', fontWeight: '800', color: '#0F172A', minWidth: '40px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>₹{(c.amount / 1000).toFixed(0)}K</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function PlansView() {
  const plans = [
    { name: 'Monthly Glow', price: '₹699', duration: '30 days', color: '#3B82F6' },
    { name: 'Quarterly Luxury', price: '₹1,799', duration: '90 days', color: '#8B5CF6' },
    { name: 'Gold Package', price: '₹4,999', duration: '365 days', color: '#E11D48' },
    { name: 'Annual Premium', price: '₹3,499', duration: '180 days', color: '#10B981' },
    { name: 'Student Plan', price: '₹499', duration: '30 days', color: '#F59E0B' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Service Packages</h3>
        <div style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', fontSize: '11px', fontWeight: '700' }}>+ New Package</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {plans.map(p => (
          <div key={p.name} style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderTop: `3px solid ${p.color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ fontSize: '9px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{p.name}</p>
              <span style={{ fontSize: '8px', fontWeight: '800', color: '#10B981', backgroundColor: '#10B98115', padding: '2px 8px', borderRadius: '10px' }}>Active</span>
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: '900', color: '#0F172A', margin: '0 0 4px' }}>{p.price}</p>
            <p style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', margin: 0 }}>{p.duration}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BroadcastView() {
  const [activeTab, setActiveTab] = useState('all');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <div>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 2px' }}>Broadcast</h3>
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>Send WhatsApp messages to your clients</p>
        </div>
      </div>

      <div className="idp-broadcast-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
        {/* Left — Compose */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Recipients */}
          <div>
            <p style={{ fontSize: '9px', fontWeight: '800', color: '#E11D48', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Recipients</p>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { label: 'All', count: 10, active: activeTab === 'all' },
                { label: 'Active', count: 2, active: activeTab === 'active' },
                { label: 'Inactive', count: 1, active: activeTab === 'inactive' },
              ].map(t => (
                <button key={t.label} onClick={() => setActiveTab(t.label.toLowerCase())} style={{
                  padding: '5px 14px', borderRadius: '20px', border: 'none',
                  backgroundColor: t.active ? '#E11D48' : '#F1F5F9',
                  color: t.active ? '#FFF' : '#64748B',
                  fontSize: '10px', fontWeight: '700', cursor: 'pointer',
                  transition: 'all 150ms',
                }}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <p style={{ fontSize: '9px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Message</p>
              <span style={{ fontSize: '9px', fontWeight: '700', color: '#8B5CF6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>✨ Try Different Vibe (1)</span>
            </div>
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', minHeight: '110px' }}>
              <p style={{ fontSize: '11px', color: '#334155', margin: 0, lineHeight: '1.7' }}>
                Hi! 👋<br /><br />
                Glamour Studio will be closed for maintenance on tomorrow.<br /><br />
                We'll be back stronger! Regular hours resume the next day. 🙏 💪
              </p>
            </div>
            <p style={{ fontSize: '9px', color: '#CBD5E1', margin: '4px 0 0', textAlign: 'right' }}>162/1024 characters</p>
          </div>

          {/* Send Button */}
          <button style={{
            width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #E11D48, #BE123C)',
            color: '#FFF', fontSize: '12px', fontWeight: '800', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(225,29,72,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            📢 Send Broadcast to 10 Clients
          </button>
        </div>

        {/* Right — Preview + Templates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* WhatsApp Preview */}
          <div>
            <p style={{ fontSize: '9px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '4px' }}>📱 Preview</p>
            <div style={{ padding: '14px', borderRadius: '14px', background: 'linear-gradient(135deg, #075E54, #128C7E)', position: 'relative', overflow: 'hidden' }}>
              {/* Chat bubble */}
              <div style={{ backgroundColor: '#DCF8C6', borderRadius: '10px 10px 10px 2px', padding: '10px 12px', marginBottom: '4px' }}>
                <p style={{ fontSize: '10px', color: '#1B5E20', margin: 0, lineHeight: '1.6', fontWeight: '500' }}>
                  Hey <strong>*Glamour Studio*</strong> family! 🏋️<br /><br />
                  Hi! 👋<br /><br />
                  Glamour Studio will be closed for maintenance on tomorrow.<br /><br />
                  We'll be back stronger! Regular hours resume the next day. 🙏 💪
                </p>
                <p style={{ fontSize: '8px', color: '#66BB6A', margin: '6px 0 0', textAlign: 'right' }}>03:56 pm ✓✓</p>
              </div>
            </div>
          </div>

          {/* Quick Templates */}
          <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#FFF', border: '1px solid #E2E8F0' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' }}>Quick Templates</p>
            {[
              { icon: '🎉', label: 'Festival Offer' },
              { icon: '🆕', label: 'New Batch' },
              { icon: '🔧', label: 'Maintenance' },
            ].map(t => (
              <div key={t.label} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 8px', borderRadius: '8px', cursor: 'pointer',
                marginBottom: '4px', transition: 'all 150ms',
              }}>
                <span style={{ fontSize: '13px' }}>{t.icon}</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#334155' }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpensesView() {
  const expenses = [
    { category: '🔧', name: 'Repair & Maintenance', date: '12 Apr 2026', desc: 'AC servicing & plumbing', amount: '₹12,500', color: '#F59E0B' },
    { category: '💡', name: 'Utilities', date: '10 Apr 2026', desc: 'Electricity bill — April', amount: '₹1,500', color: '#3B82F6' },
    { category: '🏠', name: 'Rent', date: '01 Apr 2026', desc: 'Monthly rent — Jaya Nagar', amount: '₹25,000', color: '#8B5CF6' },
    { category: '🏋️', name: 'Equipment', date: '05 Apr 2026', desc: 'New treadmill purchase', amount: '₹25,000', color: '#E11D48' },
    { category: '💰', name: 'Salary', date: '01 Apr 2026', desc: 'Staff salaries — April', amount: '₹45,000', color: '#10B981' },
    { category: '📋', name: 'Other', date: '08 Apr 2026', desc: 'Marketing materials', amount: '₹3,500', color: '#64748B' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Expenses</h3>
        <div style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', fontSize: '11px', fontWeight: '700' }}>+ Add Expense</div>
      </div>
      {/* Monthly Total */}
      <div style={{ padding: '16px', borderRadius: '12px', background: 'linear-gradient(135deg, #E11D48, #9F1239)', marginBottom: '14px', boxShadow: '0 4px 16px rgba(225,29,72,0.25)' }}>
        <p style={{ fontSize: '9px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Monthly Total</p>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: '900', color: '#FFF', margin: 0 }}>₹64,000</p>
      </div>
      {/* Expense List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {expenses.map(e => (
          <div key={e.name} style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderLeft: `3px solid ${e.color}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{e.category}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', margin: '0 0 2px' }}>{e.name}</p>
              <p style={{ fontSize: '9px', color: '#94A3B8', margin: 0 }}>{e.date} · {e.desc}</p>
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>{e.amount}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


function EmployeesView() {
  const employees = [
    { name: 'Priya', email: 'priya@snipandglow.in', role: 'Branch Manager', status: 'Active', statusColor: '#10B981', avatar: 'P' },
    { name: 'Kavya', email: 'kavya@snipandglow.in', role: 'Stylist', status: 'Disabled', statusColor: '#EF4444', avatar: 'K' },
    { name: 'Meera', email: 'meera@snipandglow.in', role: 'Sales Executive', status: 'Active', statusColor: '#10B981', avatar: 'M' },
    { name: 'Sunita', email: 'sunita@snipandglow.in', role: 'Receptionist', status: 'Active', statusColor: '#10B981', avatar: 'S' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Staff</h3>
        <div style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', fontSize: '11px', fontWeight: '700' }}>+ Add Employee</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {employees.map(e => (
          <div key={e.name} style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #FFF1F2, #FECDD3)', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', flexShrink: 0 }}>{e.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', margin: 0 }}>{e.name}</p>
                <span style={{ fontSize: '8px', fontWeight: '800', color: '#8B5CF6', backgroundColor: '#8B5CF615', padding: '2px 8px', borderRadius: '10px' }}>{e.role}</span>
                <span style={{ fontSize: '8px', fontWeight: '800', color: e.statusColor, backgroundColor: e.statusColor + '15', padding: '2px 8px', borderRadius: '10px' }}>{e.status}</span>
              </div>
              <p style={{ fontSize: '10px', color: '#94A3B8', margin: 0 }}>{e.email}</p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '9px', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#334155', cursor: 'pointer' }}>Edit</span>
              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '9px', fontWeight: '700', backgroundColor: e.status === 'Active' ? '#FEF2F2' : '#ECFDF5', color: e.status === 'Active' ? '#EF4444' : '#10B981', cursor: 'pointer' }}>{e.status === 'Active' ? 'Disable' : 'Enable'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BranchesView() {
  const branches = [
    { name: 'Koramangala Branch', address: '80 Feet Road, Koramangala', isDefault: true },
    { name: 'Indiranagar Branch', address: 'Main Road, Indiranagar', isDefault: false },
    { name: 'Jaya Nagar Branch', address: 'Main Street, Jaya Nagar', isDefault: false },
    { name: 'HSR Layout Branch', address: 'Sector 2, HSR Layout', isDefault: false },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Branches</h3>
        <div style={{ padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', fontSize: '11px', fontWeight: '700' }}>+ Add Branch</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {branches.map(b => (
          <div key={b.name} style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderLeft: b.isDefault ? '3px solid #E11D48' : '3px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: b.isDefault ? 'linear-gradient(135deg, #FFF1F2, #FECDD3)' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🏢</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', margin: 0 }}>{b.name}</p>
                {b.isDefault && <span style={{ fontSize: '8px', fontWeight: '800', color: '#E11D48', backgroundColor: '#FFF1F2', padding: '2px 8px', borderRadius: '10px' }}>DEFAULT</span>}
              </div>
              <p style={{ fontSize: '10px', color: '#94A3B8', margin: 0 }}>{b.address}</p>
            </div>
            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '9px', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#334155', cursor: 'pointer' }}>Edit</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityLogView() {
  const todayEntries = [
    { time: '10:32 AM', name: 'Priya Singh', role: 'Admin', action: 'LOGIN', actionColor: '#3B82F6', desc: 'Logged in from Chrome / Windows', dotColor: '#3B82F6' },
    { time: '10:35 AM', name: 'Priya Singh', role: 'Admin', action: 'CLIENT ADDED', actionColor: '#10B981', desc: 'Added new client Priya Sharma', dotColor: '#10B981' },
    { time: '10:40 AM', name: 'Kavya', role: 'Manager', action: 'LEAD UPDATED', actionColor: '#F59E0B', desc: 'Updated lead Ritu Verma', dotColor: '#F59E0B' },
    { time: '10:38 AM', name: 'Priya Singh', role: 'Admin', action: 'PAYMENT', actionColor: '#10B981', desc: 'Recorded payment for Priya Sharma', dotColor: '#10B981' },
  ];
  const yesterdayEntries = [
    { time: '06:45 PM', name: 'Priya Singh', role: 'Admin', action: 'LOGOUT', actionColor: '#64748B', desc: 'Session ended', dotColor: '#64748B' },
    { time: '09:15 AM', name: 'Priya Singh', role: 'Admin', action: 'LOGIN', actionColor: '#3B82F6', desc: 'Logged in from Chrome / Windows', dotColor: '#3B82F6' },
    { time: '03:30 PM', name: 'Kavya', role: 'Manager', action: 'CLIENT ADDED', actionColor: '#10B981', desc: 'Added client Meera Nair', dotColor: '#10B981' },
    { time: '11:00 AM', name: 'Priya Singh', role: 'Admin', action: 'BROADCAST', actionColor: '#8B5CF6', desc: 'Sent broadcast to 10 clients', dotColor: '#8B5CF6' },
  ];
  return (
    <div>
      <div style={{ marginBottom: '14px', paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' }}>Audit Trail</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { label: 'Events', value: '187', color: '#3B82F6' },
            { label: 'Users', value: '4', color: '#8B5CF6' },
            { label: 'Automations', value: '0', color: '#F59E0B' },
            { label: 'Deletions', value: '14', color: '#EF4444' },
          ].map(s => (
            <div key={s.label} style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#FFF', border: '1px solid #E2E8F0' }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: '900', color: s.color }}>{s.value}</span>
              <span style={{ fontSize: '9px', fontWeight: '600', color: '#94A3B8', marginLeft: '4px' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Today */}
      <p style={{ fontSize: '9px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Today</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
        {todayEntries.map((e, i) => (
          <div key={i} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '9px', fontWeight: '600', color: '#94A3B8', minWidth: '56px' }}>{e.time}</span>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: e.dotColor, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A' }}>{e.name}</span>
            <span style={{ fontSize: '8px', fontWeight: '800', color: '#8B5CF6', backgroundColor: '#8B5CF615', padding: '1px 6px', borderRadius: '8px' }}>{e.role}</span>
            <span style={{ fontSize: '8px', fontWeight: '800', color: e.actionColor, backgroundColor: e.actionColor + '15', padding: '1px 6px', borderRadius: '8px' }}>{e.action}</span>
            <span style={{ fontSize: '10px', color: '#64748B', flex: 1, textAlign: 'right' }}>{e.desc}</span>
          </div>
        ))}
      </div>
      {/* Yesterday */}
      <p style={{ fontSize: '9px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Yesterday</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {yesterdayEntries.map((e, i) => (
          <div key={i} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '9px', fontWeight: '600', color: '#94A3B8', minWidth: '56px' }}>{e.time}</span>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: e.dotColor, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A' }}>{e.name}</span>
            <span style={{ fontSize: '8px', fontWeight: '800', color: '#8B5CF6', backgroundColor: '#8B5CF615', padding: '1px 6px', borderRadius: '8px' }}>{e.role}</span>
            <span style={{ fontSize: '8px', fontWeight: '800', color: e.actionColor, backgroundColor: e.actionColor + '15', padding: '1px 6px', borderRadius: '8px' }}>{e.action}</span>
            <span style={{ fontSize: '10px', color: '#64748B', flex: 1, textAlign: 'right' }}>{e.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ paddingBottom: '10px', borderBottom: '2px solid #FFF1F2' }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 2px' }}>Global Settings</h3>
        <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Configure infrastructure, financial parameters, and third-party integrations</p>
      </div>

      {/* Salon Information */}
      <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #FFF1F2, #FECDD3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🏠</div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Salon Information</span>
          </div>
          <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '9px', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#334155', cursor: 'pointer' }}>✏️ Edit Salon</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '2px solid #D4A017', boxShadow: '0 2px 8px rgba(212,160,23,0.3)' }}>
          <img src="/snipandglow-logo.png" alt="Snip & Glow" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<div style="width:100%;height:100%;background:linear-gradient(135deg,#E11D48,#BE123C);display:flex;align-items:center;justify-content:center;color:#FFF;font-size:16px;font-weight:900">S</div>'; }} />
          </div>
          <div>
            <p style={{ fontSize: '9px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>Change Logo</p>
            <p style={{ fontSize: '8px', color: '#E11D48', fontWeight: '600', margin: '0 0 1px', cursor: 'pointer' }}>Remove</p>
            <p style={{ fontSize: '7px', color: '#CBD5E1', margin: 0 }}>PNG, JPG up to 7MB</p>
          </div>
          <div style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', marginLeft: '8px' }}>
            <p style={{ fontSize: '9px', color: '#64748B', margin: 0, lineHeight: '1.5' }}>Salon information is used across client communications and invoices. Ensure the details are legally accurate.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { label: 'Salon Name', value: 'Glamour Studio' },
            { label: 'Owner', value: 'Priya Singh' },
            { label: 'Phone', value: '919988688654' },
            { label: 'Status', value: '● ACTIVE', isStatus: true },
          ].map(r => (
            <div key={r.label}>
              <p style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>{r.label}</p>
              <p style={{ fontSize: '12px', fontWeight: '800', color: 'isStatus' in r && r.isStatus ? '#10B981' : '#0F172A', margin: 0 }}>{r.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invoicing Infrastructure */}
      <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>📋</div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Invoicing Infrastructure</span>
          </div>
          <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '9px', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#334155', cursor: 'pointer' }}>✏️ Configure Ledger</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {[
            { label: 'Merchant Branding', value: 'Glamour Studio' },
            { label: 'Dispatch Address', value: '—' },
            { label: 'Revenue Registry', value: 'EXEMPTED' },
            { label: 'Tax Profile', value: 'GST @ 18%' },
            { label: 'Invoice SKU', value: 'INV' },
            { label: 'Next Sequence', value: '#6' },
          ].map(r => (
            <div key={r.label}>
              <p style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>{r.label}</p>
              <p style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', margin: 0, fontFamily: r.value.startsWith('#') || r.value === 'INV' ? "'JetBrains Mono', monospace" : 'inherit' }}>{r.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp Integration */}
      <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #25D366' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>💬</div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>WhatsApp Integration</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.5)' }} />
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#10B981' }}>Connected</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <p style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>Provider</p>
            <p style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Meta Verified ✅</p>
          </div>
          <div>
            <p style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>Templates Active</p>
            <p style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', margin: 0 }}>5 templates</p>
          </div>
        </div>
      </div>
    </div>
  );
}


const MODULE_VIEWS: Record<Module, () => React.JSX.Element> = {
  dashboard: DashboardView,
  members: MembersView,
  leads: LeadsView,
  billing: BillingView,
  automations: AutomationsView,
  analytics: AnalyticsView,
  plans: PlansView,
  broadcast: BroadcastView,
  expenses: ExpensesView,
  employees: EmployeesView,
  branches: BranchesView,
  activitylog: ActivityLogView,
  settings: SettingsView,
};

export default function InteractiveDashboard() {
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [isMobile, setIsMobile] = useState(false);
  const ViewComponent = MODULE_VIEWS[activeModule];

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
      {/* Browser Chrome */}
      <div style={{
        backgroundColor: '#1E293B', borderRadius: '16px 16px 0 0',
        padding: isMobile ? '10px 12px' : '14px 16px', display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
        </div>
        {!isMobile && (
        <div style={{ flex: 1, marginLeft: '8px', backgroundColor: '#334155', borderRadius: '6px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>snipandglow.com/dashboard</span>
        </div>
        )}
      </div>

      {/* App Layout */}
      <div data-theme="light" style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        backgroundColor: '#FAFBFC',
        borderRadius: '0 0 16px 16px', border: '1px solid #E2E8F0', borderTop: 'none',
        minHeight: isMobile ? '320px' : '420px', overflow: 'hidden',
      }}>
        {/* Sidebar — vertical on desktop, horizontal tabs on mobile */}
        {isMobile ? (
          <div style={{
            display: 'flex', gap: '4px', padding: '8px',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFF',
            scrollbarWidth: 'none',
          }}>
            {MODULES.map(mod => {
              const isActive = activeModule === mod.key;
              return (
                <button
                  key={mod.key}
                  onClick={() => setActiveModule(mod.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '6px 10px', borderRadius: '8px', border: 'none',
                    backgroundColor: isActive ? '#FFF1F2' : 'transparent',
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'all 150ms',
                  }}
                >
                  <span style={{ fontSize: '11px' }}>{mod.icon}</span>
                  <span style={{ fontSize: '10px', fontWeight: isActive ? '700' : '500', color: isActive ? '#E11D48' : '#64748B' }}>{mod.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{
            width: '170px', flexShrink: 0,
            background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFBFC 100%)',
            borderRight: '1px solid #E2E8F0',
            padding: '14px 8px',
            display: 'flex', flexDirection: 'column', gap: '1px',
            overflowY: 'auto',
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', marginBottom: '14px' }}>
              <img src="/pingflow-logo.svg" alt="Snip & Glow" style={{ width: '26px', height: '26px', borderRadius: '8px' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', fontFamily: "'Outfit', sans-serif" }}>Snip & Glow</span>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                </div>
                <span style={{ fontSize: '8px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>GLAMOUR STUDIO</span>
              </div>
            </div>

            {/* Menu Label */}
            <p style={{ fontSize: '8px', fontWeight: '800', color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 10px', margin: '0 0 6px' }}>Menu</p>

            {/* Nav Items */}
            {MODULES.map(mod => {
              const isActive = activeModule === mod.key;
              return (
                <button
                  key={mod.key}
                  onClick={() => setActiveModule(mod.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '8px', border: 'none',
                    backgroundColor: isActive ? '#FFF1F2' : 'transparent',
                    borderLeft: isActive ? '3px solid #E11D48' : '3px solid transparent',
                    cursor: 'pointer', transition: 'all 150ms',
                    width: '100%', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '13px', opacity: isActive ? 1 : 0.7 }}>{mod.icon}</span>
                  <span style={{
                    fontSize: '11.5px', fontWeight: isActive ? '700' : '500',
                    color: isActive ? '#E11D48' : '#475569',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    {mod.label}
                    {isActive && <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#E11D48', display: 'inline-block', flexShrink: 0 }} />}
                    {mod.label === 'Automations' && <span style={{ fontSize: '7px', fontWeight: '800', color: '#10B981', backgroundColor: '#ECFDF5', padding: '1px 5px', borderRadius: '4px' }}>LIVE</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Content */}
        <div style={{ flex: 1, padding: isMobile ? '14px 12px' : '18px 20px', overflow: 'auto', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)' }}>
          <ViewComponent />
        </div>
      </div>

    </div>
  );
}
