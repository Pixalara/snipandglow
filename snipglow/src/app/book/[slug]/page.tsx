import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveSalonBySlug, getServicesForSalon } from '@/lib/booking/web-booking';
import { generateSmartSlots } from '@/lib/time-slots';
import { BookingClient } from './booking-client';

// =============================================================================
// Public Web Booking Page — /book/sng009
//
// Salon-branded, mobile-first booking experience that works for ALL tenants
// (shared + dedicated WhatsApp), since it creates the appointment server-side
// rather than relying on a WABA-scoped WhatsApp Flow.
// =============================================================================

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const salon = await resolveSalonBySlug(slug);
  const name = salon?.salonName || 'Book an Appointment';
  return {
    title: `Book at ${name}`,
    description: `Book your appointment at ${name} online in seconds.`,
    robots: { index: false, follow: false },
  };
}

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const [services, slots] = await Promise.all([
    getServicesForSalon(salon.tenantId, salon.branchId),
    generateSmartSlots(salon.tenantId, salon.branchId),
  ]);

  return (
    <BookingClient
      slug={slug.toLowerCase()}
      salon={{
        name: salon.salonName,
        address: salon.address,
        phone: salon.phone,
        logoUrl: salon.logoUrl,
        tenantCode: salon.tenantCode,
      }}
      services={services}
      dates={slots.dates}
    />
  );
}
