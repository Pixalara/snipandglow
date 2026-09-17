// =============================================================================
// Web booking core (public, unauthenticated).
//
// Powers the salon-branded /book/[slug] page for ALL tenants (shared + dedicated).
// Modeled on processBooking (src/app/api/whatsapp/flow/route.ts) — the existing
// unauthenticated, admin-client booking creator — but resolves credentials with
// getCredentialsForTenant so a Pro tenant's confirmation goes from THEIR number.
//
// SECURITY: this runs with the service-role admin client (no user session), so
// every query is explicitly scoped by tenant_id/branch_id, and the tenant is
// resolved from the URL slug — never trusted from the client.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getCredentialsForTenant } from '@/lib/whatsapp/tenant-router';
import { sendMessage } from '@/lib/whatsapp/templates';
import { notifyOwnerNewBooking } from '@/lib/whatsapp/notify-owner';
import { createNotification } from '@/lib/notifications';

export interface SalonContext {
  tenantId: string;
  branchId: string;
  tenantCode: string;
  salonName: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  settings: Record<string, unknown>;
  operatingHours: Record<string, { open?: string; close?: string } | null>;
}

export interface WebService {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  category: string;
}

export interface WebOption {
  id: string;
  title: string;
}

// ── Small time/phone helpers (IST-aware; mirror time-slots.ts + processBooking) ──

function toMinutes(t: string): number {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function istNow(): { date: string; minutes: number } {
  const istStr = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false });
  const [date, time] = istStr.split(', ');
  const [h, m] = (time || '00:00:00').split(':').map(Number);
  return { date, minutes: (h || 0) * 60 + (m || 0) };
}

function dayNameOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00+05:30');
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getUTCDay()];
}

function label12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Absolute URL of the public booking page for a tenant, e.g.
 * "SNG-009" → "https://www.snipandglow.com/book/sng009". Honors
 * NEXT_PUBLIC_APP_URL when set (mirrors the hardcoded base in google-calendar.ts).
 */
export function webBookingUrl(tenantCode: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.snipandglow.com').replace(/\/+$/, '');
  const slug = (tenantCode || '').replace(/-/g, '').toLowerCase();
  return `${base}/book/${slug}`;
}

/**
 * Normalise an Indian mobile to +91XXXXXXXXXX (the format the rest of the app
 * stores in customers.phone). Returns null when it isn't a valid 10-digit
 * Indian mobile, so callers can show a clean validation error.
 */
export function toIndiaE164(raw: string): string | null {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  return null;
}

// ── Slug → salon resolution ───────────────────────────────────────────────

/**
 * Resolve a salon from a booking slug (e.g. "sng009" → tenant_code "SNG-009").
 * Returns the tenant + default branch context, or null when not found.
 */
export async function resolveSalonBySlug(slug: string): Promise<SalonContext | null> {
  const clean = (slug || '').trim().toLowerCase();
  if (!clean) return null;

  const admin = createAdminClient();
  const formattedCode = clean.toUpperCase().replace(/^(SNG)(\d+)$/, '$1-$2');

  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('id, name, tenant_code, phone, settings')
    .eq('tenant_code', formattedCode)
    .single() as any);
  if (!tenant) return null;

  // Prefer the default branch; fall back to the first branch.
  let { data: branch } = await (admin
    .from('branches')
    .select('id, address, operating_hours')
    .eq('tenant_id', tenant.id)
    .eq('is_default', true)
    .maybeSingle() as any);
  if (!branch) {
    const { data: anyBranch } = await (admin
      .from('branches')
      .select('id, address, operating_hours')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle() as any);
    branch = anyBranch;
  }
  if (!branch) return null;

  const settings = (tenant.settings as Record<string, unknown>) ?? {};

  return {
    tenantId: tenant.id,
    branchId: branch.id,
    tenantCode: tenant.tenant_code ?? '',
    salonName: (tenant.name ?? '').trim(),
    address: branch.address ?? null,
    phone: tenant.phone ?? null,
    logoUrl: (settings.logo_url as string) ?? null,
    settings,
    operatingHours: (branch.operating_hours as Record<string, { open?: string; close?: string } | null>) ?? {},
  };
}

// ── Services ────────────────────────────────────────────────────────────────

