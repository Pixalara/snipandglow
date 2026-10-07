'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  MessageCircle, Send, Search, Check, CheckCircle2, AlertTriangle, Loader2, Users, X, LayoutGrid,
  Pause, Play, Ban, Clock, Phone, ExternalLink, Reply,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getSendableTemplates,
  getCampaignCustomers,
  createMarketingCampaign,
  nudgeCampaign,
  listMarketingCampaigns,
  pauseMarketingCampaign,
  resumeMarketingCampaign,
  cancelMarketingCampaign,
  type MarketingTemplateView,
  type CampaignCustomer,
  type CampaignView,
} from './actions';

// How many customer rows to render in the picker at once. "Select all" still
// targets the whole filtered set — this only bounds the DOM so a 1000+ list
// stays smooth. Large audiences are usually chosen via a filter + Select all.
const MAX_VISIBLE_ROWS = 500;
// How often the progress screen asks the server to send the next batch.
const POLL_MS = 1500;

type AudienceFilter = 'all' | 'male' | 'female' | 'lapsed' | 'birthday';

const FILTER_LABEL: Record<AudienceFilter, string> = {
  all: 'All customers',
  male: 'Male customers',
  female: 'Female customers',
  lapsed: 'Lapsed 60d+',
  birthday: 'Birthday this month',
};

function placeholderCount(body: string): number {
  return new Set([...body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]))).size;
}

/** Days since a customer's last visit, or Infinity when they've never visited. */
function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return Infinity;
  return (Date.now() - d) / 86_400_000;
}

const TERMINAL: CampaignView['status'][] = ['completed', 'cancelled', 'failed'];

function statusChipClass(status: CampaignView['status']): string {
  switch (status) {
    case 'sending': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'paused': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'cancelled': return 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-muted text-muted-foreground';
  }
}

function errorLabel(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'not_connected': return 'Your WhatsApp number is not connected.';
    case 'template_unavailable': return 'The template is no longer approved.';
    case 'carousel_invalid': return 'The carousel is missing images.';
    default: return code;
  }
}

/** WhatsApp-style button chips shown under a template preview. */
function TemplateButtonChips({ buttons }: { buttons: MarketingTemplateView['buttons'] }) {
  if (!buttons || buttons.length === 0) return null;
  return (
    <div className="mt-1 border-t border-slate-100 dark:border-slate-600">
      {buttons.map((b, i) => (
        <div
          key={i}
          className="flex items-center justify-center gap-1.5 border-b border-slate-100 py-1.5 text-xs font-medium text-sky-600 last:border-0 dark:border-slate-600 dark:text-sky-400"
        >
          {b.type === 'PHONE_NUMBER' ? <Phone className="size-3" /> : b.type === 'URL' ? <ExternalLink className="size-3" /> : <Reply className="size-3" />}
          {b.text}
        </div>
      ))}
    </div>
  );
}

