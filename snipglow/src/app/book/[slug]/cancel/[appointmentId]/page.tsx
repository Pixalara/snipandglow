import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveSalonBySlug, getAppointmentContext } from '@/lib/booking/web-booking';
import { CancelClient } from './cancel-client';

// =============================================================================
// Public Cancel Page — /book/sng009/cancel/<appointmentId>
//
// Opened from the WhatsApp "Cancel" button. Loads the customer's existing
// appointment and lets them cancel it. Works for ALL tenants (shared +
// dedicated) since the cancellation happens server-side.
// =============================================================================

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cancel your appointment',
  robots: { index: false, follow: false },
};

export default async function CancelPage({
  params,
}: {
  params: Promise<{ slug: string; appointmentId: string }>;
}) {
  const { slug, appointmentId } = await params;

  const salon = await resolveSalonBySlug(slug);
  if (!salon) notFound();

  const context = await getAppointmentContext(salon, appointmentId);

  const salonPublic = {
    name: salon.salonName,
    location: [salon.city, salon.state].filter(Boolean).join(', ') || null,
    phone: salon.phone,
    logoUrl: salon.logoUrl,
    tenantCode: salon.tenantCode,
  };

  if (!context) {
    return <ExpiredNotice salonName={salon.salonName} bookSlug={slug.toLowerCase()} />;
  }

  return (
    <CancelClient
      slug={slug.toLowerCase()}
      appointmentId={appointmentId}
      salon={salonPublic}
      context={context}
    />
  );
}

function ExpiredNotice({ salonName, bookSlug }: { salonName: string; bookSlug: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-rose-50 via-white to-violet-50 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-xl">
        <h1 className="text-lg font-bold text-slate-900">Nothing to cancel</h1>
        <p className="mt-2 text-sm text-slate-500">
          This appointment at {salonName} is no longer active — it may have already been cancelled or completed.
        </p>
        <a
          href={`/book/${bookSlug}`}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 py-3 font-semibold text-white shadow-lg shadow-fuchsia-500/30"
        >
          Book a new appointment
        </a>
      </div>
    </div>
  );
}