export async function getServicesForSalon(tenantId: string, branchId: string): Promise<WebService[]> {
  const admin = createAdminClient();
  const { data } = await (admin
    .from('services')
    .select('id, name, price, duration_minutes, category, branch_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true }) as any);

  return ((data ?? []) as any[])
    // Tenant-wide services (branch_id null) or those for this branch.
    .filter((s) => !s.branch_id || s.branch_id === branchId)
    .map((s) => ({
      id: s.id,
      name: s.name,
      price: Number(s.price) || 0,
      durationMinutes: Number(s.duration_minutes) || 30,
      category: (s.category as string) || 'Other',
    }));
}

// ── Availability (per selected date) ─────────────────────────────────────────

/**
 * Available time slots for a specific date, honoring the branch's operating
 * hours for that weekday, blocked dates/slots, per-slot capacity, and (for
 * today) a 1-hour lead-time buffer in IST.
 */
export async function getAvailableSlotsForDate(
  salon: SalonContext,
  date: string
): Promise<WebOption[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const settings = salon.settings as any;
  const blockedDates: string[] = settings.blocked_dates || [];
  if (blockedDates.includes(date)) return [];

  const dn = dayNameOf(date);
  const dayHours = salon.operatingHours[dn] || salon.operatingHours[dn.slice(0, 3)] || null;
  if (!dayHours?.open || !dayHours?.close) return [];

  const slotDuration: number = Number(settings.slot_duration_minutes) || 30;
  const maxPerSlot: number = Number(settings.max_appointments_per_slot) || 1;
  const blockedSlots: Array<{ date: string; slots: string[] }> = settings.blocked_slots || [];
  const blockedForDate = new Set(blockedSlots.find((b) => b.date === date)?.slots || []);

  const admin = createAdminClient();
  const { data: apptRows } = await (admin
    .from('appointments')
    .select('start_time, end_time')
    .eq('tenant_id', salon.tenantId)
    .eq('appointment_date', date)
    .in('status', ['booked', 'confirmed']) as any);
  const booked = (apptRows ?? []) as Array<{ start_time: string; end_time: string }>;

  const now = istNow();
  const isToday = date === now.date;
  const openMin = toMinutes(dayHours.open);
  const closeMin = toMinutes(dayHours.close);

  const slots: WebOption[] = [];
  for (let min = openMin; min < closeMin; min += slotDuration) {
    const hh = Math.floor(min / 60);
    const mm = min % 60;
    const hhmm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

    if (isToday && min <= now.minutes + 60) continue; // 1h lead-time buffer
    if (blockedForDate.has(hhmm)) continue;

    const slotEnd = min + slotDuration;
    const overlap = booked.filter((a) => {
      const s = toMinutes(a.start_time);
      const e = toMinutes(a.end_time);
      return min < e && slotEnd > s;
    }).length;
    if (overlap >= maxPerSlot) continue;

    slots.push({ id: `${hhmm}:00`, title: label12h(hhmm) });
  }
  return slots;
}

// ── Create a booking ─────────────────────────────────────────────────────────

export interface CreateWebBookingInput {
  salon: SalonContext;
  serviceIds: string[];
  customerName: string;
  phone: string;
  date: string;
  time: string; // "HH:MM:00"
}

export interface CreateWebBookingResult {
  ok: boolean;
  error?: string;
  /** Human-friendly confirmation summary for the success screen. */
  summary?: { services: string; dateTime: string };
}

/**
 * Create an appointment from the public web form. Mirrors processBooking's
 * validation + insert, then fires a best-effort WhatsApp confirmation (from the
 * tenant's own number when dedicated), an owner alert, and the dashboard bell.
 */
export async function createWebBooking(input: CreateWebBookingInput): Promise<CreateWebBookingResult> {
  const { salon, serviceIds, date, time } = input;
  const customerName = (input.customerName || '').trim();

  if (!Array.isArray(serviceIds) || serviceIds.length === 0) return { ok: false, error: 'Please select at least one service.' };
  if (!customerName || customerName.length < 2) return { ok: false, error: 'Please enter your name.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) return { ok: false, error: 'Please choose a date and time.' };

  const phoneE164 = toIndiaE164(input.phone);
  if (!phoneE164) return { ok: false, error: 'Please enter a valid 10-digit mobile number.' };

  const admin = createAdminClient();
  const { tenantId, branchId, salonName } = salon;

  const [servicesRes, apptsRes, customerRes] = await Promise.all([
    admin.from('services').select('id, name').in('id', serviceIds).eq('tenant_id', tenantId).eq('is_active', true),
    (admin.from('appointments').select('start_time, end_time, customer_id').eq('tenant_id', tenantId).eq('appointment_date', date).in('status', ['booked', 'confirmed']) as any),
    (admin.from('customers').select('id').eq('phone', phoneE164).eq('tenant_id', tenantId).maybeSingle() as any),
  ]);

  const services = (servicesRes.data ?? []) as Array<{ id: string; name: string }>;
  if (services.length === 0) return { ok: false, error: 'The selected service is no longer available.' };

  const settings = salon.settings as any;
  const slotDuration: number = Number(settings.slot_duration_minutes) || 30;
  const maxPerSlot: number = Number(settings.max_appointments_per_slot) || 1;
  const startMin = toMinutes(time);
  const endMin = startMin + slotDuration;
  const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00`;

  // ── Re-validate availability at write time (never trust the client) ──
  if ((settings.blocked_dates || []).includes(date)) return { ok: false, error: 'That date is not available. Please choose another.' };
  const blockedForDate = (settings.blocked_slots || []).find((b: any) => b.date === date);
  if (blockedForDate?.slots?.includes(time.substring(0, 5))) return { ok: false, error: 'That time is not available. Please choose another slot.' };

  const now = istNow();
  if (date === now.date && startMin <= now.minutes + 60) {
    return { ok: false, error: 'That time has already passed. Please pick a later slot.' };
  }

  const appts = (apptsRes.data ?? []) as Array<{ start_time: string; end_time: string; customer_id: string }>;
  const overlap = appts.filter((a) => startMin < toMinutes(a.end_time) && endMin > toMinutes(a.start_time)).length;
  if (overlap >= maxPerSlot) return { ok: false, error: 'That slot just filled up. Please choose another time.' };

  // ── Resolve or create the customer ──
  let customerId: string | null = customerRes.data?.id ?? null;
  if (!customerId) {
    const { data: newCust } = await (admin
      .from('customers')
      .insert({ tenant_id: tenantId, branch_id: branchId, name: customerName, phone: phoneE164 } as any)
      .select('id')
      .single() as any);
    customerId = newCust?.id ?? null;
  }
  if (!customerId) return { ok: false, error: 'Could not create your booking. Please try again.' };

  // Per-customer guards for this day.
  const custAppts = appts.filter((a) => a.customer_id === customerId);
  if (custAppts.length >= 3) return { ok: false, error: 'You already have 3 bookings on this day. Please choose another date.' };
  if (custAppts.some((a) => startMin < toMinutes(a.end_time) && endMin > toMinutes(a.start_time))) {
    return { ok: false, error: 'You already have an appointment at this time.' };
  }

  // First active employee, else the customer id as a harmless placeholder (mirrors processBooking).
  const { data: emp } = await (admin.from('employees').select('id').eq('tenant_id', tenantId).eq('is_active', true).limit(1).maybeSingle() as any);
  const employeeId = emp?.id ?? customerId;

  const { error: apptError } = await (admin.from('appointments').insert({
    tenant_id: tenantId,
    branch_id: branchId,
    customer_id: customerId,
    service_id: serviceIds[0],
    employee_id: employeeId,
    appointment_date: date,
    start_time: time,
    end_time: endTime,
    status: 'booked',
    source: 'web_booking',
    whatsapp_flow_ref: JSON.stringify(serviceIds),
  } as any).select('id').single() as any);

  if (apptError) {
    console.error('[WebBooking] appointment insert error:', apptError);
    return { ok: false, error: 'That slot is no longer available. Please choose another time.' };
  }

  const serviceNames = services.map((s) => s.name).join(', ');
  const dateLabel = new Date(date + 'T12:00:00+05:30').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
  const dateTimeFormatted = `${dateLabel}, ${label12h(time.substring(0, 5))}`;

  // ── Best-effort notifications (never block/fail the booking) ──
  try {
    const credentials = await getCredentialsForTenant(tenantId);
    if (credentials) {
      const phoneDigits = phoneE164.replace(/\D/g, '');
      const calendarToken = Buffer.from(
        [`${serviceNames} at ${salonName || 'Salon'}`, date, time, endTime, salonName || ''].join('|')
      ).toString('base64url');

      await Promise.allSettled([
        sendMessage(credentials, phoneDigits, {
          type: 'template',
          template: {
            name: 'booking_confirmation_v2',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: customerName },
                  { type: 'text', text: serviceNames },
                  { type: 'text', text: dateTimeFormatted },
                  { type: 'text', text: salonName || 'Your Salon' },
                ],
              },
              { type: 'button', sub_type: 'url', index: '2', parameters: [{ type: 'text', text: calendarToken }] },
            ],
          },
        }),
        notifyOwnerNewBooking(admin, credentials, tenantId, salonName || 'Your Salon', customerName, phoneDigits, serviceNames, dateTimeFormatted),
        createNotification(
          tenantId,
          'new_booking',
          'New Booking',
          `${customerName} booked ${serviceNames} on ${dateTimeFormatted}`,
          { customer_name: customerName, customer_phone: phoneDigits }
        ),
      ]);
    }
  } catch (err) {
    console.error('[WebBooking] notification error (non-fatal):', err);
  }

  return { ok: true, summary: { services: serviceNames, dateTime: dateTimeFormatted } };
}
