import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { BookingLandingClient } from './booking-landing-client';

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
    .select('id, name, tenant_code')
    .eq('tenant_code', formattedCode)
    .single() as any);

  if (!tenant) notFound();

  // Get the booking slug from tenant_whatsapp_settings
  const { data: settings } = await (admin
    .from('tenant_whatsapp_settings' as any)
    .select('booking_slug')
    .eq('tenant_id', tenant.id)
    .single() as any);

  const bookingSlug = settings?.booking_slug || slug;

  return (
    <BookingLandingClient
      salonName={tenant.name}
      tenantCode={tenant.tenant_code}
      bookingSlug={bookingSlug}
    />
  );
}
