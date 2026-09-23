'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  MessageCircle, Send, Search, Check, CheckCircle2, AlertTriangle, Loader2, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getMarketingTemplates,
  getCampaignCustomers,
  sendMarketingCampaign,
  type MarketingTemplateView,
  type CampaignCustomer,
  type SendCampaignResult,
} from './actions';

const MAX_RECIPIENTS = 200;

type AudienceFilter = 'all' | 'male' | 'female' | 'lapsed' | 'birthday';

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

export function CampaignComposer() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<MarketingTemplateView[]>([]);
  const [customers, setCustomers] = useState<CampaignCustomer[]>([]);

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [personalize, setPersonalize] = useState<boolean[]>([]);

  const [filter, setFilter] = useState<AudienceFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [confirming, setConfirming] = useState(false);
  const [isSending, startSend] = useTransition();
  const [result, setResult] = useState<SendCampaignResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [tpls, custs] = await Promise.all([getMarketingTemplates(), getCampaignCustomers()]);
      setTemplates(tpls.filter((t) => t.status === 'APPROVED'));
      setCustomers(custs);
      setLoading(false);
    })();
  }, []);

  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  const varCount = template ? placeholderCount(template.bodyText) : 0;

  function selectTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    const n = t ? placeholderCount(t.bodyText) : 0;
    setTemplateId(id);
    // Pre-fill each variable with the approved template's example value (Meta
    // requires one example per variable). This means a fixed value like the
    // salon name is ready to send without retyping, so the send button is not
    // silently blocked on an empty field. The value stays editable and is shown
    // in the live preview; personalized variables ignore it in favour of the
    // customer's own name.
    setValues(Array.from({ length: n }, (_, i) => (t?.exampleParams[i] ?? '').trim()));
    // Personalize the first variable with the customer's name by default —
    // most templates open with "Hi {{1}}".
    setPersonalize(Array.from({ length: n }, (_, i) => i === 0));
    setResult(null);
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

  const overLimit = selectedCount > MAX_RECIPIENTS;
  const canSend = !!template && selectedCount > 0 && !overLimit && valuesFilled && !isSending;

  function handleSend() {
    if (!template) return;
    setError('');
    startSend(async () => {
      const res = await sendMarketingCampaign({
        templateId: template.id,
        customerIds: Array.from(selectedIds),
        variableValues: values,
        personalizeIndexes: personalize.map((p, i) => (p ? i : -1)).filter((i) => i >= 0),
      });
      setResult(res);
      setConfirming(false);
      if (!res.ok && res.sent === 0) setError(res.error || 'Could not send the campaign.');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Loading…
      </div>
    );
  }

  // ── Success screen ──
  if (result && result.sent > 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-foreground">Campaign sent</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Delivered to {result.sent} customer{result.sent !== 1 ? 's' : ''}
          {result.failed > 0 && ` · ${result.failed} failed`}.
        </p>
        <button
          onClick={() => {
            setResult(null);
            setSelectedIds(new Set());
            setTemplateId(null);
          }}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          New campaign
        </button>
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
          Create a marketing template in the <span className="font-medium">Marketing Templates</span> tab and wait for
          Meta approval. Approved templates appear here, ready to send.
        </p>
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
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.bodyText}</p>
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
              <div className="rounded-xl bg-[#e5ddd5] p-3 dark:bg-slate-800">
                <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100">
                  <p className="whitespace-pre-wrap">{preview()}</p>
                  {template.footerText && (
                    <p className="mt-1 text-[11px] text-slate-400">{template.footerText}</p>
                  )}
                </div>
              </div>
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
                <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                  {filtered.map((c) => {
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
              )}
            </div>
          </section>

          {/* ── 4. Send ── */}
          <section className="rounded-xl border border-border bg-card p-4">
            {overLimit && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                You&apos;ve selected {selectedCount}. Please send to at most {MAX_RECIPIENTS} customers per campaign — deselect some.
              </div>
            )}
            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
              </div>
            )}
            {result && result.failed > 0 && result.sent > 0 && (
              <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Sent {result.sent}, {result.failed} failed.
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
                {/* Explain why the button is disabled — otherwise it just greys
                    out with no reason and the sender is stuck. */}
                {!canSend && !isSending && (
                  <p className="mt-2 text-center text-[11px] text-amber-600 dark:text-amber-400">
                    {!template
                      ? 'Pick an approved template above to start.'
                      : selectedCount === 0
                        ? 'Select at least one customer below to send to.'
                        : overLimit
                          ? `Select at most ${MAX_RECIPIENTS} customers per campaign.`
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
                  customer{selectedCount !== 1 ? 's' : ''} from your number. WhatsApp bills each marketing message. Continue?
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
                    onClick={handleSend}
                    disabled={isSending}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {isSending ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : <><Send className="size-4" /> Yes, send now</>}
                  </button>
                </div>
              </div>
            )}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Only approved templates can be sent, from your own WhatsApp number.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
