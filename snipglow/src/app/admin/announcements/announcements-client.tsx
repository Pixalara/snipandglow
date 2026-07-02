'use client';

import { useMemo, useState, useTransition } from 'react';
import { Mail, Send, Search, CheckCircle2, AlertTriangle, Loader2, Plus, Trash2, RotateCcw, Eye, ExternalLink, X } from 'lucide-react';
import { sendAnnouncement, type Recipient } from './actions';
import {
  renderAnnouncementEmail,
  DEFAULT_CAMPAIGN,
  type AnnouncementCampaign,
} from '@/lib/email/announcement';

// =============================================================================
// Admin Announcements — editable campaign + live preview + tenant selection.
// =============================================================================

export function AnnouncementsClient({
  configured,
  missingEnv = [],
  recipients,
}: {
  configured: boolean;
  missingEnv?: string[];
  recipients: Recipient[];
}) {
  // ── Campaign content (editable) ────────────────────────────────────────────
  const [campaign, setCampaign] = useState<AnnouncementCampaign>({ ...DEFAULT_CAMPAIGN, bullets: DEFAULT_CAMPAIGN.bullets.map((b) => ({ ...b })) });
  function setField<K extends keyof AnnouncementCampaign>(key: K, value: AnnouncementCampaign[K]) {
    setCampaign((prev) => ({ ...prev, [key]: value }));
  }
  function setBullet(i: number, field: 'title' | 'body', value: string) {
    setCampaign((prev) => ({ ...prev, bullets: prev.bullets.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)) }));
  }
  function addBullet() {
    setCampaign((prev) => ({ ...prev, bullets: [...prev.bullets, { title: '', body: '' }] }));
  }
  function removeBullet(i: number) {
    setCampaign((prev) => ({ ...prev, bullets: prev.bullets.filter((_, idx) => idx !== i) }));
  }
  function resetToWallet() {
    setCampaign({ ...DEFAULT_CAMPAIGN, bullets: DEFAULT_CAMPAIGN.bullets.map((b) => ({ ...b })) });
  }

  // ── Selection / UI state ────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [testEmail, setTestEmail] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const previewHtml = useMemo(
    () => renderAnnouncementEmail(campaign, { salonName: 'Your Salon' }).html,
    [campaign]
  );

  function openInNewTab() {
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    // Revoke shortly after so the new tab has time to load.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => r.salonName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [recipients, query]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.tenantId));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((r) => next.delete(r.tenantId));
      else filtered.forEach((r) => next.add(r.tenantId));
      return next;
    });
  }

  function handleTest() {
    setResult(null);
    startTransition(async () => {
      const res = await sendAnnouncement({ testEmail, campaign });
      setResult({ ok: res.success, msg: res.success ? `Test email sent to ${testEmail}.` : res.error || 'Failed to send test.' });
    });
  }
  function handleSend() {
    setConfirmOpen(false);
    setResult(null);
    const ids = [...selected];
    startTransition(async () => {
      const res = await sendAnnouncement({ tenantIds: ids, campaign });
      setResult({
        ok: res.success,
        msg: res.success ? `Sent to ${res.sent} recipient(s).` : `${res.error ?? 'Some emails failed.'} Sent ${res.sent}, failed ${res.failed}.`,
      });
      if (res.sent > 0) setSelected(new Set());
    });
  }

  const inputCls = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  const labelCls = 'text-xs font-medium text-muted-foreground';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="size-6 text-fuchsia-500" /> Announcements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Compose a feature email and send it to the tenants you choose.</p>
        </div>
        <button type="button" onClick={resetToWallet} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
          <RotateCcw className="size-3.5" /> Wallet preset
        </button>
      </div>

      {!configured && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-900/15 p-3">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Email is not configured. {missingEnv.length > 0 ? `Missing in this deployment: ${missingEnv.join(', ')}.` : 'Set SMTP_EMAIL and SMTP_PASSWORD.'} Add them for the <strong>Production</strong> environment in Vercel, then redeploy.
          </p>
        </div>
      )}

      {/* Editor + live preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Editor */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Campaign content</p>
          <div>
            <label className={labelCls}>Subject</label>
            <input className={inputCls} value={campaign.subject} onChange={(e) => setField('subject', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Eyebrow tag (small, above headline)</label>
            <input className={inputCls} value={campaign.eyebrow} onChange={(e) => setField('eyebrow', e.target.value)} placeholder="New feature · ..." />
          </div>
          <div>
            <label className={labelCls}>Headline</label>
            <input className={inputCls} value={campaign.headline} onChange={(e) => setField('headline', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Greeting <span className="text-muted-foreground/70">({'{salon}'} = salon name)</span></label>
            <input className={inputCls} value={campaign.greeting} onChange={(e) => setField('greeting', e.target.value)} placeholder="Hi {salon}," />
          </div>
          <div>
            <label className={labelCls}>Intro (shown right after the greeting)</label>
            <textarea className={inputCls} rows={3} value={campaign.intro} onChange={(e) => setField('intro', e.target.value)} />
          </div>

          {/* Bullets */}
          <div>
            <div className="flex items-center justify-between">
              <label className={labelCls}>Feature points</label>
              <button type="button" onClick={addBullet} className="inline-flex items-center gap-1 text-xs font-medium text-fuchsia-600 hover:text-fuchsia-700">
                <Plus className="size-3.5" /> Add
              </button>
            </div>
            <div className="space-y-2 mt-1.5">
              {campaign.bullets.map((b, i) => (
                <div key={i} className="rounded-xl border border-border p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input className={`${inputCls} py-1.5`} value={b.title} placeholder="Point title" onChange={(e) => setBullet(i, 'title', e.target.value)} />
                    <button type="button" onClick={() => removeBullet(i)} className="shrink-0 text-muted-foreground hover:text-red-600" aria-label="Remove point">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <input className={`${inputCls} py-1.5`} value={b.body} placeholder="Short description" onChange={(e) => setBullet(i, 'body', e.target.value)} />
                </div>
              ))}
              {campaign.bullets.length === 0 && <p className="text-xs text-muted-foreground">No points. Add one, or leave empty to skip.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Button label</label>
              <input className={inputCls} value={campaign.ctaLabel} onChange={(e) => setField('ctaLabel', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Button link (URL)</label>
              <input className={inputCls} value={campaign.ctaUrl} onChange={(e) => setField('ctaUrl', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Small note under button (optional)</label>
            <input className={inputCls} value={campaign.footerNote ?? ''} onChange={(e) => setField('footerNote', e.target.value)} />
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Live preview</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                <Eye className="size-3.5" /> Full view
              </button>
              <button type="button" onClick={openInNewTab} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                <ExternalLink className="size-3.5" /> New tab
              </button>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden border border-border bg-[#f1f5f9]">
            <iframe title="Email preview" srcDoc={previewHtml} className="w-full h-[560px] bg-white" />
          </div>
          {/* Test send */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Send a test to you@example.com"
              className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={!configured || isPending || !testEmail.trim()}
              className="h-10 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send test
            </button>
          </div>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className={`flex items-start gap-2 rounded-xl border p-3 ${result.ok ? 'border-emerald-300/60 bg-emerald-50 dark:bg-emerald-900/15' : 'border-red-300/60 bg-red-50 dark:bg-red-900/15'}`}>
          {result.ok ? <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />}
          <p className={`text-sm ${result.ok ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>{result.msg}</p>
        </div>
      )}

      {/* Recipients */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search salon or email…"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="text-sm text-muted-foreground">{selected.size} selected · {recipients.length} mailable</div>
        </div>

        <div className="max-h-[52vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 w-10">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="Select all" className="size-4 accent-fuchsia-600" />
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Salon</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Email</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Plan</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.tenantId} className="hover:bg-accent/40 transition-colors cursor-pointer" onClick={() => toggle(r.tenantId)}>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.tenantId)} onChange={() => toggle(r.tenantId)} aria-label={`Select ${r.salonName}`} className="size-4 accent-fuchsia-600" />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.salonName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.email}</td>
                  <td className="px-4 py-2.5 text-foreground/80">{r.plan ?? '—'}</td>
                  <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/80">{r.status ?? '—'}</span></td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.source === 'account' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'}`}>
                      {r.source === 'account' ? 'Account' : 'Contact'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No mailable tenants found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send bar */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={!configured || isPending || selected.size === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 hover:from-fuchsia-700 hover:to-violet-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send to {selected.size} tenant{selected.size !== 1 ? 's' : ''}
        </button>
      </div>

      {/* Full-screen email preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewOpen(false)} />
          <div className="relative z-10 flex h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-fuchsia-500" />
                <p className="text-sm font-semibold text-foreground">Email preview</p>
                <span className="text-xs text-muted-foreground truncate max-w-[280px]">{campaign.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={openInNewTab} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                  <ExternalLink className="size-3.5" /> New tab
                </button>
                <button type="button" onClick={() => setPreviewOpen(false)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close preview">
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-[#f1f5f9]">
              <iframe title="Full email preview" srcDoc={previewHtml} className="w-full h-full min-h-[600px] bg-white" />
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/20">
                <Mail className="size-5 text-fuchsia-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Send announcement?</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              This will email “<span className="font-medium text-foreground">{campaign.subject}</span>” to <span className="font-semibold text-foreground">{selected.size}</span> selected tenant{selected.size !== 1 ? 's' : ''}. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
              <button onClick={handleSend} className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700">Yes, send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
