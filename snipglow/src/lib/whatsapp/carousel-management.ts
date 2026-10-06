// =============================================================================
// WhatsApp CAROUSEL message-template management.
//
// A carousel template = one message-bubble BODY + a CAROUSEL component holding
// 2..10 cards. Every card has an IMAGE header, a short body, and an identical
// set of buttons (Meta requires the header format and button types to match
// across all cards). We enforce "identical buttons" by construction: the shared
// button set is applied to every card.
//
// Native Graph API create shape (POST {waba-id}/message_templates):
//   components: [
//     { type:'BODY', text, example?:{ body_text:[[...]] } },
//     { type:'CAROUSEL', cards: [
//        { components: [
//            { type:'HEADER', format:'IMAGE', example:{ header_handle:[<handle>] } },
//            { type:'BODY', text },
//            { type:'BUTTONS', buttons:[...] },
//        ] }, ...
//     ] },
//   ]
//
// The card IMAGE header example uses a resumable-upload media *handle* (same
// mechanism as a single IMAGE-header template) — one handle per card.
// =============================================================================

import { WA_BASE_URL, type WhatsAppCredentials } from './config';
import {
  normalizeTemplateName,
  extractPlaceholders,
  mapMetaTemplateStatus,
  type CreateTemplateResult,
} from './template-management';

// WhatsApp carousel limits.
export const CAROUSEL_MIN_CARDS = 2;
export const CAROUSEL_MAX_CARDS = 10;
export const CAROUSEL_CARD_BODY_MAX = 160;
export const CAROUSEL_BODY_MAX = 1024;
export const CAROUSEL_MAX_BUTTONS = 2;

export type CarouselButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

export interface CarouselButtonDef {
  type: CarouselButtonType;
  text: string;
  /** Required for URL buttons (static — no per-card variable). */
  url?: string;
  /** Required for PHONE_NUMBER buttons (E.164, e.g. +919459086057). */
  phoneNumber?: string;
}

export interface CarouselCardDef {
  /** Resumable-upload media handle for this card's IMAGE header (create time). */
  headerImageHandle: string;
  bodyText: string;
}

export interface CarouselTemplateDefinition {
  name: string;
  language?: string;
  category?: 'MARKETING';
  /** Message bubble shown above the cards. May carry {{1}}.. placeholders. */
  bodyText: string;
  /** One example value per bubble placeholder (Meta rejects blanks). */
  bodyExampleParams?: string[];
  /** Shared buttons applied to EVERY card (1..2). */
  buttons: CarouselButtonDef[];
  cards: CarouselCardDef[];
}

// =============================================================================
// Pure helpers (unit-testable, no network)
// =============================================================================

/** A button signature = ordered list of its types, used to assert all cards match. */
export function buttonSignature(buttons: CarouselButtonDef[]): string {
  return buttons.map((b) => b.type).join('|');
}

