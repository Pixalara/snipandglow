import type { Metadata } from 'next';
import Link from 'next/link';
import { SeoPageLayout } from '../seo-page-layout';

export const metadata: Metadata = {
  title: 'Salon Staff Scheduling Software for Appointments and Reminders',
  description:
    'Manage salon staff availability, appointments, services and WhatsApp reminders with Snip and Glow\'s beauty business CRM.',
  alternates: {
    canonical: 'https://snipandglow.com/salon-staff-scheduling',
  },
  openGraph: {
    title: 'Salon Staff Scheduling Software for Appointments and Reminders',
    description:
      'Manage salon staff availability, appointments, services and WhatsApp reminders with Snip and Glow\'s beauty business CRM.',
    url: 'https://snipandglow.com/salon-staff-scheduling',
    type: 'article',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does salon staff scheduling software work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Salon staff scheduling software lets you assign each staff member a set of services and working hours. When a customer books online or via WhatsApp, the system automatically shows only the available slots for the relevant staff member.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can different stylists have different working hours in Snip and Glow?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Each staff member in Snip and Glow has their own schedule with individual working days, hours, and break times. Bookings are automatically matched to available staff.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can customers choose a specific stylist when booking via WhatsApp?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The WhatsApp booking flow in Snip and Glow shows customers available staff members for their selected service. They can choose a preferred stylist or let the system assign the next available one.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Snip and Glow handle staff payroll?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Snip and Glow includes staff payroll tracking with salary structures, commission on services, bonus management, and deductions. Reports can be generated per staff member for any time period.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can staff members view their own appointment schedule?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Snip and Glow has role-based access. Stylists log in and see their own appointment calendar for the day. Managers can view all staff schedules and reassign appointments if needed.',
      },
    },
  ],
};

