// Snip & Glow — Settings Page

import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import {
  subscribeBillingSettings,
  saveBillingSettings,
} from '@/services/billing.service';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import { toast } from '@/components/ui/Toast';
import LogoUpload from '@/components/ui/LogoUpload';
import type { BillingSettings } from '@/types';

const Icons = {
  salon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  billing: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
};

export default function SettingsPage() {
  const { user, gym, setGym } = useAuthStore();
  const { isMobile } = useResponsive();

  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSalonEditOpen, setIsSalonEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSalonSaving, setIsSalonSaving] = useState(false);

  // Billing form state
  const [formSalonName, setFormSalonName] = useState('');
  const [formSalonAddress, setFormSalonAddress] = useState('');
  const [formSalonPhone, setFormSalonPhone] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formHsnCode, setFormHsnCode] = useState('');
  const [formGstRate, setFormGstRate] = useState('18');
  const [formInvoicePrefix, setFormInvoicePrefix] = useState('INV');
  const [formSendOnWhatsApp, setFormSendOnWhatsApp] = useState(false);

  // Salon edit form state
  const [salonFormName, setSalonFormName] = useState('');
  const [salonFormOwner, setSalonFormOwner] = useState('');
  const [salonFormPhone, setSalonFormPhone] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeBillingSettings(
      user.uid,
      (data) => setBillingSettings(data),
      (error) => console.error('Settings error:', error)
    );
    return unsub;
  }, [user]);

  // ─── Salon Edit Handlers ────────────────────────────────────────────────

  const openSalonEditModal = () => {
    setSalonFormName(gym?.name || '');
    setSalonFormOwner(gym?.ownerName || '');
    setSalonFormPhone(gym?.phone || '');
    setIsSalonEditOpen(true);
  };

  const handleSalonSave = async () => {
    if (!user) return;
    if (!salonFormName.trim()) { toast('Salon name is required', 'error'); return; }
    if (!salonFormOwner.trim()) { toast('Owner name is required', 'error'); return; }

    setIsSalonSaving(true);
    try {
      const gymRef = doc(db, 'gyms', user.uid);
      await updateDoc(gymRef, {
        name: salonFormName.trim(),
        ownerName: salonFormOwner.trim(),
        phone: salonFormPhone.trim(),
      });

      if (gym) {
        setGym({
          ...gym,
          name: salonFormName.trim(),
          ownerName: salonFormOwner.trim(),
          phone: salonFormPhone.trim(),
        });
      }

      toast('Salon information updated!', 'success');
      setIsSalonEditOpen(false);
    } catch (err) {
      console.error('Save salon error:', err);
      toast('Failed to update salon information', 'error');
    } finally {
      setIsSalonSaving(false);
    }
  };

  // ─── Billing Edit Handlers ──────────────────────────────────────────────

  const openEditModal = () => {
    if (billingSettings) {
      setFormSalonName(billingSettings.gymName || '');
      setFormSalonAddress(billingSettings.gymAddress || '');
      setFormSalonPhone(billingSettings.gymPhone || '');
      setFormGstin(billingSettings.gstin || '');
      setFormHsnCode(billingSettings.hsnCode || '');
      setFormGstRate(String(billingSettings.gstRate || 18));
      setFormInvoicePrefix(billingSettings.invoicePrefix || 'INV');
      setFormSendOnWhatsApp(billingSettings.sendInvoiceOnWhatsApp || false);
    } else {
      setFormSalonName(gym?.name || '');
      setFormSalonAddress('');
      setFormSalonPhone(gym?.phone || '');
      setFormGstin('');
      setFormHsnCode('99972');
      setFormGstRate('18');
      setFormInvoicePrefix('INV');
      setFormSendOnWhatsApp(false);
    }
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await saveBillingSettings(user.uid, {
        gymName: gym?.name || formSalonName,
        gymAddress: formSalonAddress,
        gymPhone: gym?.phone || formSalonPhone,
        gstin: formGstin || '',
        hsnCode: formHsnCode,
        gstRate: Number(formGstRate) || 18,
        invoicePrefix: formInvoicePrefix,
        sendInvoiceOnWhatsApp: formSendOnWhatsApp,
      });
      toast('Invoicing settings updated!', 'success');
      setIsEditOpen(false);
    } catch (err) {
      console.error('Save settings error:', err);
      toast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '46px',
    padding: '0 16px',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '8px',
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: isMobile ? '24px' : '28px', fontWeight: '800',
          color: 'var(--pf-text)', margin: '0 0 4px', letterSpacing: '-0.02em'
        }}>Settings</h1>
        <p style={{ fontSize: '14px', color: 'var(--pf-text-muted)', margin: 0, fontWeight: '500' }}>
          Configure your salon profile, billing, and integrations
        </p>
      </div>

      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Salon Information Section */}
        <section style={{ backgroundColor: 'var(--pf-surface)', border: '1px solid var(--pf-border)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--pf-border)', backgroundColor: 'var(--pf-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FFF1F2', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {Icons.salon}
              </div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: '800', color: 'var(--pf-text)' }}>Salon Information</span>
            </div>
            <button onClick={openSalonEditModal} className="btn-press" style={{
              padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--pf-border)', background: 'var(--pf-surface)', color: 'var(--pf-text-muted)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              {Icons.edit} Edit Salon
            </button>
          </div>

          <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: '32px' }}>
            <div>
              <div style={{ marginBottom: '20px' }}>
                <p style={{ ...labelStyle, marginBottom: '8px' }}>Salon Logo</p>
                <LogoUpload currentLogoUrl={gym?.logoUrl} onUpdate={(url) => {
                  if (gym) setGym({ ...gym, logoUrl: url || undefined });
                }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <p style={{ ...labelStyle, marginBottom: '4px' }}>Salon Name</p>
                  <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--pf-text)', margin: 0 }}>{gym?.name || '—'}</p>
                </div>
                <div>
                  <p style={{ ...labelStyle, marginBottom: '4px' }}>Owner</p>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--pf-text-secondary)', margin: 0 }}>{gym?.ownerName || '—'}</p>
                </div>
                <div>
                  <p style={{ ...labelStyle, marginBottom: '4px' }}>Phone</p>
                  <p style={{ fontSize: '14px', color: 'var(--pf-text-muted)', margin: 0, fontWeight: '600' }}>{gym?.phone || '—'}</p>
                </div>
                <div>
                  <p style={{ ...labelStyle, marginBottom: '4px' }}>Status</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFDF5', padding: '3px 10px', borderRadius: '20px', border: '1px solid #D1FAE5' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10B981' }} className="glow-dot" />
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#059669', letterSpacing: '0.04em' }}>ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ backgroundColor: 'var(--pf-surface-2)', borderRadius: '16px', padding: '20px', border: '1px solid var(--pf-border)' }}>
              <p style={{ fontSize: '13px', color: 'var(--pf-text-muted)', fontWeight: '600', lineHeight: '1.6', margin: 0 }}>
                Salon information appears on all client invoices and WhatsApp messages. Keep it accurate and up to date.
              </p>
            </div>
          </div>
        </section>

        {/* Invoicing Section */}
        <section style={{ backgroundColor: 'var(--pf-surface)', border: '1px solid var(--pf-border)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--pf-border)', backgroundColor: 'var(--pf-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {Icons.billing}
              </div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: '800', color: 'var(--pf-text)' }}>Invoicing & Billing</span>
            </div>
            <button onClick={openEditModal} className="btn-press" style={{
              padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--pf-border)', background: 'var(--pf-surface)', color: 'var(--pf-text-muted)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              {Icons.edit} Configure
            </button>
          </div>

          {!billingSettings ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧾</div>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: 'var(--pf-text)', margin: '0 0 6px' }}>Billing Not Configured</p>
              <p style={{ fontSize: '14px', color: 'var(--pf-text-muted)', maxWidth: '300px', margin: '0 auto 20px' }}>Set up your invoicing details to generate professional GST-ready receipts for clients.</p>
            </div>
          ) : (
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px' }}>
              {[
                { label: 'Salon Name', value: gym?.name || billingSettings.gymName },
                { label: 'Address', value: billingSettings.gymAddress || '—' },
                { label: 'GSTIN', value: billingSettings.gstin || 'Exempted' },
                { label: 'GST Rate', value: `${billingSettings.gstRate}%` },
                { label: 'Invoice Prefix', value: billingSettings.invoicePrefix },
                { label: 'Next Invoice #', value: `#${billingSettings.invoiceCounter}` },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ ...labelStyle, marginBottom: '4px' }}>{item.label}</p>
                  <p style={{ fontSize: '13.5px', color: 'var(--pf-text)', margin: 0, fontWeight: '700' }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Salon Edit Modal */}
      <Modal isOpen={isSalonEditOpen} onClose={() => setIsSalonEditOpen(false)} title="Edit Salon Details" subtitle="Update your salon's basic information." footer={<><GhostButton onClick={() => setIsSalonEditOpen(false)}>Cancel</GhostButton><PrimaryButton onClick={handleSalonSave} loading={isSalonSaving}>Save Changes</PrimaryButton></>} maxWidth="480px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div><label style={labelStyle}>Salon Name</label><input style={inputStyle} value={salonFormName} onChange={e => setSalonFormName(e.target.value)} placeholder="e.g. Glamour Studio & Spa" /></div>
          <div><label style={labelStyle}>Owner Name</label><input style={inputStyle} value={salonFormOwner} onChange={e => setSalonFormOwner(e.target.value)} placeholder="e.g. Priya Sharma" /></div>
          <div><label style={labelStyle}>Contact Number</label><input style={inputStyle} value={salonFormPhone} onChange={e => setSalonFormPhone(e.target.value)} placeholder="+91 9988776655" /></div>
        </div>
      </Modal>

      {/* Invoicing Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Billing Settings" subtitle="Configure GST and invoice details for client receipts." maxWidth="540px" footer={<><GhostButton onClick={() => setIsEditOpen(false)}>Cancel</GhostButton><PrimaryButton onClick={handleSave} loading={isSaving}>Save Settings</PrimaryButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div><label style={labelStyle}>Salon Address</label><textarea style={{ ...inputStyle, height: '80px', padding: '12px 16px', resize: 'none' }} value={formSalonAddress} onChange={e => setFormSalonAddress(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={labelStyle}>GSTIN / UIN</label><input style={inputStyle} value={formGstin} onChange={e => setFormGstin(e.target.value)} placeholder="22AAAAA0000A1Z5" /></div>
            <div><label style={labelStyle}>HSN/SAC Code</label><input style={inputStyle} value={formHsnCode} onChange={e => setFormHsnCode(e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={labelStyle}>GST Rate (%)</label><input type="number" style={inputStyle} value={formGstRate} onChange={e => setFormGstRate(e.target.value)} /></div>
            <div><label style={labelStyle}>Invoice Prefix</label><input style={inputStyle} value={formInvoicePrefix} onChange={e => setFormInvoicePrefix(e.target.value)} /></div>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'var(--pf-surface-2)', borderRadius: '16px', border: '1px solid var(--pf-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--pf-text)', margin: 0 }}>Send Invoice on WhatsApp</p>
              <p style={{ fontSize: '11px', color: 'var(--pf-text-muted)', margin: 0 }}>Auto-send receipt to client after payment.</p>
            </div>
            <button onClick={() => setFormSendOnWhatsApp(!formSendOnWhatsApp)} style={{ width: '48px', height: '26px', borderRadius: '20px', backgroundColor: formSendOnWhatsApp ? '#E11D48' : '#CBD5E1', border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 300ms' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#FFFFFF', position: 'absolute', top: '3px', left: formSendOnWhatsApp ? '25px' : '3px', transition: 'all 300ms', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import {
  subscribeBillingSettings,
  saveBillingSettings,
} from '@/services/billing.service';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import { toast } from '@/components/ui/Toast';
import LogoUpload from '@/components/ui/LogoUpload';
import type { BillingSettings } from '@/types';

const Icons = {
  gym: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  billing: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
};

export default function SettingsPage() {
  const { user, gym, setGym } = useAuthStore();
  const { isMobile } = useResponsive();

  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isGymEditOpen, setIsGymEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGymSaving, setIsGymSaving] = useState(false);

  // Billing form state
  const [formGymName, setFormGymName] = useState('');
  const [formGymAddress, setFormGymAddress] = useState('');
  const [formGymPhone, setFormGymPhone] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formHsnCode, setFormHsnCode] = useState('');
  const [formGstRate, setFormGstRate] = useState('18');
  const [formInvoicePrefix, setFormInvoicePrefix] = useState('INV');
  const [formSendOnWhatsApp, setFormSendOnWhatsApp] = useState(false);

  // Gym edit form state
  const [gymFormName, setGymFormName] = useState('');
  const [gymFormOwner, setGymFormOwner] = useState('');
  const [gymFormPhone, setGymFormPhone] = useState('');


  useEffect(() => {
    if (!user) return;

    const unsub = subscribeBillingSettings(
      user.uid,
      (data) => setBillingSettings(data),
      (error) => console.error('Settings error:', error)
    );

    return unsub;
  }, [user]);

  // ─── Gym Edit Handlers ──────────────────────────────────────────────────

  const openGymEditModal = () => {
    setGymFormName(gym?.name || '');
    setGymFormOwner(gym?.ownerName || '');
    setGymFormPhone(gym?.phone || '');
    setIsGymEditOpen(true);
  };

  const handleGymSave = async () => {
    if (!user) return;
    if (!gymFormName.trim()) { toast('Gym name is required', 'error'); return; }
    if (!gymFormOwner.trim()) { toast('Owner name is required', 'error'); return; }

    setIsGymSaving(true);
    try {
      const gymRef = doc(db, 'gyms', user.uid);
      await updateDoc(gymRef, {
        name: gymFormName.trim(),
        ownerName: gymFormOwner.trim(),
        phone: gymFormPhone.trim(),
      });

      if (gym) {
        setGym({
          ...gym,
          name: gymFormName.trim(),
          ownerName: gymFormOwner.trim(),
          phone: gymFormPhone.trim(),
        });
      }

      toast('Gym information updated!', 'success');
      setIsGymEditOpen(false);
    } catch (err) {
      console.error('Save gym error:', err);
      toast('Failed to update gym information', 'error');
    } finally {
      setIsGymSaving(false);
    }
  };

  // ─── Billing Edit Handlers ──────────────────────────────────────────────

  const openEditModal = () => {
    if (billingSettings) {
      setFormGymName(billingSettings.gymName || '');
      setFormGymAddress(billingSettings.gymAddress || '');
      setFormGymPhone(billingSettings.gymPhone || '');
      setFormGstin(billingSettings.gstin || '');
      setFormHsnCode(billingSettings.hsnCode || '');
      setFormGstRate(String(billingSettings.gstRate || 18));
      setFormInvoicePrefix(billingSettings.invoicePrefix || 'INV');
      setFormSendOnWhatsApp(billingSettings.sendInvoiceOnWhatsApp || false);
    } else {
      setFormGymName(gym?.name || '');
      setFormGymAddress('');
      setFormGymPhone(gym?.phone || '');
      setFormGstin('');
      setFormHsnCode('99972');
      setFormGstRate('18');
      setFormInvoicePrefix('INV');
      setFormSendOnWhatsApp(false);
    }
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await saveBillingSettings(user.uid, {
        gymName: gym?.name || formGymName,
        gymAddress: formGymAddress,
        gymPhone: gym?.phone || formGymPhone,
        gstin: formGstin || '',
        hsnCode: formHsnCode,
        gstRate: Number(formGstRate) || 18,
        invoicePrefix: formInvoicePrefix,
        sendInvoiceOnWhatsApp: formSendOnWhatsApp,
      });
      toast('Invoicing parameters updated!', 'success');
      setIsEditOpen(false);
    } catch (err) {
      console.error('Save settings error:', err);
      toast('Failed to save parameters', 'error');
    } finally {
      setIsSaving(false);
    }
  };


  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '46px',
    padding: '0 16px',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '8px',
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: isMobile ? '24px' : '28px', fontWeight: '800',
          color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em'
        }}>Global Settings</h1>
        <p style={{ fontSize: '14px', color: '#64748B', margin: 0, fontWeight: '500' }}>
          Configure infrastructure, financial parameters, and third-party integrations
        </p>
      </div>

      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Academy Information Section */}
        <section style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
           <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FFF1F2', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 {Icons.gym}
               </div>
               <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Gym Information</span>
             </div>
             <button onClick={openGymEditModal} className="btn-press" style={{
               padding: '8px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#64748B', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
             }}>
               {Icons.edit} Edit Gym
             </button>
           </div>
           
           <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: '32px' }}>
              <div>
                {/* Logo Upload */}
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ ...labelStyle, marginBottom: '8px' }}>Gym Logo</p>
                  <LogoUpload currentLogoUrl={gym?.logoUrl} onUpdate={(url) => {
                    if (gym) setGym({ ...gym, logoUrl: url || undefined });
                  }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                 <div>
                    <p style={{ ...labelStyle, marginBottom: '4px' }}>Gym Name</p>
                    <p style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>{gym?.name || '—'}</p>
                 </div>
                 <div>
                    <p style={{ ...labelStyle, marginBottom: '4px' }}>Owner</p>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#334155', margin: 0 }}>{gym?.ownerName || '—'}</p>
                 </div>
                 <div>
                    <p style={{ ...labelStyle, marginBottom: '4px' }}>Phone</p>
                    <p style={{ fontSize: '14px', color: '#475569', margin: 0, fontWeight: '600' }}>{gym?.phone || '—'}</p>
                 </div>
                 <div>
                    <p style={{ ...labelStyle, marginBottom: '4px' }}>Status</p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFDF5', padding: '3px 10px', borderRadius: '20px', border: '1px solid #D1FAE5' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10B981' }} className="glow-dot" />
                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#059669', letterSpacing: '0.04em' }}>ACTIVE</span>
                    </div>
                 </div>
              </div>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', borderRadius: '16px', padding: '20px', border: '1px solid #F1F5F9' }}>
                 <p style={{ fontSize: '13px', color: '#64748B', fontWeight: '600', lineHeight: '1.6', margin: 0 }}>
                    Gym information is used across member communications and invoices. Ensure the details are legally accurate.
                 </p>
              </div>
           </div>
        </section>

        {/* Financial Parameter Section */}
        <section style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
           <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 {Icons.billing}
               </div>
               <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Invoicing Infrastructure</span>
             </div>
             <button onClick={openEditModal} className="btn-press" style={{
               padding: '8px 16px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#64748B', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
             }}>
               {Icons.edit} Configure Ledger
             </button>
           </div>
           
           {!billingSettings ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>Ledger Not Configured</p>
                    <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '300px', margin: '0 auto 20px' }}>Setup your invoicing parameters to start generating Professional Receipt PDFs.</p>
                </div>
           ) : (
                <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px' }}>
                    {[
                        { label: 'Merchant Branding', value: gym?.name || billingSettings.gymName },
                        { label: 'Dispatch Address', value: billingSettings.gymAddress || '—' },
                        { label: 'Revenue Registry', value: billingSettings.gstin || 'EXEMPTED' },
                        { label: 'Tax Profile', value: `GST @ ${billingSettings.gstRate}%` },
                        { label: 'Invoice SKU', value: billingSettings.invoicePrefix },
                        { label: 'Next Sequence', value: `#${billingSettings.invoiceCounter}` },
                    ].map(item => (
                        <div key={item.label}>
                            <p style={{ ...labelStyle, marginBottom: '4px' }}>{item.label}</p>
                            <p style={{ fontSize: '13.5px', color: '#1E293B', margin: 0, fontWeight: '700' }}>{item.value}</p>
                        </div>
                    ))}

                </div>
           )}
        </section>


      </div>

      {/* MODALS */}
      
      {/* Academy Edit Modal */}
      <Modal isOpen={isGymEditOpen} onClose={() => setIsGymEditOpen(false)} title="Gym Details" subtitle="Basic identification details for your gym." footer={<><GhostButton onClick={() => setIsGymEditOpen(false)}>Cancel</GhostButton><PrimaryButton onClick={handleGymSave} loading={isGymSaving}>Update Details</PrimaryButton></>} maxWidth="480px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div><label style={labelStyle}>Gym Name</label><input style={inputStyle} value={gymFormName} onChange={e => setGymFormName(e.target.value)} placeholder="e.g. Iron Fitness Hub" /></div>
          <div><label style={labelStyle}>Owner Name</label><input style={inputStyle} value={gymFormOwner} onChange={e => setGymFormOwner(e.target.value)} placeholder="e.g. Vikram Singh" /></div>
          <div><label style={labelStyle}>Contact Number</label><input style={inputStyle} value={gymFormPhone} onChange={e => setGymFormPhone(e.target.value)} placeholder="+91 9988776655" /></div>
        </div>
      </Modal>

      {/* Invoicing Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Ledger Infrastructure" subtitle="Precise settings for professional tax-compliant invoicing." maxWidth="540px" footer={<><GhostButton onClick={() => setIsEditOpen(false)}>Discard</GhostButton><PrimaryButton onClick={handleSave} loading={isSaving}>Lock Parameters</PrimaryButton></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div><label style={labelStyle}>Physical Jurisdiction</label><textarea style={{ ...inputStyle, height: '80px', padding: '12px 16px', resize: 'none' }} value={formGymAddress} onChange={e => setFormGymAddress(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div><label style={labelStyle}>GSTIN / UIN</label><input style={inputStyle} value={formGstin} onChange={e => setFormGstin(e.target.value)} placeholder="22AAAAA0000A1Z5" /></div>
              <div><label style={labelStyle}>HSN/SAC Code</label><input style={inputStyle} value={formHsnCode} onChange={e => setFormHsnCode(e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div><label style={labelStyle}>GST Yield (%)</label><input type="number" style={inputStyle} value={formGstRate} onChange={e => setFormGstRate(e.target.value)} /></div>
              <div><label style={labelStyle}>Invoice SKU Series</label><input style={inputStyle} value={formInvoicePrefix} onChange={e => setFormInvoicePrefix(e.target.value)} /></div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div>
                <p style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Instant WhatsApp Dispatch</p>
                <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Deliver receipt PDFs immediately on payment capture.</p>
             </div>
             <button onClick={() => setFormSendOnWhatsApp(!formSendOnWhatsApp)} style={{ width: '48px', height: '26px', borderRadius: '20px', backgroundColor: formSendOnWhatsApp ? '#E11D48' : '#CBD5E1', border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 300ms' }}>
                 <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#FFFFFF', position: 'absolute', top: '3px', left: formSendOnWhatsApp ? '25px' : '3px', transition: 'all 300ms', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
             </button>
          </div>
        </div>
      </Modal>


    </div>
  );
}
