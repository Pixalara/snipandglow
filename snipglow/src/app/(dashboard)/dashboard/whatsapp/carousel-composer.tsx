'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Send,
  AlertTriangle,
  PauseCircle,
  RefreshCw,
  ImagePlus,
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Pencil,
  FileText,
  Phone,
  ExternalLink,
  MessageSquare,
  Eye,
} from 'lucide-react';
import { CAROUSEL_PRESETS, type CarouselPreset } from '@/lib/whatsapp/carousel-presets';
import { extractPlaceholders } from '@/lib/whatsapp/template-management';
import type { CarouselTemplateView } from './actions';

// =============================================================================
// Carousel Template Builder (Pro)
//
// Build a WhatsApp carousel marketing template — a message bubble + 2..10 image
// cards with a shared set of buttons — preview it exactly as customers will see
// it, save it as a draft, and submit it to Meta for approval on the salon's own
// number. Cards and the whole template are created server-side; the browser
// only collects content and uploads card images to the salon's public bucket.
// =============================================================================

const CARD_BODY_MAX = 160;
const BODY_MAX = 1024;
const MIN_CARDS = 2;
const MAX_CARDS = 10;

type BtnType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

interface BtnState {
  type: BtnType;
  text: string;
  url: string;
  phoneNumber: string;
}

interface CardState {
  key: string;
  imageUrl: string;
  bodyText: string;
  uploading: boolean;
}

const BUTTON_TYPE_LABEL: Record<BtnType, string> = {
  QUICK_REPLY: 'Quick reply',
  URL: 'Visit website',
  PHONE_NUMBER: 'Call',
};

const STATUS_STYLE: Record<
  CarouselTemplateView['status'],
  { label: string; cls: string; icon: typeof Clock }
> = {
  DRAFT: { label: 'Draft', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: FileText },
  PENDING: { label: 'In review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  PAUSED: { label: 'Paused', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: PauseCircle },
  DISABLED: { label: 'Disabled', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: PauseCircle },
};

let keySeq = 0;
function newKey() {
  keySeq += 1;
  return `c${Date.now()}_${keySeq}`;
}

function previewText(body: string, examples: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => {
    const idx = Number(n) - 1;
    return examples[idx]?.trim() ? examples[idx] : `{{${n}}}`;
  });
}

