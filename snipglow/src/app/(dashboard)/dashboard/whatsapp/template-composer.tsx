'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Megaphone,
  Cake,
  PartyPopper,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Send,
  AlertTriangle,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';
import { MARKETING_TEMPLATE_PRESETS, type MarketingTemplatePreset } from '@/lib/whatsapp/template-presets';
import { extractPlaceholders } from '@/lib/whatsapp/template-management';
import type { MarketingTemplateView } from './actions';

// =============================================================================
// Marketing Template Composer (Pro)
//
// Lets a Pro owner author a WhatsApp marketing template — from a curated preset
// or free text — and submit it to Meta on their OWN WABA. Templates are created
// server-side (the browser never sees the token); this component only collects
// content, shows a live preview, and lists submitted templates with their Meta
// approval status. Sending broadcasts with an approved template is a separate,
// later step.
// =============================================================================

const PRESET_ICONS: Record<string, typeof Cake> = {
  birthday_offer: Cake,
  anniversary_offer: PartyPopper,
  festival_offer: Sparkles,
};

const STATUS_STYLE: Record<
  MarketingTemplateView['status'],
  { label: string; cls: string; icon: typeof Clock }
> = {
  PENDING: { label: 'In review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  PAUSED: { label: 'Paused', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: PauseCircle },
  DISABLED: { label: 'Disabled', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: PauseCircle },
};

function previewText(body: string, examples: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => {
    const idx = Number(n) - 1;
    return examples[idx]?.trim() ? examples[idx] : `{{${n}}}`;
  });
}

export function TemplateComposer() {
  const [templates, setTemplates] = useState<MarketingTemplateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [examples, setExamples] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const { getMarketingTemplates } = await import('./actions');
      setTemplates(await getMarketingTemplates());
    } catch {
      /* tolerant: leave list as-is */
    } finally {
      setLoading(false);
    }
  }

  // Pull the live approval statuses from Meta and refresh the local mirror — so
  // a template isn't stuck at "In review" if a status webhook was missed.
  async function handleRefreshStatus() {
    setReconciling(true);
    try {
      const { reconcileMarketingTemplates } = await import('./actions');
      setTemplates(await reconcileMarketingTemplates());
    } catch {
      /* tolerant */
    } finally {
      setReconciling(false);
    }
  }

  // Number of positional placeholders in the body drives how many example
  // inputs we show (Meta needs one sample per placeholder to approve).
  const placeholderCount = useMemo(() => {
    const idxs = extractPlaceholders(body);
    return idxs.length ? Math.max(...idxs) : 0;
  }, [body]);

  useEffect(() => {
    setExamples((prev) => {
      const next = prev.slice(0, placeholderCount);
      while (next.length < placeholderCount) next.push('');
      return next;
    });
  }, [placeholderCount]);

  function applyPreset(p: MarketingTemplatePreset) {
    setName(p.definition.name);
    setBody(p.definition.bodyText);
    setFooter(p.definition.footerText ?? '');
    setExamples([...p.definition.exampleParams]);
    setLabels(p.variableLabels);
    setError(null);
    setNotice(null);
  }

  function resetForm() {
    setName('');
    setBody('');
    setFooter('');
    setExamples([]);
    setLabels([]);
  }

  const canSubmit = name.trim().length > 0 && body.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const { submitMarketingTemplate } = await import('./actions');
      const res = await submitMarketingTemplate({
        name,
        bodyText: body,
        exampleParams: examples,
        footerText: footer.trim() || null,
      });
      if (res.ok) {
        setNotice('Sent to WhatsApp for approval. Its status will update here once Meta reviews it (usually within a day).');
        resetForm();
        await refresh();
      } else if (res.reason === 'not_connected') {
        setError('Connect your own WhatsApp number first (this is a Pro feature). Templates are created on your account, so a connected number is required.');
      } else if (res.reason === 'not_pro') {
        setError('Marketing templates are available on the Pro plan.');
      } else if (res.reason === 'not_owner' || res.reason === 'not_authenticated') {
        setError('Only the salon owner can create templates.');
      } else {
        setError(res.reason);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-2">
          <Megaphone className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Create WhatsApp marketing templates on your own number. Start from a preset or write your
            own, then send it for Meta approval. Approved templates can be used to message your customers.
          </p>
        </div>
      </div>

      {/* Presets */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Start from a preset</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MARKETING_TEMPLATE_PRESETS.map((p) => {
            const Icon = PRESET_ICONS[p.key] ?? Sparkles;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-left rounded-xl border border-border bg-card p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 mb-2">
                  <Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">{p.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Composer form */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Template name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. birthday_offer"
            className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Lowercase letters, numbers and underscores only. We tidy it automatically.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Message body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder={'Hi {{1}}! Happy Birthday from {{2}}...'}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Use {'{{1}}'}, {'{{2}}'} for details filled in per customer (like name or discount).
          </p>
        </div>

        {placeholderCount > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Example values (for approval)</label>
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 w-10 shrink-0">{`{{${i + 1}}}`}</span>
                <input
                  value={examples[i] ?? ''}
                  onChange={(e) =>
                    setExamples((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                  placeholder={labels[i] ? `e.g. ${labels[i]}` : 'Example value'}
                  className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-muted-foreground">Footer (optional)</label>
          <input
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            placeholder="Reply STOP to unsubscribe."
            className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        {/* Live preview */}
        {body.trim() && (
          <div className="rounded-xl bg-[#e5ddd5] dark:bg-slate-800 p-4">
            <div className="bg-white dark:bg-slate-700 rounded-xl rounded-tl-sm p-3 max-w-[320px] shadow-sm">
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {previewText(body, examples)}
              </p>
              {footer.trim() && (
                <p className="text-[11px] text-slate-400 mt-2 whitespace-pre-line">{footer}</p>
              )}
              <p className="text-[10px] text-slate-400 text-right mt-2">10:00 AM ✓✓</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/30 dark:bg-red-900/10 px-3 py-2">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        {notice && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800/30 dark:bg-emerald-900/10 px-3 py-2">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">{notice}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitting ? 'Submitting...' : 'Submit for approval'}
          </Button>
          {(name || body || footer) && (
            <Button variant="outline" className="rounded-xl" onClick={resetForm} disabled={submitting}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Submitted templates */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Your templates</h3>
          {templates.length > 0 && (
            <button
              type="button"
              onClick={handleRefreshStatus}
              disabled={reconciling}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${reconciling ? 'animate-spin' : ''}`} /> Refresh status
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-emerald-500" />
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No templates yet. Create one above to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => {
              const badge = STATUS_STYLE[t.status];
              const BadgeIcon = badge.icon;
              return (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground font-mono truncate">{t.name}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${badge.cls}`}>
                      <BadgeIcon className="size-3" />
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-line line-clamp-3">{t.bodyText}</p>
                  {t.status === 'REJECTED' && t.rejectionReason && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-2">
                      Reason: {t.rejectionReason.replace(/_/g, ' ').toLowerCase()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
