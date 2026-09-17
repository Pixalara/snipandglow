'use server';

// =============================================================================
// Public booking server actions for /book/[slug].
//
// These are the only server entry points the client component calls. Each one
// RE-RESOLVES the salon from the URL slug (never trusts a tenantId from the
// client) and delegates to the admin-client booking core.
// =============================================================================

import {
  resolveSalonBySlug,
  getAvailableSlotsForDate,
  createWebBooking,
  createWebReschedule,
  createWebCancellation,
  type WebOption,
  type CreateWebBookingResult,
} from '@/lib/booking/web-booking';

/** Available time slots for a given date at this salon. */
export async function getSlotsForDate(slug: string, date: string): Promise<WebOption[]> {
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return [];
  return getAvailableSlotsForDate(salon, date);
}

export interface SubmitBookingInput {
  serviceIds: string[];
  customerName: string;
  phone: string;
  date: string;
  time: string;
  gender?: string;
  dateOfBirth?: string;
}

/** Create the appointment (validates + persists + best-effort confirmation). */
export async function submitBooking(
  slug: string,
  input: SubmitBookingInput
): Promise<CreateWebBookingResult> {
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return { ok: false, error: 'This salon booking link is no longer active.' };

  return createWebBooking({
    salon,
    serviceIds: input.serviceIds,
    customerName: input.customerName,
    phone: input.phone,
    date: input.date,
    time: input.time,
    gender: input.gender,
    dateOfBirth: input.dateOfBirth,
  });
}

/** Move an existing appointment to a new date/time. */
export async function submitReschedule(
  slug: string,
  appointmentId: string,
  input: { date: string; time: string }
): Promise<CreateWebBookingResult> {
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return { ok: false, error: 'This salon booking link is no longer active.' };

  return createWebReschedule({
    salon,
    appointmentId,
    date: input.date,
    time: input.time,
  });
}

/** Cancel an existing appointment. */
export async function submitCancellation(
  slug: string,
  appointmentId: string
): Promise<CreateWebBookingResult> {
  const salon = await resolveSalonBySlug(slug);
  if (!salon) return { ok: false, error: 'This salon booking link is no longer active.' };

  return createWebCancellation({ salon, appointmentId });
}
