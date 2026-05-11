// PingFlow — Leads Pipeline Page
// Full lead management with status tabs, CRUD modals, WhatsApp action, and conversion heatmap

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { useRole } from '@/hooks/useRole';
import { usePlan } from '@/hooks/usePlan';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UpgradeModal from '@/components/ui/UpgradeModal';
import { toast } from '@/components/ui/Toast';
import { maskPhone, formatPhoneE164 } from '@/lib/utils';
import {
  subscribeLeads,
  createLead,
  updateLead,
  deleteLead,
  claimLead,
} from '@/services/leads.service';
import { subscribePlans } from '@/services/plans.service';
import { createMember } from '@/services/members.service';
import { logActivity } from '@/services/audit.service';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/services/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Timestamp } from 'firebase/firestore';
import type { Lead, LeadStatus, LeadSource, Plan, Employee } from '@/types';

const ALL_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Trial Scheduled', 'Trial Done', 'Negotiation', 'Converted', 'Lost'];
const SOURCES: LeadSource[] = ['Social Media', 'Walk-in', 'Referral'];

const STATUS_CONFIG: Record<LeadStatus, { bg: string; color: string; emoji: string; border: string }> = {
  'New':             { bg: '#EFF6FF', color: '#3B82F6', emoji: '🆕', border: '#3B82F6' },
  'Contacted':       { bg: '#F0FDF4', color: '#16A34A', emoji: '📞', border: '#16A34A' },
  'Trial Scheduled': { bg: '#FFFBEB', color: '#D97706', emoji: '📅', border: '#D97706' },
  'Trial Done':      { bg: '#FDF4FF', color: '#A855F7', emoji: '✅', border: '#A855F7' },
  'Negotiation':     { bg: '#FFF7ED', color: '#EA580C', emoji: '🤝', border: '#EA580C' },
  'Converted':       { bg: '#ECFDF5', color: '#059669', emoji: '🎉', border: '#059669' },
  'Lost':            { bg: '#FEF2F2', color: '#DC2626', emoji: '❌', border: '#DC2626' },
};

const SOURCE_CONFIG: Record<LeadSource, { bg: string; color: string; border: string }> = {
  'Social Media': { bg: '#EFF6FF', color: '#3B82F6', border: '#93C5FD' },
  'Walk-in':      { bg: '#F0FDF4', color: '#16A34A', border: '#86EFAC' },
  'Referral':     { bg: '#FDF4FF', color: '#A855F7', border: '#D8B4FE' },
};