export default function SalonStaffSchedulingPage() {
  return (
    <SeoPageLayout currentPath="/salon-staff-scheduling">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-p:leading-relaxed prose-li:leading-relaxed">

        <h1>Salon Staff Scheduling Software for Appointments and Reminders</h1>
        <p className="text-sm text-slate-500 not-prose">
          Manage staff, availability and automated WhatsApp reminders · Snip and Glow
        </p>

        <p>
          Running a salon with multiple staff members means juggling different schedules, services,
          and availability windows all at once. When done manually, double bookings happen,
          customers end up with the wrong stylist, and staff time goes to waste. Smart scheduling
          software removes that chaos.
        </p>

        <p>
          <a href="https://snipandglow.com" className="text-emerald-600 hover:underline">Snip and Glow</a> handles
          salon staff scheduling as part of a complete WhatsApp-first CRM. Every booking, reminder,
          and rescheduling request flows through one system - automatically.
        </p>

        <h2>The Cost of Poor Staff Scheduling</h2>

        <p>
          Without proper scheduling tools, salon owners deal with the same problems every week: a
          stylist's slot is double-booked, a customer shows up but their preferred technician is
          off, or a walk-in gets turned away because no one checked availability properly. Each
          of these costs a customer relationship and revenue.
        </p>

        <p>
          The fix is a scheduling system where each staff member's availability is visible in real
          time and bookings - whether made by staff at the front desk or by customers via WhatsApp -
          always reflect accurate slot availability.
        </p>

        <h2>How Staff Scheduling Works in Snip and Glow</h2>

        <ul>
          <li><strong>Individual Schedules:</strong> Each staff member has their own working hours, days, and break times. No overlap, no guesswork.</li>
          <li><strong>Service Assignment:</strong> Each stylist is assigned the services they offer. Customers only see staff who can actually do the requested treatment.</li>
          <li><strong>Automatic Availability:</strong> When a booking comes in - via WhatsApp, QR code, or the front desk - the system checks staff availability and blocks the slot instantly.</li>
          <li><strong>Staff Selection in WhatsApp:</strong> During the WhatsApp booking flow, customers can select a preferred stylist or let the system assign the next available one.</li>
          <li><strong>Role-Based Access:</strong> Stylists see their own calendar. Managers see all staff. Owners control everything.</li>
        </ul>

        <h2>WhatsApp Reminders Tied to Staff Schedules</h2>

        <p>
          Every appointment in Snip and Glow is connected to a specific staff member's schedule.
          When a reminder goes out automatically 24 hours before the appointment, it includes the
          correct stylist name and time - so customers know exactly who they're coming to see and
          when.
        </p>

        <p>
          If a staff member needs to call in sick or change their hours, the manager can reassign
          affected appointments and the system handles the customer notification via WhatsApp.
        </p>

        <h2>Staff Payroll and Performance Tracking</h2>

        <p>
          Scheduling is only part of staff management. Snip and Glow also covers:
        </p>

        <ul>
          <li><strong>Payroll:</strong> Set salary structures, commission percentages on services, and manage bonuses and deductions.</li>
          <li><strong>Performance Reports:</strong> See which staff members are generating the most appointments and revenue in any period.</li>
          <li><strong>Service Attribution:</strong> Every invoice is linked to the staff member who delivered the service, making commission calculation automatic.</li>
          <li><strong>Activity Audit:</strong> A full audit trail of who created, modified, or cancelled which bookings - important for multi-staff salons.</li>
        </ul>

        <h2>Example Staff Scheduling Workflow</h2>

        <ol>
          <li>Priya (stylist) has set working hours: Tuesday-Sunday, 10am-7pm with a 1pm-2pm break.</li>
          <li>A customer books a haircut via WhatsApp for Priya on Thursday at 3pm.</li>
          <li>The slot is blocked immediately - no other booking can land in that window.</li>
          <li>A confirmation goes to the customer: "Booking confirmed with Priya on Thursday at 3pm."</li>
          <li>A reminder is sent Wednesday evening.</li>
          <li>After the appointment, the invoice is raised under Priya's account and her commission is calculated.</li>
        </ol>

        <h2>Benefits for Salon Owners and Managers</h2>

        <ul>
          <li>Zero double bookings - availability is always accurate in real time</li>
          <li>Customers get the right stylist - service and staff preferences are respected</li>
          <li>Automated reminders reduce no-shows without any manual follow-up</li>
          <li>Staff accountability through individual performance reports</li>
          <li>Payroll and commission tracking in the same system as scheduling</li>
        </ul>

        <div className="not-prose mt-8 p-6 rounded-2xl bg-gradient-to-r from-pink-50 to-fuchsia-50 border border-pink-100">
          <p className="text-base font-semibold text-slate-900 mb-2">Manage your salon staff with Snip and Glow</p>
          <p className="text-sm text-slate-600 mb-4">15-day free trial. No card required.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:border-pink-300 hover:text-pink-600 transition-colors"
            >
              View Plans
            </Link>
          </div>
        </div>

        <h2>Frequently Asked Questions</h2>

        <h3>How does salon staff scheduling software work?</h3>
        <p>
          It lets you assign each staff member a set of services and working hours. When a customer
          books online or via WhatsApp, the system automatically shows only available slots for
          the relevant staff member.
        </p>

        <h3>Can different stylists have different working hours?</h3>
        <p>
          Yes. Each staff member in Snip and Glow has their own schedule with individual working
          days, hours, and break times. Bookings are automatically matched to available staff.
        </p>

        <h3>Can customers choose a specific stylist when booking via WhatsApp?</h3>
        <p>
          Yes. The WhatsApp booking flow shows customers available staff members for their selected
          service. They can choose a preferred stylist or let the system assign the next available one.
        </p>

        <h3>Does Snip and Glow handle staff payroll?</h3>
        <p>
          Yes. Snip and Glow includes staff payroll tracking with salary structures, commission on
          services, bonus management, and deductions - all reportable by time period.
        </p>

        <h3>Can staff members view their own appointment schedule?</h3>
        <p>
          Yes. Snip and Glow has role-based access. Stylists log in and see their own calendar.
          Managers see all staff schedules and can reassign appointments if needed.
        </p>
      </article>
    </SeoPageLayout>
  );
}