export function CampaignComposer() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<MarketingTemplateView[]>([]);
  const [customers, setCustomers] = useState<CampaignCustomer[]>([]);
  const [recent, setRecent] = useState<CampaignView[]>([]);

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [personalize, setPersonalize] = useState<boolean[]>([]);

  const [filter, setFilter] = useState<AudienceFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [excludeOn, setExcludeOn] = useState(false);
  const [excludeDays, setExcludeDays] = useState(30);

  const [confirming, setConfirming] = useState(false);
  const [isSending, startSend] = useTransition();
  const [active, setActive] = useState<CampaignView | null>(null);
  const [error, setError] = useState('');

  const loadRecent = useCallback(async () => {
    setRecent(await listMarketingCampaigns());
  }, []);

  useEffect(() => {
    (async () => {
      const [tpls, custs, camps] = await Promise.all([
        getSendableTemplates(),
        getCampaignCustomers(),
        listMarketingCampaigns(),
      ]);
      setTemplates(tpls.filter((t) => t.status === 'APPROVED'));
      setCustomers(custs);
      setRecent(camps);
      setLoading(false);
    })();
  }, []);

  // ── Drive an active campaign forward: each tick sends the next batch and
  // refreshes progress until the campaign reaches a terminal state. ──
  const activeId = active?.id ?? null;
  const activeStatus = active?.status ?? null;
  const pollingRef = useRef(false);
  useEffect(() => {
    if (!activeId || activeStatus !== 'sending') return;
    let cancelled = false;
    const tick = async () => {
      if (pollingRef.current) return; // never overlap ticks
      pollingRef.current = true;
      try {
        const next = await nudgeCampaign(activeId);
        if (!cancelled && next) {
          setActive(next);
          if (TERMINAL.includes(next.status)) loadRecent();
        }
      } finally {
        pollingRef.current = false;
      }
    };
    const h = setInterval(tick, POLL_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(h);
    };
  }, [activeId, activeStatus, loadRecent]);

  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const varCount = template ? placeholderCount(template.bodyText) : 0;

  function selectTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    const n = t ? placeholderCount(t.bodyText) : 0;
    setTemplateId(id);
    setValues(Array.from({ length: n }, (_, i) => (t?.exampleParams[i] ?? '').trim()));
    setPersonalize(Array.from({ length: n }, (_, i) => i === 0));
    setError('');
    setConfirming(false);
  }

  const filtered = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (filter === 'male' && c.gender !== 'male') return false;
      if (filter === 'female' && c.gender !== 'female') return false;
      if (filter === 'lapsed' && daysSince(c.lastVisitAt) < 60) return false;
      if (filter === 'birthday') {
        if (!c.dateOfBirth) return false;
        const m = new Date(c.dateOfBirth + 'T12:00:00').getMonth();
        if (m !== currentMonth) return false;
      }
      if (q && !(`${c.name} ${c.phone}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [customers, filter, search]);

  const filteredIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
  const visible = useMemo(() => filtered.slice(0, MAX_VISIBLE_ROWS), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  function toggleCustomer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirming(false);
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
    setConfirming(false);
  }

  const valuesFilled = useMemo(
    () => Array.from({ length: varCount }).every((_, i) => personalize[i] || (values[i] ?? '').trim().length > 0),
    [varCount, personalize, values]
  );

  const canSend = !!template && selectedCount > 0 && valuesFilled && !isSending;

  function resetComposer() {
    setActive(null);
    setSelectedIds(new Set());
    setTemplateId(null);
    setConfirming(false);
    setError('');
  }

  function handleCreate() {
    if (!template) return;
    setError('');
    startSend(async () => {
      const res = await createMarketingCampaign({
        templateId: template.id,
        customerIds: Array.from(selectedIds),
        variableValues: values,
        personalizeIndexes: personalize.map((p, i) => (p ? i : -1)).filter((i) => i >= 0),
        audienceLabel: `${FILTER_LABEL[filter]} · ${selectedCount}`,
        excludeContactedDays: excludeOn ? excludeDays : 0,
      });
      setConfirming(false);
      if (res.ok && res.campaign) {
        setActive(res.campaign);
        loadRecent();
      } else {
        setError(res.error || 'Could not start the campaign.');
      }
    });
  }

  function preview(): string {
    if (!template) return '';
    return template.bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, d) => {
      const i = Number(d) - 1;
      if (personalize[i]) return 'Priya';
      return (values[i] ?? '').trim() || template.exampleParams[i] || `{{${d}}}`;
    });
  }

  async function doPause() { const v = await pauseMarketingCampaign(active!.id); if (v) { setActive(v); loadRecent(); } }
  async function doResume() { const v = await resumeMarketingCampaign(active!.id); if (v) { setActive(v); loadRecent(); } }
  async function doCancel() { const v = await cancelMarketingCampaign(active!.id); if (v) { setActive(v); loadRecent(); } }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Loading…
      </div>
    );
  }

  // ── Progress screen (an active / opened campaign) ──
  if (active) {
    const done = active.sent + active.failed;
    const pct = active.total > 0 ? Math.round((done / active.total) * 100) : 0;
    const terminal = TERMINAL.includes(active.status);
    const errMsg = errorLabel(active.error);
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold text-foreground">{active.templateName}</p>
              {active.audienceLabel && <p className="truncate text-xs text-muted-foreground">{active.audienceLabel}</p>}
            </div>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', statusChipClass(active.status))}>
              {active.status === 'sending' && <Loader2 className="mr-1 inline size-3 animate-spin" />}
              {active.status}
            </span>
          </div>

          <div className="mt-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all', active.status === 'failed' ? 'bg-red-500' : 'bg-emerald-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{done} of {active.total} processed ({pct}%)</p>

            {/* Live counts */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-background p-3 text-center">
                <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{active.sent}</p>
                <p className="text-[11px] text-muted-foreground">Sent</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 text-center">
                <p className="text-xl font-bold tabular-nums text-foreground">{active.pending}</p>
                <p className="text-[11px] text-muted-foreground">In queue</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 text-center">
                <p className={cn('text-xl font-bold tabular-nums', active.failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>{active.failed}</p>
                <p className="text-[11px] text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>

          {errMsg && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {errMsg}
            </div>
          )}

          {active.status === 'sending' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 animate-pulse" />
              <span>
                <span className="font-semibold">Please keep this page open until sending finishes.</span>{' '}
                Messages are sent while this screen is open. If you close the tab or navigate away, the campaign
                pauses at {active.sent} sent — reopen it from Recent campaigns to send the remaining {active.pending}.
              </span>
            </div>
          )}

          {active.status === 'completed' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>Done — {active.sent} message{active.sent !== 1 ? 's' : ''} sent{active.failed > 0 ? `, ${active.failed} failed` : ''}.</span>
            </div>
          )}

          {active.status === 'paused' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <Pause className="mt-0.5 size-4 shrink-0" />
              <span>Paused at {active.sent} sent, {active.pending} still in queue. Resume to continue.</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {active.status === 'sending' && (
              <button onClick={doPause} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
                <Pause className="size-4" /> Pause
              </button>
            )}
            {active.status === 'paused' && (
              <button onClick={doResume} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                <Play className="size-4" /> Resume
              </button>
            )}
            {!terminal && (
              <button onClick={doCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 dark:text-red-400">
                <Ban className="size-4" /> Cancel
              </button>
            )}
            <button onClick={resetComposer} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500">
              <Send className="size-4" /> New campaign
            </button>
          </div>
        </div>

        <RecentCampaigns items={recent} activeId={active.id} onOpen={(c) => { setActive(c); }} />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
          <MessageCircle className="size-6 text-muted-foreground" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-foreground">No approved templates yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Create a template in the <span className="font-medium">Marketing Templates</span> or{' '}
          <span className="font-medium">Carousel</span> tab and wait for Meta approval. Approved templates and
          carousels appear here, ready to send.
        </p>
        {recent.length > 0 && <div className="mt-6 text-left"><RecentCampaigns items={recent} onOpen={(c) => setActive(c)} /></div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Template ── */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">1 · Choose an approved template</h2>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition',
                templateId === t.id
                  ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-300 dark:bg-emerald-900/10'
                  : 'border-border bg-background hover:border-emerald-300'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs font-medium text-foreground">{t.name}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <CheckCircle2 className="size-2.5" /> Approved
                </span>
              </div>
              {t.templateType === 'carousel' && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  <LayoutGrid className="size-2.5" /> Carousel · {t.cards.length} cards
                </span>
              )}
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.bodyText}</p>
              {t.templateType === 'carousel' && t.cards.length > 0 && (
                <div className="mt-2 flex items-center gap-1">
                  {t.cards.slice(0, 4).map((c, i) =>
                    c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={c.imageUrl} alt="" className="size-9 rounded-md border border-border object-cover" />
                    ) : (
                      <div key={i} className="size-9 rounded-md border border-dashed border-border bg-muted/40" />
                    )
                  )}
                  {t.cards.length > 4 && <span className="text-[10px] text-muted-foreground">+{t.cards.length - 4}</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {template && (
        <>
          {/* ── 2. Message values ── */}
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">2 · Personalize the message</h2>
            </div>
            <div className="space-y-4 p-4">
              {varCount === 0 && (
                <p className="text-sm text-muted-foreground">This template has no variables — it sends as-is.</p>
              )}
              {Array.from({ length: varCount }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Variable {`{{${i + 1}}}`}</label>
                    <button
                      type="button"
                      onClick={() =>
                        setPersonalize((prev) => prev.map((p, idx) => (idx === i ? !p : p)))
                      }
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition',
                        personalize[i]
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {personalize[i] && <Check className="size-3" />} Use customer&apos;s name
                    </button>
                  </div>
                  <input
                    value={personalize[i] ? '' : values[i] ?? ''}
                    onChange={(e) => setValues((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                    disabled={personalize[i]}
                    placeholder={personalize[i] ? "Each customer's own name" : template.exampleParams[i] || 'Enter a value'}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                  />
                </div>
              ))}

              {/* Live preview */}
              {template.templateType === 'carousel' ? (
                <div className="space-y-2 rounded-xl bg-[#e5ddd5] p-3 dark:bg-slate-800">
                  <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100">
                    <p className="whitespace-pre-wrap">{preview()}</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {template.cards.map((c, i) => (
                      <div key={i} className="w-[170px] shrink-0 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-slate-700">
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.imageUrl} alt={`Card ${i + 1}`} className="aspect-[191/100] w-full object-cover" />
                        ) : (
                          <div className="aspect-[191/100] w-full bg-slate-100 dark:bg-slate-600" />
                        )}
                        <p className="line-clamp-3 p-2 text-[11px] text-slate-700 dark:text-slate-200">{c.bodyText}</p>
                        <div className="px-2 pb-1.5">
                          <TemplateButtonChips buttons={template.buttons} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#e5ddd5] p-3 dark:bg-slate-800">
                  <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100">
                    {template.headerImageUrl && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={template.headerImageUrl} alt="Header" className="mb-2 w-full rounded-lg object-cover" />
                      </>
                    )}
                    <p className="whitespace-pre-wrap">{preview()}</p>
                    {template.footerText && (
                      <p className="mt-1 text-[11px] text-slate-400">{template.footerText}</p>
                    )}
                    <TemplateButtonChips buttons={template.buttons} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── 3. Audience ── */}
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">3 · Choose customers</h2>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3.5" /> {selectedCount} selected
              </span>
            </div>
            <div className="space-y-3 p-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: 'all', label: 'All' },
                  { key: 'female', label: 'Female' },
                  { key: 'male', label: 'Male' },
                  { key: 'lapsed', label: 'Lapsed 60d+' },
                  { key: 'birthday', label: 'Birthday this month' },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition',
                      filter === f.key
                        ? 'border-transparent bg-emerald-600 text-white'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search + select all */}
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or number"
                    className="h-9 w-full bg-transparent text-sm text-foreground outline-none"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} aria-label="Clear">
                      <X className="size-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <button
                  onClick={toggleSelectAllFiltered}
                  disabled={filteredIds.length === 0}
                  className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {allFilteredSelected ? 'Clear' : `Select all (${filteredIds.length})`}
                </button>
              </div>

              {/* Customer list */}
              {filtered.length === 0 ? (
                <p className="rounded-lg bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
                  No customers match this filter.
                </p>
              ) : (
                <>
                  <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                    {visible.map((c) => {
                      const checked = selectedIds.has(c.id);
                      return (
                        <li key={c.id}>
                          <button
                            onClick={() => toggleCustomer(c.id)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
                          >
                            <span
                              className={cn(
                                'flex size-5 shrink-0 items-center justify-center rounded border transition',
                                checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border'
                              )}
                            >
                              {checked && <Check className="size-3.5" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{c.phone}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {filtered.length > visible.length && (
                    <p className="text-center text-[11px] text-muted-foreground">
                      Showing {visible.length} of {filtered.length}. Use <span className="font-medium">Select all</span> or search to include the rest.
                    </p>
                  )}
                </>
              )}

              {/* Skip recently messaged */}
              <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={excludeOn}
                  onChange={(e) => setExcludeOn(e.target.checked)}
                  className="size-4 accent-emerald-600"
                />
                <Clock className="size-3.5" />
                <span>Skip customers already messaged in the last</span>
                <select
                  value={excludeDays}
                  onChange={(e) => setExcludeDays(Number(e.target.value))}
                  disabled={!excludeOn}
                  className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-foreground disabled:opacity-50"
                >
                  <option value={7}>7 days</option>
                  <option value={15}>15 days</option>
                  <option value={30}>30 days</option>
                </select>
              </label>
            </div>
          </section>

          {/* ── 4. Send ── */}
          <section className="rounded-xl border border-border bg-card p-4">
            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {errorLabel(error)}
              </div>
            )}

            {!confirming ? (
              <>
                <button
                  onClick={() => setConfirming(true)}
                  disabled={!canSend}
                  className={cn(
                    'flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition',
                    canSend ? 'bg-emerald-600 hover:bg-emerald-500' : 'cursor-not-allowed bg-slate-300 dark:bg-slate-700'
                  )}
                >
                  <Send className="size-4" />
                  Review &amp; send to {selectedCount} customer{selectedCount !== 1 ? 's' : ''}
                </button>
                {!canSend && !isSending && (
                  <p className="mt-2 text-center text-[11px] text-amber-600 dark:text-amber-400">
                    {!template
                      ? 'Pick an approved template above to start.'
                      : selectedCount === 0
                        ? 'Select at least one customer below to send to.'
                        : !valuesFilled
                          ? 'Enter a value for each message variable in step 2 above.'
                          : ''}
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  This sends a WhatsApp marketing message to <span className="font-semibold">{selectedCount}</span>{' '}
                  customer{selectedCount !== 1 ? 's' : ''} from your number. WhatsApp bills each marketing message.
                  Large audiences send in the background — you can watch progress here. Continue?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={isSending}
                    className="h-11 flex-1 rounded-xl border border-border bg-background font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isSending}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {isSending ? <><Loader2 className="size-4 animate-spin" /> Starting…</> : <><Send className="size-4" /> Yes, start sending</>}
                  </button>
                </div>
              </div>
            )}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Only approved templates can be sent, from your own WhatsApp number.
            </p>
          </section>

          <RecentCampaigns items={recent} onOpen={(c) => setActive(c)} />
        </>
      )}

      {!template && recent.length > 0 && <RecentCampaigns items={recent} onOpen={(c) => setActive(c)} />}
    </div>
  );
}

// =============================================================================
// Recent campaigns — history + reopen progress.
// =============================================================================
function RecentCampaigns({ items, activeId, onOpen }: { items: CampaignView[]; activeId?: string; onOpen: (c: CampaignView) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">Recent campaigns</h2>
      </div>
      <ul className="divide-y divide-border">
        {items.map((c) => {
          const done = c.sent + c.failed;
          const pct = c.total > 0 ? Math.round((done / c.total) * 100) : 0;
          return (
            <li key={c.id}>
              <button
                onClick={() => onOpen(c)}
                disabled={c.id === activeId}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/40 disabled:opacity-60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-xs font-medium text-foreground">{c.templateName}</span>
                    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize', statusChipClass(c.status))}>
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {c.sent}/{c.total} sent{c.failed > 0 ? ` · ${c.failed} failed` : ''}{c.audienceLabel ? ` · ${c.audienceLabel}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{pct}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