export default function LeadsPage() {
  const { user, gymId } = useAuthStore();
  const { isMobile } = useResponsive();
  const { role, can } = useRole();
  const { isAtLimit, canAccess } = usePlan();

  // Data state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState<LeadStatus>('New');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Add/Edit modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Convert modal state
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertPlanId, setConvertPlanId] = useState('');
  const [convertStartDate, setConvertStartDate] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSource, setFormSource] = useState<LeadSource>('Walk-in');
  const [formStatus, setFormStatus] = useState<LeadStatus>('New');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formTrialDate, setFormTrialDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const resolvedGymId = gymId || user?.uid || '';

  // Subscribe to leads
  useEffect(() => {
    if (!resolvedGymId) return;
    setIsLoading(true);
    const unsub = subscribeLeads(
      resolvedGymId,
      (data) => { setLeads(data); setIsLoading(false); },
      (err) => { console.error(err); setIsLoading(false); }
    );
    return unsub;
  }, [resolvedGymId]);

  // Subscribe to employees (for assignedTo dropdown and name resolution)
  useEffect(() => {
    if (!resolvedGymId) return;
    const q = query(collection(db, 'gyms', resolvedGymId, 'employees'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    });
    return unsub;
  }, [resolvedGymId]);

  // Subscribe to plans (for convert modal)
  useEffect(() => {
    if (!resolvedGymId) return;
    const unsub = subscribePlans(resolvedGymId, setPlans, (err) => console.error(err));
    return unsub;
  }, [resolvedGymId]);

  // Stylist privacy filter — stylists only see their own leads
  const filteredLeads = useMemo(() => {
    if (role === 'stylist') {
      return leads.filter(l => {
        if (l.status === 'Converted' || l.status === 'Lost') return false;
        return l.assignedTo === user?.uid || (l.assignedTo === null && l.status === 'New');
      });
    }
    return leads;
  }, [leads, role, user?.uid]);

  // Visible tabs (stylists don't see Converted/Lost)
  const visibleTabs = useMemo(() => {
    if (role === 'stylist') return ALL_STATUSES.filter(s => s !== 'Converted' && s !== 'Lost');
    return ALL_STATUSES;
  }, [role]);

  // Leads for current tab
  const tabLeads = useMemo(() => filteredLeads.filter(l => l.status === activeTab), [filteredLeads, activeTab]);

  // Active lead count (not Converted, not Lost) for plan limit
  const activeLeadCount = useMemo(() => leads.filter(l => l.status !== 'Converted' && l.status !== 'Lost').length, [leads]);

  // Summary stats
  const totalLeads = leads.length;
  const convertedCount = useMemo(() => leads.filter(l => l.status === 'Converted').length, [leads]);
  const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

  // Employee name resolver
  const getEmployeeName = (uid: string | null): string => {
    if (!uid) return 'Unassigned';
    if (uid === resolvedGymId) return useAuthStore.getState().gym?.ownerName || 'Admin';
    const emp = employees.find(e => e.uid === uid);
    return emp?.name || 'Unknown';
  };

  // ─── Add/Edit Modal Handlers ──────────────────────────────────────────────

  const openCreateModal = () => {
    if (isAtLimit('leads', activeLeadCount)) {
      setShowUpgradeModal(true);
      return;
    }
    setEditingLead(null);
    setFormName(''); setFormPhone(''); setFormEmail('');
    setFormSource('Walk-in'); setFormStatus('New');
    setFormAssignedTo(''); setFormTrialDate(''); setFormNotes('');
    setIsFormOpen(true);
  };

  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setFormName(lead.name);
    setFormPhone(lead.phone);
    setFormEmail(lead.email || '');
    setFormSource(lead.source);
    setFormStatus(lead.status);
    setFormAssignedTo(lead.assignedTo || '');
    setFormTrialDate(lead.trialDate ? lead.trialDate.toDate().toISOString().split('T')[0] : '');
    setFormNotes('');
    setIsFormOpen(true);
  };

  const handleSaveLead = async () => {
    if (!resolvedGymId) return;
    if (!formName.trim() || !formPhone.trim()) {
      toast('Name and phone are required', 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (editingLead?.id) {
        const changes: Partial<Lead> & Record<string, unknown> = {
          name: formName.trim(),
          phone: formatPhoneE164(formPhone),
          email: formEmail.trim() || undefined,
          source: formSource,
          status: formStatus,
          assignedTo: formAssignedTo || null,
          trialDate: formTrialDate ? Timestamp.fromDate(new Date(formTrialDate)) : null,
        };
        if (formNotes.trim()) {
          const existingNotes = editingLead.notes || [];
          changes.notes = [...existingNotes, {
            text: formNotes.trim(),
            createdBy: user?.uid || 'unknown',
            createdAt: Timestamp.now(),
          }];
        }
        await updateLead(resolvedGymId, editingLead.id, changes);
        toast('Lead updated', 'success');
      } else {
        await createLead(resolvedGymId, {
          name: formName.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim() || undefined,
          source: formSource,
          trialDate: formTrialDate ? new Date(formTrialDate) : null,
          notes: formNotes.trim() || undefined,
        });
        toast('Lead added', 'success');
      }
      setIsFormOpen(false);
    } catch (err: any) {
      toast(err.message || 'Failed to save lead', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Delete Handler ───────────────────────────────────────────────────────

  const handleDeleteLead = async () => {
    if (!resolvedGymId || !deletingLead?.id) return;
    setIsDeleting(true);
    try {
      await deleteLead(resolvedGymId, deletingLead.id);
      toast('Lead deleted', 'success');
      setDeletingLead(null);
    } catch (err: any) {
      toast(err.message || 'Failed to delete lead', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Claim Handler ────────────────────────────────────────────────────────

  const handleClaimLead = async (lead: Lead) => {
    if (!resolvedGymId || !lead.id || !user?.uid) return;
    try {
      await claimLead(resolvedGymId, lead.id, user.uid, user.displayName || 'Stylist');
      toast('Lead claimed!', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to claim lead', 'error');
    }
  };

  // ─── WhatsApp Handler ─────────────────────────────────────────────────────

  const handleWhatsApp = async (lead: Lead) => {
    if (!resolvedGymId) return;
    try {
      const functions = getFunctions(app, 'asia-south1');
      const sendFn = httpsCallable(functions, 'sendLeadWhatsApp');
      const result = await sendFn({ gymId: resolvedGymId, phone: lead.phone, leadName: lead.name });
      const data = result.data as { success: boolean; error?: string };
      if (data.success) {
        toast('WhatsApp message sent!', 'success');
        logActivity('LEAD_WHATSAPP_SENT', `Sent WhatsApp to ${lead.name}`, { leadId: lead.id, phone: lead.phone });
      } else {
        toast(data.error || 'Failed to send WhatsApp', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Network error sending WhatsApp', 'error');
    }
  };

  // ─── Convert to Member Handler ────────────────────────────────────────────

  const openConvertModal = (lead: Lead) => {
    setConvertingLead(lead);
    setConvertPlanId('');
    setConvertStartDate(new Date().toISOString().split('T')[0]);
  };

  const handleConvert = async () => {
    if (!resolvedGymId || !convertingLead?.id || !convertPlanId) {
      toast('Please select a plan', 'error');
      return;
    }
    const selectedPlan = plans.find(p => p.id === convertPlanId);
    if (!selectedPlan) { toast('Invalid plan selected', 'error'); return; }

    setIsConverting(true);
    try {
      const startDate = new Date(convertStartDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + selectedPlan.durationDays);

      const memberId = await createMember(resolvedGymId, {
        name: convertingLead.name,
        phone: convertingLead.phone,
        planId: convertPlanId,
        planName: selectedPlan.name,
        startDate,
        endDate,
        lastVisitDate: null,
      });

      try {
        await updateLead(resolvedGymId, convertingLead.id, { status: 'Converted' } as Partial<Lead>);
      } catch {
        toast('Member created but lead status update failed. Please update manually.', 'info');
      }

      logActivity('LEAD_CONVERTED', `Converted lead ${convertingLead.name} to member`, {
        leadId: convertingLead.id,
        memberId,
        planName: selectedPlan.name,
      });

      toast(`${convertingLead.name} converted to member!`, 'success');
      setConvertingLead(null);
    } catch (err: any) {
      toast(err.message || 'Failed to convert lead', 'error');
    } finally {
      setIsConverting(false);
    }
  };

  // ─── Shared Styles ────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '46px', padding: '0 16px', borderRadius: '12px',
    border: '1px solid #E2E8F0', backgroundColor: '#FFF', color: '#0F172A',
    fontSize: '14px', fontFamily: "'Inter', sans-serif", outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 150ms ease',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
  };
  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer', appearance: 'none' as const,
    background: '#FFF url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E") no-repeat right 14px center',
  };

  // ─── Conversion Heatmap Data ──────────────────────────────────────────────

  const convertedLeads = useMemo(() => leads.filter(l => l.status === 'Converted'), [leads]);

  const heatmapByStylist = useMemo(() => {
    const map: Record<string, number> = {};
    convertedLeads.forEach(l => {
      const key = l.assignedTo || 'Unassigned';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [convertedLeads]);

  const heatmapBySource = useMemo(() => {
    const map: Record<string, number> = {};
    convertedLeads.forEach(l => {
      map[l.source] = (map[l.source] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [convertedLeads]);

  const maxStylistCount = heatmapByStylist.length > 0 ? heatmapByStylist[0][1] : 1;
  const maxSourceCount = heatmapBySource.length > 0 ? heatmapBySource[0][1] : 1;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Leads Pipeline
            </h1>
            <span style={{
              fontSize: '12px', fontWeight: '800', color: '#E11D48',
              backgroundColor: '#FFF1F2', padding: '3px 10px', borderRadius: '20px',
              border: '1px solid #FECDD3',
            }}>
              {filteredLeads.length}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0', fontWeight: '500' }}>
            Track and convert prospective members
          </p>
        </div>
        {can('create', 'leads') && (
          <button
            onClick={openCreateModal}
            className="btn-press"
            style={{
              width: isMobile ? '100%' : 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              background: 'linear-gradient(135deg, #E11D48, #BE123C)', border: 'none', borderRadius: '12px',
              padding: '12px 24px', cursor: 'pointer', fontSize: '14px', fontWeight: '800', color: '#FFFFFF',
              boxShadow: '0 4px 14px rgba(225,29,72,0.3)', transition: 'all 200ms',
            }}
          >
            + Add Lead
          </button>
        )}
      </div>

      {/* ─── Summary Stats Row ─────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {/* Total Leads */}
        <div style={{
          background: 'linear-gradient(135deg, #F8FAFC, #FFFFFF)',
          border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 18px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Total Leads</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '26px', fontWeight: '800', color: '#0F172A', margin: 0 }}>{totalLeads}</p>
        </div>
        {/* Active Pipeline */}
        <div style={{
          background: 'linear-gradient(135deg, #EFF6FF, #FFFFFF)',
          border: '1px solid #BFDBFE', borderRadius: '14px', padding: '16px 18px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Active Pipeline</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '26px', fontWeight: '800', color: '#2563EB', margin: 0 }}>{activeLeadCount}</p>
        </div>
        {/* Converted */}
        <div style={{
          background: 'linear-gradient(135deg, #ECFDF5, #FFFFFF)',
          border: '1px solid #D1FAE5', borderRadius: '14px', padding: '16px 18px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Converted</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '26px', fontWeight: '800', color: '#059669', margin: 0 }}>{convertedCount}</p>
        </div>
        {/* Conversion Rate */}
        <div style={{
          background: 'linear-gradient(135deg, #FDF4FF, #FFFFFF)',
          border: '1px solid #E9D5FF', borderRadius: '14px', padding: '16px 18px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Conversion Rate</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '26px', fontWeight: '800', color: '#7C3AED', margin: 0 }}>{conversionRate}%</p>
        </div>
      </div>

      {/* ─── Status Tabs (Pill Buttons) ────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '20px',
        overflowX: 'auto', paddingBottom: '4px',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}>
        {visibleTabs.map(status => {
          const count = filteredLeads.filter(l => l.status === status).length;
          const isActive = activeTab === status;
          const cfg = STATUS_CONFIG[status];
          return (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              style={{
                padding: '8px 16px', borderRadius: '20px',
                border: isActive ? `1.5px solid ${cfg.color}` : '1.5px solid transparent',
                backgroundColor: isActive ? cfg.bg : '#F8FAFC',
                color: isActive ? cfg.color : '#64748B',
                fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex', alignItems: 'center', gap: '6px',
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <span>{cfg.emoji}</span>
              {status}
              <span style={{
                fontSize: '10px', fontWeight: '800',
                backgroundColor: isActive ? cfg.color : '#CBD5E1',
                color: '#FFF', padding: '1px 7px', borderRadius: '10px',
                minWidth: '18px', textAlign: 'center',
                transition: 'all 200ms ease',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Lead Cards ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '10px',
        marginBottom: '28px',
      }}>
        {isLoading ? (
          <div style={{ padding: '16px', backgroundColor: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '80px', marginBottom: '10px', borderRadius: '12px' }} />)}
          </div>
        ) : tabLeads.length === 0 ? (
          <div style={{
            backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0',
            borderRadius: '16px', padding: '80px 20px', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{STATUS_CONFIG[activeTab].emoji}</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>
              No {activeTab} leads
            </p>
            <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '340px', margin: '0 auto' }}>
              {activeTab === 'New' ? 'Add your first lead to start tracking prospects.' : `No leads in the "${activeTab}" stage yet.`}
            </p>
          </div>
        ) : (
          tabLeads.map((lead) => {
            const trialDateStr = lead.trialDate
              ? (lead.trialDate.toDate ? lead.trialDate.toDate() : new Date(lead.trialDate as any)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : null;
            const srcCfg = SOURCE_CONFIG[lead.source] || SOURCE_CONFIG['Walk-in'];
            const statusCfg = STATUS_CONFIG[lead.status];
            const lastNote = lead.notes && lead.notes.length > 0
              ? lead.notes[lead.notes.length - 1].text
              : null;
            const truncatedNote = lastNote && lastNote.length > 60 ? lastNote.slice(0, 60) + '…' : lastNote;

            return (
              <div
                key={lead.id}
                className="row-hover"
                style={{
                  display: 'flex',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? '14px' : '16px',
                  padding: '16px 20px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '14px',
                  borderLeft: `4px solid ${statusCfg.border}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 200ms ease',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Left: Avatar */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  border: `2.5px solid ${srcCfg.border}`,
                  background: `linear-gradient(135deg, ${srcCfg.bg}, #FFFFFF)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: '800', color: srcCfg.color, flexShrink: 0,
                  fontFamily: "'Outfit', sans-serif",
                }}>
                  {lead.name.charAt(0).toUpperCase()}
                </div>

                {/* Middle: Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', margin: 0 }}>{lead.name}</p>
                    <span style={{
                      fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px',
                      backgroundColor: srcCfg.bg, color: srcCfg.color, border: `1px solid ${srcCfg.border}`,
                    }}>{lead.source}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
                      {maskPhone(lead.phone)}
                    </span>
                    <span style={{ fontSize: '10px', color: '#CBD5E1' }}>•</span>
                    <span style={{ fontSize: '12px', color: lead.assignedTo ? '#334155' : '#94A3B8', fontWeight: '600' }}>
                      {getEmployeeName(lead.assignedTo)}
                    </span>
                    {trialDateStr && (
                      <>
                        <span style={{ fontSize: '10px', color: '#CBD5E1' }}>•</span>
                        <span style={{ fontSize: '12px', color: '#D97706', fontWeight: '600' }}>📅 {trialDateStr}</span>
                      </>
                    )}
                  </div>
                  {truncatedNote && (
                    <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? '100%' : '400px' }}>
                      💬 {truncatedNote}
                    </p>
                  )}
                </div>

                {/* Right: Status + Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                  {/* Quick status change — editable for non-converted, badge for converted/lost */}
                  {can('update', 'leads') && lead.status !== 'Converted' && lead.status !== 'Lost' ? (
                    <select
                      value={lead.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value as LeadStatus;
                        if (newStatus === lead.status || !lead.id) return;
                        try {
                          await updateLead(resolvedGymId, lead.id, { status: newStatus } as Partial<Lead>);
                          toast(`Moved to ${newStatus}`, 'success');
                        } catch { toast('Failed to update status', 'error'); }
                      }}
                      style={{
                        height: '32px', padding: '0 8px', borderRadius: '8px',
                        border: `1px solid ${statusCfg.color}30`,
                        backgroundColor: statusCfg.bg,
                        color: statusCfg.color,
                        fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                        outline: 'none', appearance: 'auto',
                      }}
                    >
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span style={{
                      height: '32px', padding: '0 12px', borderRadius: '8px',
                      backgroundColor: statusCfg.bg, color: statusCfg.color,
                      fontSize: '11px', fontWeight: '800',
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      border: `1px solid ${statusCfg.color}30`,
                    }}>
                      {statusCfg.emoji} {lead.status}
                    </span>
                  )}

                  {/* Icon button group: WhatsApp, Edit, Delete */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {/* WhatsApp */}
                    <button
                      onClick={() => handleWhatsApp(lead)}
                      title="Send WhatsApp"
                      style={{
                        width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #D1FAE5',
                        backgroundColor: '#ECFDF5', color: '#059669', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#D1FAE5'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ECFDF5'; e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </button>

                    {/* Edit */}
                    {can('update', 'leads') && (
                      <button
                        onClick={() => openEditModal(lead)}
                        title="Edit lead"
                        style={{
                          width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0',
                          backgroundColor: '#FFF', color: '#64748B', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#E11D48'; e.currentTarget.style.color = '#E11D48'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                    )}

                    {/* Delete */}
                    {can('delete', 'leads') && (
                      <button
                        onClick={() => setDeletingLead(lead)}
                        title="Delete lead"
                        style={{
                          width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0',
                          backgroundColor: '#FFF', color: '#64748B', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Claim button (trainers only, unassigned New leads) */}
                  {role === 'Stylist' && lead.assignedTo === null && lead.status === 'New' && (
                    <button
                      onClick={() => handleClaimLead(lead)}
                      className="btn-press"
                      style={{
                        padding: '6px 14px', borderRadius: '8px', border: '1px solid #BFDBFE',
                        backgroundColor: '#EFF6FF', fontSize: '11px', fontWeight: '700',
                        color: '#2563EB', cursor: 'pointer', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        transition: 'all 150ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#DBEAFE'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#EFF6FF'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" /><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                      </svg>
                      Claim
                    </button>
                  )}

                  {/* Convert button */}
                  {can('update', 'leads') && lead.status !== 'Converted' && (
                    <button
                      onClick={() => openConvertModal(lead)}
                      className="btn-press"
                      style={{
                        padding: '6px 14px', borderRadius: '8px', border: 'none',
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        fontSize: '11px', fontWeight: '800',
                        color: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap',
                        boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                        transition: 'all 150ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3)'; }}
                    >
                      Convert
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── Conversion Heatmap (Pro Only) ─────────────────────────────────── */}
      {canAccess('leads_analytics') && convertedLeads.length > 0 && (
        <div style={{ marginTop: '8px', marginBottom: '28px' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Conversion Heatmap
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            {/* By Stylist */}
            <div style={{
              backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px',
              padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
                By Stylist
              </p>
              {heatmapByStylist.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#94A3B8' }}>No conversions yet</p>
              ) : (
                heatmapByStylist.map(([uid, count]) => (
                  <div key={uid} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{getEmployeeName(uid)}</span>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#059669' }}>{count}</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '3px',
                        background: 'linear-gradient(90deg, #10B981, #059669)',
                        width: `${(count / maxStylistCount) * 100}%`,
                        transition: 'width 300ms ease',
                      }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* By Source */}
            <div style={{
              backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px',
              padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
                By Source
              </p>
              {heatmapBySource.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#94A3B8' }}>No conversions yet</p>
              ) : (
                heatmapBySource.map(([source, count]) => {
                  const sCfg = SOURCE_CONFIG[source as LeadSource] || { bg: '#F1F5F9', color: '#64748B' };
                  return (
                    <div key={source} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{source}</span>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: sCfg.color }}>{count}</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '3px',
                          backgroundColor: sCfg.color,
                          width: `${(count / maxSourceCount) * 100}%`,
                          transition: 'width 300ms ease',
                        }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Add/Edit Lead Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingLead ? 'Edit Lead' : 'Add Lead'}
        subtitle={editingLead ? `Update details for ${editingLead.name}` : 'Add a new prospective member'}
        footer={
          <>
            <GhostButton onClick={() => setIsFormOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={handleSaveLead} loading={isSaving}>
              {editingLead ? 'Save Changes' : 'Add Lead'}
            </PrimaryButton>
          </>
        }
      >
        {/* Colored header strip */}
        <div style={{
          margin: '-24px -24px 20px -24px',
          height: '4px',
          background: editingLead
            ? 'linear-gradient(90deg, #3B82F6, #2563EB)'
            : 'linear-gradient(90deg, #10B981, #059669)',
          borderRadius: '0',
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name & Phone row */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input style={inputStyle} value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Priya Sharma" />
            </div>
            <div>
              <label style={labelStyle}>Phone *</label>
              <input style={inputStyle} value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="9876543210" />
            </div>
          </div>
          {/* Email & Source row */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" style={inputStyle} value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="priya@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Source *</label>
              <select style={selectStyle} value={formSource} onChange={e => setFormSource(e.target.value as LeadSource)}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {editingLead && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={selectStyle} value={formStatus} onChange={e => setFormStatus(e.target.value as LeadStatus)}>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Assigned To</label>
                <select style={selectStyle} value={formAssignedTo} onChange={e => setFormAssignedTo(e.target.value)}>
                  <option value="">Unassigned</option>
                  {employees.filter(e => e.isActive).map(e => (
                    <option key={e.uid} value={e.uid}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div>
            <label style={labelStyle}>Trial Date</label>
            <input type="date" style={inputStyle} value={formTrialDate} onChange={e => setFormTrialDate(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>{editingLead ? 'Add Note' : 'Notes'}</label>
            <textarea
              style={{ ...inputStyle, height: '80px', padding: '12px 16px', resize: 'vertical' }}
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              placeholder={editingLead ? 'Add a new note...' : 'Initial notes about this lead...'}
            />
          </div>
        </div>
      </Modal>

      {/* ─── Convert to Member Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={!!convertingLead}
        onClose={() => setConvertingLead(null)}
        title="Convert to Member"
        subtitle={convertingLead ? `Convert ${convertingLead.name} to an active member` : ''}
        footer={
          <>
            <GhostButton onClick={() => setConvertingLead(null)}>Cancel</GhostButton>
            <PrimaryButton onClick={handleConvert} loading={isConverting}>Convert</PrimaryButton>
          </>
        }
      >
        {convertingLead && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Read-only lead info */}
            <div style={{
              padding: '14px 16px', borderRadius: '12px',
              backgroundColor: '#F0FDF4', border: '1px solid #D1FAE5',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: '800', color: '#059669',
              }}>
                {convertingLead.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', margin: '0 0 2px' }}>{convertingLead.name}</p>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{maskPhone(convertingLead.phone)}</p>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Membership Plan *</label>
              <select style={selectStyle} value={convertPlanId} onChange={e => setConvertPlanId(e.target.value)}>
                <option value="">Select a plan...</option>
                {plans.filter(p => p.isActive).map(p => (
                  <option key={p.id} value={p.id!}>
                    {p.name} — ₹{p.price.toLocaleString('en-IN')} ({p.durationDays} days)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" style={inputStyle} value={convertStartDate} onChange={e => setConvertStartDate(e.target.value)} />
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Delete Confirm ──────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deletingLead}
        onClose={() => setDeletingLead(null)}
        onConfirm={handleDeleteLead}
        title="Delete Lead"
        message={`Are you sure you want to delete ${deletingLead?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        variant="danger"
      />

      {/* ─── Upgrade Modal ───────────────────────────────────────────────── */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason="Active lead limit reached (50). Upgrade to Pro for unlimited leads."
      />
    </div>
  );
}