export function CarouselComposer() {
  const [templates, setTemplates] = useState<CarouselTemplateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  // Editor state
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [examples, setExamples] = useState<string[]>([]);
  const [buttons, setButtons] = useState<BtnState[]>([
    { type: 'QUICK_REPLY', text: 'Book Now', url: '', phoneNumber: '' },
  ]);
  const [cards, setCards] = useState<CardState[]>([]);

  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const { getCarouselTemplates } = await import('./actions');
      setTemplates(await getCarouselTemplates());
    } catch {
      /* tolerant */
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshStatus() {
    setReconciling(true);
    try {
      const { getCarouselTemplates } = await import('./actions');
      setTemplates(await getCarouselTemplates());
    } catch {
      /* tolerant */
    } finally {
      setReconciling(false);
    }
  }

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

  function applyPreset(p: CarouselPreset) {
    setName(p.name);
    setBody(p.bodyText);
    setExamples([]);
    setButtons(
      p.buttons.map((b) => ({
        type: b.type,
        text: b.text,
        url: b.url ?? '',
        phoneNumber: b.phoneNumber ?? '',
      }))
    );
    setCards(p.cards.map((c) => ({ key: newKey(), imageUrl: '', bodyText: c.bodyText, uploading: false })));
    setError(null);
    setNotice(null);
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    setName('');
    setBody('');
    setExamples([]);
    setButtons([{ type: 'QUICK_REPLY', text: 'Book Now', url: '', phoneNumber: '' }]);
    setCards([]);
    setError(null);
    setNotice(null);
  }

  function loadDraft(t: CarouselTemplateView) {
    setName(t.name);
    setBody(t.bodyText);
    setExamples([...t.exampleParams]);
    setButtons(
      (t.buttons.length ? t.buttons : [{ type: 'QUICK_REPLY' as BtnType, text: 'Book Now', url: null, phoneNumber: null }]).map((b) => ({
        type: b.type,
        text: b.text,
        url: b.url ?? '',
        phoneNumber: b.phoneNumber ?? '',
      }))
    );
    setCards(t.cards.map((c) => ({ key: newKey(), imageUrl: c.imageUrl, bodyText: c.bodyText, uploading: false })));
    setError(null);
    setNotice(null);
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Card helpers ---------------------------------------------------------
  function addCard() {
    if (cards.length >= MAX_CARDS) return;
    setCards((prev) => [...prev, { key: newKey(), imageUrl: '', bodyText: '', uploading: false }]);
  }
  function removeCard(key: string) {
    setCards((prev) => prev.filter((c) => c.key !== key));
  }
  function moveCard(key: string, dir: -1 | 1) {
    setCards((prev) => {
      const i = prev.findIndex((c) => c.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function setCardBody(key: string, value: string) {
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, bodyText: value } : c)));
  }

  async function handleCardImage(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, uploading: true } : c)));
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { uploadMarketingTemplateImage } = await import('./actions');
      const res = await uploadMarketingTemplateImage(fd);
      if (res.ok) {
        setCards((prev) => prev.map((c) => (c.key === key ? { ...c, imageUrl: res.url, uploading: false } : c)));
      } else {
        setError(res.error);
        setCards((prev) => prev.map((c) => (c.key === key ? { ...c, uploading: false } : c)));
      }
    } catch {
      setError('Could not upload the image. Please try again.');
      setCards((prev) => prev.map((c) => (c.key === key ? { ...c, uploading: false } : c)));
    }
  }

  // --- Button helpers -------------------------------------------------------
  function addButton() {
    if (buttons.length >= 2) return;
    setButtons((prev) => [...prev, { type: 'URL', text: 'Visit website', url: '', phoneNumber: '' }]);
  }
  function removeButton(idx: number) {
    setButtons((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateButton(idx: number, patch: Partial<BtnState>) {
    setButtons((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  // --- Payload + validation -------------------------------------------------
  function buildInput() {
    return {
      name,
      bodyText: body,
      bodyExampleParams: examples,
      buttons: buttons.map((b) => ({
        type: b.type,
        text: b.text,
        url: b.type === 'URL' ? b.url : null,
        phoneNumber: b.type === 'PHONE_NUMBER' ? b.phoneNumber : null,
      })),
      cards: cards.map((c) => ({ imageUrl: c.imageUrl, bodyText: c.bodyText })),
    };
  }

  const anyUploading = cards.some((c) => c.uploading);

  const validity = useMemo(() => {
    if (!name.trim()) return 'Give the carousel a name.';
    if (!body.trim()) return 'Write the message bubble shown above the cards.';
    if (body.length > BODY_MAX) return `The message bubble must be ${BODY_MAX} characters or fewer.`;
    for (let i = 0; i < placeholderCount; i++) {
      if (!(examples[i] ?? '').trim()) return `Add an example value for {{${i + 1}}}.`;
    }
    if (buttons.length < 1) return 'Add at least one button.';
    for (const b of buttons) {
      if (!b.text.trim()) return 'Every button needs a label.';
      if (b.type === 'URL' && !b.url.trim()) return 'Add a website link for the "Visit website" button.';
      if (b.type === 'PHONE_NUMBER' && !b.phoneNumber.trim()) return 'Add a phone number for the "Call" button.';
    }
    if (cards.length < MIN_CARDS) return `Add at least ${MIN_CARDS} cards.`;
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].imageUrl) return `Add an image to card ${i + 1}.`;
      if (!cards[i].bodyText.trim()) return `Add some text to card ${i + 1}.`;
      if (cards[i].bodyText.length > CARD_BODY_MAX) return `Card ${i + 1} text is too long (max ${CARD_BODY_MAX}).`;
    }
    return null;
  }, [name, body, examples, placeholderCount, buttons, cards]);

  const canSubmit = !validity && !submitting && !anyUploading;
  const canSaveDraft = name.trim().length > 0 && !savingDraft;

  async function handleSaveDraft() {
    if (!canSaveDraft) return;
    setSavingDraft(true);
    setError(null);
    setNotice(null);
    try {
      const { saveCarouselDraft } = await import('./actions');
      const res = await saveCarouselDraft(buildInput());
      if (res.ok) {
        setNotice('Draft saved. You can keep editing it and submit when you are ready.');
        await refresh();
      } else {
        setError(mapReason(res.reason));
      }
    } catch {
      setError('Could not save the draft. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit() {
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const { submitCarouselTemplate } = await import('./actions');
      const res = await submitCarouselTemplate(buildInput());
      if (res.ok) {
        setNotice('Sent to WhatsApp for approval. Its status will update here once Meta reviews it (usually within a day).');
        resetForm();
        await refresh();
      } else {
        setError(mapReason(res.reason));
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDuplicate(id: string) {
    setBusyRowId(id);
    try {
      const { duplicateCarouselTemplate } = await import('./actions');
      const res = await duplicateCarouselTemplate(id);
      if (res.ok) {
        setNotice('Duplicated as a new draft. Swap the images and text, then submit.');
        await refresh();
      } else {
        setError(mapReason(res.reason));
      }
    } finally {
      setBusyRowId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyRowId(id);
    try {
      const { deleteCarouselTemplate } = await import('./actions');
      const res = await deleteCarouselTemplate(id);
      if (res.ok) await refresh();
      else setError(mapReason(res.reason));
    } finally {
      setBusyRowId(null);
    }
  }

  function mapReason(reason: string): string {
    switch (reason) {
      case 'not_connected':
        return 'Connect your own WhatsApp number first (a Pro feature). Carousels are created on your account, so a connected number is required.';
      case 'not_pro':
        return 'Carousel templates are available on the Pro plan.';
      case 'not_owner':
      case 'not_authenticated':
      case 'not_authorized':
        return 'Only the salon owner can create carousels.';
      default:
        return reason;
    }
  }

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-2">
          <LayoutGrid className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Build a swipeable carousel of offers — a message with 2 to 10 image cards, each with its own
            offer and a button. Start from a festival, add your own images, preview it, then send it to
            WhatsApp (Meta) for approval. Approved carousels can be broadcast to your customers.
          </p>
        </div>
      </div>

      {/* Festival presets */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Start from a festival</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CAROUSEL_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p)}
              className="text-left rounded-xl border border-border bg-card p-3 hover:border-emerald-300 hover:shadow-sm transition-all"
            >
              <div className="text-xl mb-1" aria-hidden>{p.emoji}</div>
              <p className="text-sm font-semibold text-foreground">{p.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div ref={editorRef} className="rounded-2xl border border-border bg-card p-5 space-y-5">
        {/* Name */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Carousel name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. navratri_special_offers"
            className="mt-1 w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Lowercase letters, numbers and underscores only. We tidy it automatically.</p>
        </div>

        {/* Message bubble */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Message bubble (shown above the cards)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={BODY_MAX}
            placeholder="e.g. Navratri Special Offers! Glow up this festive season..."
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Use {'{{1}}'}, {'{{2}}'} for details filled in per customer (like name). {body.length}/{BODY_MAX}
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
                  placeholder="Example value"
                  className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            ))}
          </div>
        )}

        {/* Buttons (shared across all cards) */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Buttons</p>
              <p className="text-[11px] text-muted-foreground">The same buttons appear on every card (WhatsApp requires this).</p>
            </div>
            {buttons.length < 2 && (
              <button type="button" onClick={addButton} className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                <Plus className="size-3.5" /> Add button
              </button>
            )}
          </div>
          {buttons.map((b, i) => (
            <div key={i} className="rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={b.type}
                  onChange={(e) => updateButton(i, { type: e.target.value as BtnType })}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="QUICK_REPLY">Quick reply</option>
                  <option value="URL">Visit website</option>
                  <option value="PHONE_NUMBER">Call</option>
                </select>
                <input
                  value={b.text}
                  onChange={(e) => updateButton(i, { text: e.target.value })}
                  maxLength={25}
                  placeholder="Button label (e.g. Book Now)"
                  className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {buttons.length > 1 && (
                  <button type="button" onClick={() => removeButton(i)} className="text-muted-foreground hover:text-red-600">
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {b.type === 'URL' && (
                <input
                  value={b.url}
                  onChange={(e) => updateButton(i, { url: e.target.value })}
                  placeholder="https://your-booking-link.com"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              )}
              {b.type === 'PHONE_NUMBER' && (
                <input
                  value={b.phoneNumber}
                  onChange={(e) => updateButton(i, { phoneNumber: e.target.value })}
                  placeholder="+91 94590 86057"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              )}
            </div>
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Offer cards ({cards.length}/{MAX_CARDS})</p>
              <p className="text-[11px] text-muted-foreground">2 to 10 cards. Square images (1:1, e.g. 1080×1080) look best.</p>
            </div>
            <button
              type="button"
              onClick={addCard}
              disabled={cards.length >= MAX_CARDS}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Plus className="size-3.5" /> Add card
            </button>
          </div>

          {cards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center">
              <p className="text-sm text-muted-foreground">No cards yet. Pick a festival above or add a card to start.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cards.map((c, i) => (
                <div key={c.key} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start gap-3">
                    {/* image */}
                    <div className="shrink-0">
                      {c.imageUrl ? (
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.imageUrl} alt={`Card ${i + 1}`} className="size-24 rounded-lg border border-border object-cover" />
                          <button
                            type="button"
                            onClick={() => setCards((prev) => prev.map((x) => (x.key === c.key ? { ...x, imageUrl: '' } : x)))}
                            className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-border text-muted-foreground hover:text-red-600 shadow"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 text-[11px] text-muted-foreground hover:border-emerald-400 hover:text-foreground">
                          {c.uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                          {c.uploading ? 'Uploading' : 'Add image'}
                          <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => handleCardImage(c.key, e)} disabled={c.uploading} />
                        </label>
                      )}
                    </div>
                    {/* body + controls */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">Card {i + 1}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => moveCard(c.key, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                          <button type="button" onClick={() => moveCard(c.key, 1)} disabled={i === cards.length - 1} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                          <button type="button" onClick={() => removeCard(c.key)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"><Trash2 className="size-3.5" /></button>
                        </div>
                      </div>
                      <textarea
                        value={c.bodyText}
                        onChange={(e) => setCardBody(c.key, e.target.value)}
                        rows={3}
                        maxLength={CARD_BODY_MAX}
                        placeholder="Describe this offer (e.g. Navratri Hair Care Package at ₹2,500/-)"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                      <p className="text-[11px] text-muted-foreground mt-0.5">{c.bodyText.length}/{CARD_BODY_MAX}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live preview */}
        {(body.trim() || cards.length > 0) && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Eye className="size-3.5" /> Live preview</p>
            <CarouselPreview body={previewText(body, examples)} cards={cards} buttons={buttons} />
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

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              if (validity) { setError(validity); return; }
              setError(null);
              setConfirmOpen(true);
            }}
            disabled={!canSubmit}
            className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitting ? 'Submitting...' : 'Preview & submit'}
          </Button>
          <Button variant="outline" className="rounded-xl gap-1.5" onClick={handleSaveDraft} disabled={!canSaveDraft}>
            {savingDraft ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Save draft
          </Button>
          {(name || body || cards.length > 0) && (
            <Button variant="ghost" className="rounded-xl" onClick={resetForm} disabled={submitting || savingDraft}>
              Clear
            </Button>
          )}
          {anyUploading && <span className="text-xs text-muted-foreground">Waiting for image uploads…</span>}
        </div>
      </div>

      {/* Saved carousels */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Your carousels</h3>
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
          <div className="flex items-center justify-center py-10"><Loader2 className="size-5 animate-spin text-emerald-500" /></div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No carousels yet. Build one above to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => {
              const badge = STATUS_STYLE[t.status];
              const BadgeIcon = badge.icon;
              const rowBusy = busyRowId === t.id;
              return (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground font-mono truncate">{t.name}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${badge.cls}`}>
                      <BadgeIcon className="size-3" />{badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-line line-clamp-2">{t.bodyText}</p>
                  {t.cards.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {t.cards.slice(0, 5).map((c, i) => (
                        c.imageUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img key={i} src={c.imageUrl} alt="" className="size-10 rounded-md border border-border object-cover" />
                          : <div key={i} className="size-10 rounded-md border border-dashed border-border bg-muted/40" />
                      ))}
                      {t.cards.length > 5 && <span className="text-[11px] text-muted-foreground">+{t.cards.length - 5}</span>}
                    </div>
                  )}
                  {t.status === 'REJECTED' && t.rejectionReason && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-2">Reason: {t.rejectionReason.replace(/_/g, ' ').toLowerCase()}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(t.status === 'DRAFT' || t.status === 'REJECTED') && (
                      <button type="button" onClick={() => loadDraft(t)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted">
                        <Pencil className="size-3.5" /> Edit
                      </button>
                    )}
                    <button type="button" onClick={() => handleDuplicate(t.id)} disabled={rowBusy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50">
                      {rowBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />} Duplicate
                    </button>
                    {(t.status === 'DRAFT' || t.status === 'REJECTED') && (
                      <button type="button" onClick={() => handleDelete(t.id)} disabled={rowBusy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-red-600 disabled:opacity-50">
                        <Trash2 className="size-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm-before-submit preview modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Ready to send for approval?</h2>
                <p className="text-[11px] text-muted-foreground">This is exactly what WhatsApp will review.</p>
              </div>
              <button onClick={() => setConfirmOpen(false)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                <span className="text-lg">×</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <CarouselPreview body={previewText(body, examples)} cards={cards} buttons={buttons} />
              <p className="mt-3 text-[11px] text-muted-foreground">
                Approval usually takes a few minutes to a day. You can send this carousel to customers once it is approved.
              </p>
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-4 bg-muted/20 shrink-0">
              <Button variant="outline" className="rounded-xl flex-1" onClick={() => setConfirmOpen(false)}>Back</Button>
              <Button className="rounded-xl flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmit}>
                <Send className="size-4" /> Submit to WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// WhatsApp-style carousel preview
// =============================================================================

function CarouselPreview({
  body,
  cards,
  buttons,
}: {
  body: string;
  cards: CardState[];
  buttons: BtnState[];
}) {
  return (
    <div className="rounded-xl bg-[#e5ddd5] dark:bg-slate-800 p-4">
      {/* message bubble */}
      {body.trim() && (
        <div className="bg-white dark:bg-slate-700 rounded-xl rounded-tl-sm p-3 max-w-[320px] shadow-sm mb-3">
          <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">{body}</p>
          <p className="text-[10px] text-slate-400 text-right mt-1.5">10:00 AM ✓✓</p>
        </div>
      )}
      {/* cards */}
      {cards.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {cards.map((c, i) => (
            <div key={c.key} className="w-[180px] shrink-0 overflow-hidden rounded-xl bg-white dark:bg-slate-700 shadow-sm">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt={`Card ${i + 1}`} className="h-[180px] w-full object-cover" />
              ) : (
                <div className="flex h-[180px] w-full items-center justify-center bg-slate-100 dark:bg-slate-600 text-[11px] text-slate-400">
                  <ImagePlus className="size-5" />
                </div>
              )}
              <div className="p-2.5">
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-snug line-clamp-3 min-h-[48px]">
                  {c.bodyText.trim() || 'Offer text…'}
                </p>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-600">
                {buttons.map((b, bi) => (
                  <div key={bi} className={cn('flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium text-sky-600 dark:text-sky-400', bi > 0 && 'border-t border-slate-100 dark:border-slate-600')}>
                    {b.type === 'PHONE_NUMBER' ? <Phone className="size-3.5" /> : b.type === 'URL' ? <ExternalLink className="size-3.5" /> : <MessageSquare className="size-3.5" />}
                    {b.text.trim() || BUTTON_TYPE_LABEL[b.type]}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