/** Validate a carousel definition the way Meta will, with friendly messages. */
export function validateCarouselDefinition(
  def: CarouselTemplateDefinition
): { ok: true } | { ok: false; error: string } {
  if (!def.name || !def.name.trim()) return { ok: false, error: 'Give the carousel a name.' };

  const body = (def.bodyText || '').trim();
  if (!body) return { ok: false, error: 'The message bubble text cannot be empty.' };
  if (body.length > CAROUSEL_BODY_MAX) {
    return { ok: false, error: `The message bubble must be ${CAROUSEL_BODY_MAX} characters or fewer.` };
  }

  // Bubble placeholders must be 1..N with one non-blank example each.
  const placeholders = extractPlaceholders(def.bodyText);
  const highest = placeholders.length ? Math.max(...placeholders) : 0;
  const distinct = new Set(placeholders);
  for (let i = 1; i <= highest; i++) {
    if (!distinct.has(i)) {
      return { ok: false, error: `Message bubble placeholder {{${i}}} is missing — numbering must run 1..${highest}.` };
    }
  }
  const examples = def.bodyExampleParams ?? [];
  if (examples.length !== highest) {
    return {
      ok: false,
      error: `The message bubble uses ${highest} placeholder(s) but ${examples.length} example value(s) were given.`,
    };
  }
  if (examples.some((e) => !e || !e.trim())) {
    return { ok: false, error: 'Every message-bubble placeholder needs a non-empty example value.' };
  }

  // Buttons: 1..2, well-formed, and shared across all cards.
  const buttons = def.buttons ?? [];
  if (buttons.length < 1) return { ok: false, error: 'Add at least one button (e.g. Book Now).' };
  if (buttons.length > CAROUSEL_MAX_BUTTONS) {
    return { ok: false, error: `A card can have at most ${CAROUSEL_MAX_BUTTONS} buttons.` };
  }
  for (const b of buttons) {
    if (!b.text || !b.text.trim()) return { ok: false, error: 'Every button needs a label.' };
    if (b.type === 'URL' && !(b.url || '').trim()) {
      return { ok: false, error: 'Add a website link for the "Visit website" button.' };
    }
    if (b.type === 'PHONE_NUMBER' && !(b.phoneNumber || '').trim()) {
      return { ok: false, error: 'Add a phone number for the "Call" button.' };
    }
  }

  // Cards: 2..10, each with an image handle and a body within the card limit.
  const cards = def.cards ?? [];
  if (cards.length < CAROUSEL_MIN_CARDS) {
    return { ok: false, error: `Add at least ${CAROUSEL_MIN_CARDS} cards.` };
  }
  if (cards.length > CAROUSEL_MAX_CARDS) {
    return { ok: false, error: `A carousel can have at most ${CAROUSEL_MAX_CARDS} cards.` };
  }
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (!c.headerImageHandle || !c.headerImageHandle.trim()) {
      return { ok: false, error: `Card ${i + 1} needs an image.` };
    }
    const cb = (c.bodyText || '').trim();
    if (!cb) return { ok: false, error: `Card ${i + 1} needs some text.` };
    if (cb.length > CAROUSEL_CARD_BODY_MAX) {
      return { ok: false, error: `Card ${i + 1} text must be ${CAROUSEL_CARD_BODY_MAX} characters or fewer.` };
    }
  }

  return { ok: true };
}

interface CreateButton {
  type: CarouselButtonType;
  text: string;
  url?: string;
  phone_number?: string;
}

function toCreateButton(b: CarouselButtonDef): CreateButton {
  const btn: CreateButton = { type: b.type, text: b.text.trim() };
  if (b.type === 'URL') btn.url = (b.url || '').trim();
  if (b.type === 'PHONE_NUMBER') btn.phone_number = (b.phoneNumber || '').trim();
  return btn;
}

/** Build the exact native Graph API create body for a carousel template (PURE). */
export function buildCarouselCreatePayload(def: CarouselTemplateDefinition): Record<string, unknown> {
  const sharedButtons = (def.buttons ?? []).map(toCreateButton);

  const topBody: Record<string, unknown> = { type: 'BODY', text: def.bodyText };
  if (def.bodyExampleParams && def.bodyExampleParams.length > 0) {
    topBody.example = { body_text: [def.bodyExampleParams] };
  }

  const cards = (def.cards ?? []).map((card) => ({
    components: [
      { type: 'HEADER', format: 'IMAGE', example: { header_handle: [card.headerImageHandle] } },
      { type: 'BODY', text: card.bodyText.trim() },
      { type: 'BUTTONS', buttons: sharedButtons },
    ],
  }));

  return {
    name: normalizeTemplateName(def.name),
    category: def.category ?? 'MARKETING',
    language: def.language ?? 'en',
    components: [topBody, { type: 'CAROUSEL', cards }],
  };
}

// =============================================================================
// Network — create a carousel template on the tenant's own WABA.
// =============================================================================

/**
 * POST a carousel create payload to the tenant's WABA. Mirrors postTemplate in
 * template-management.ts but takes the loose carousel payload shape (which has a
 * CAROUSEL component the standard typed payload does not model).
 */
export async function createCarouselTemplate(
  credentials: WhatsAppCredentials,
  def: CarouselTemplateDefinition
): Promise<CreateTemplateResult> {
  const validation = validateCarouselDefinition(def);
  if (!validation.ok) return { ok: false, error: validation.error };

  const payload = buildCarouselCreatePayload(def);

  try {
    const res = await fetch(`${WA_BASE_URL}/${credentials.businessAccountId}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        data?.error?.error_user_msg || data?.error?.message || `Meta API error (${res.status})`;
      console.error('[WA Carousel] create failed:', msg);
      return { ok: false, error: msg };
    }

    return {
      ok: true,
      metaTemplateId: data?.id != null ? String(data.id) : undefined,
      status: mapMetaTemplateStatus(data?.status),
    };
  } catch (err) {
    console.error('[WA Carousel] create network error:', err);
    return { ok: false, error: 'Could not reach WhatsApp. Please try again.' };
  }
}
