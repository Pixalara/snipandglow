import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { BookingLandingClient } from './booking-landing-client';
import { planIncludesDedicatedWhatsApp } from '@/lib/subscription';
import { PLATFORM_WA_NUMBER } from '@/lib/whatsapp/config';

// =============================================================================
// Public Booking Landing Page — /book/SNG001
// Shown when customer scans QR code. Sets session cookie then opens WhatsApp.
// =============================================================================

export default async function BookingLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.toLowerCase();
  const admin = createAdminClient();

  // Look up tenant by tenant_code (e.g., SNG001 → SNG-001)
  const formattedCode = slug.toUpperCase().replace(/^(SNG)(\d+)$/, '$1-$2');

  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('id, name, tenant_code, plan_tier')
    .eq('tenant_code', formattedCode)
    .single() as any);

  if (!tenant) notFound();

  // Get the booking slug + dedicated-number fields from tenant_whatsapp_settings
  const { data: settings } = await (admin
    .from('tenant_whatsapp_settings' as any)
    .select('booking_slug, mode, onboarding_status, display_phone_number')
    .eq('tenant_id', tenant.id)
    .single() as any);

  const bookingSlug = settings?.booking_slug || slug;

  // Point customers at the salon's OWN number when they're a connected Pro/Growth
  // tenant; otherwise the shared Snip and Glow number.
  const dedicatedDigits = (settings?.display_phone_number ?? '').replace(/\D/g, '');
  const whatsappNumber =
    planIncludesDedicatedWhatsApp(tenant.plan_tier) &&
    settings?.mode === 'dedicated' &&
    settings?.onboarding_status === 'connected' &&
    dedicatedDigits
      ? dedicatedDigits
      : PLATFORM_WA_NUMBER;

  return (
    <BookingLandingClient
      salonName={tenant.name}
      tenantCode={tenant.tenant_code}
      bookingSlug={bookingSlug}
      whatsappNumber={whatsappNumber}
    />
  );
}
