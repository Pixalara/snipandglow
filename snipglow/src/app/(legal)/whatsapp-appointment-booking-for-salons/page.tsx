import type { Metadata } from 'next';
import Link from 'next/link';
import { SeoPageLayout } from '../seo-page-layout';

export const metadata: Metadata = {
  title: 'WhatsApp Appointment Booking for Salons, Spas and Beauty Studios',
  description:
    'Let customers book salon and spa appointments through WhatsApp with automated service selection, reminders, confirmations, and CRM follow-ups.',
  alternates: { canonical: 'https://snipandglow.com/whatsapp-appointment-booking-for-salons' },
  openGraph: {
    title: 'WhatsApp Appointment Booking for Salons, Spas and Beauty Studios',
    description:
      'Let customers book salon and spa appointments through WhatsApp with automated service selection, reminders, confirmations, and CRM follow-ups.',
    url: 'https://snipandglow.com/whatsapp-appointment-booking-for-salons',
    type: 'article',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does WhatsApp appointment booking work for salons?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A customer sends a message to your salon\'s WhatsApp number (or scans a QR code). An automated menu appears with options to book, view services, or contact the salon. They select a service, staff member, and time slot. The booking is confirmed instantly with a WhatsApp message, and a reminder is sent 24 hours before.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do customers need to download an app to book via WhatsApp?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Customers book directly through WhatsApp, which they already have on their phone. No app download, no website signup, no form to fill out. This makes WhatsApp booking significantly easier than most online booking systems.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the difference between a shared WhatsApp number and my own number for salon bookings?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A shared WhatsApp number means bookings come through the Snip and Glow platform number - zero setup required, all costs covered. Your own WhatsApp Business number (available on Pro and Growth plans) means all messages show your salon name and number, giving a more professional branded experience.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can customers reschedule or cancel via WhatsApp?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Snip and Glow\'s WhatsApp booking flow includes options for customers to reschedule or cancel directly from the WhatsApp chat. The salon dashboard updates in real time.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does WhatsApp appointment booking work for spas and beauty parlours, not just salons?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Snip and Glow works for any appointment-based beauty business - salons, spas, beauty parlours, wellness centres, skin clinics, and nail studios. The booking flow is customised to your services and staff.',
      },
    },
  ],
};

export default function WhatsAppAppointmentBookingPage() {
  return (
    <SeoPageLayout currentPath="/whatsapp-appointment-booking-for-salons">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-p:leading-relaxed prose-li:leading-relaxed">

        <h1>WhatsApp Appointment Booking for Salons, Spas and Beauty Studios</h1>
        <p className="text-sm text-slate-500 not-prose">Automated WhatsApp booking for Indian beauty businesses · Snip and Glow</p>

        <p>
          Most salon appointment systems require customers to open a website, create an account, and navigate
          a booking form. In India, where WhatsApp is the default communication channel, this creates unnecessary
          friction. Customers already have WhatsApp open. A booking flow that lives inside WhatsApp - with no
          app, no link, no extra steps - converts significantly better.
        </p>
        <p>
          <a href="https://snipandglow.com" className="text-emerald-600 hover:underline">Snip and Glow</a> enables
          complete WhatsApp appointment booking for salons, spas, beauty parlours, and wellness studios. Customers
          book directly in the chat. Everything else is automated.
        </p>

        <h2>How WhatsApp Appointment Booking Works</h2>

        <h3>Step 1 - Customer Initiates Contact</h3>
        <p>
          A customer sends a message to your salon's WhatsApp number, or scans a QR code placed at your reception,
          in your Instagram bio, or in a shared link. They don't need to know any special keyword - any message
          triggers the booking flow.
        </p>

        <h3>Step 2 - Automated Menu Appears</h3>
        <p>An interactive menu appears instantly:</p>
        <ul>
          <li>Book Appointment</li>
          <li>View Services and Prices</li>
          <li>Talk to Salon</li>
        </ul>
        <p>No typing required. The customer taps a button.</p>

        <h3>Step 3 - Service and Staff Selection</h3>
        <p>
          The customer selects a service from your menu. If you have multiple staff members, they can choose
          a preferred stylist or let the system assign the next available person.
        </p>

        <h3>Step 4 - Date and Time Selection</h3>
        <p>
          Available slots are shown based on real-time staff availability. The customer selects a date and time.
          No double-booking is possible - the system checks availability as the flow progresses.
        </p>

        <h3>Step 5 - Instant Confirmation</h3>
        <p>
          The booking is confirmed the moment the customer selects a slot. A confirmation message is sent
          immediately with the appointment details: service, staff member, date, and time.
        </p>

        <h3>Step 6 - Automatic 24-Hour Reminder</h3>
        <p>
          Snip and Glow sends an automatic reminder 24 hours before the appointment. The customer can confirm,
          reschedule, or cancel with a tap. No phone calls needed. Salons using automated reminders report
          no-shows dropping by up to 70%.
          Read more: <a href="/salon-reminder-software" className="text-emerald-600 hover:underline">salon reminder software</a>.
        </p>

        <h3>Step 7 - Post-Visit Follow-Up</h3>
        <p>
          After the appointment, an invoice and a feedback request are sent automatically on WhatsApp. If the
          customer gives 5 stars, they're prompted to leave a Google review. The full customer profile and
          visit history is stored in the CRM automatically.
          Read more: <a href="/salon-crm-software-india" className="text-emerald-600 hover:underline">salon CRM software</a>.
        </p>

        <h2>Shared WhatsApp Number vs Your Own Number</h2>
        <p>Snip and Glow supports two WhatsApp booking modes:</p>

        <h3>Shared Mode (Essentials Plan - ₹799/month)</h3>
        <p>
          All bookings, confirmations, and reminders are sent through the Snip and Glow platform number.
          Zero setup required. All WhatsApp messaging costs are covered. Perfect for salons that want
          automation without technical setup.
        </p>

        <h3>Dedicated Mode (Pro/Growth Plans)</h3>
        <p>
          Your salon connects its own WhatsApp Business number. Every message shows your salon's name and
          number. Customers build familiarity with your brand. Includes broadcast campaign capability for
          marketing messages.
          Read more: <a href="/salon-whatsapp-marketing" className="text-emerald-600 hover:underline">WhatsApp marketing for salons</a>
          {' '}and <a href="/spa-whatsapp-marketing" className="text-emerald-600 hover:underline">WhatsApp marketing for spas</a>.
        </p>

        <h2>Benefits of WhatsApp Booking for Salons</h2>
        <ul>
          <li><strong>No app download needed:</strong> Customers use WhatsApp they already have</li>
          <li><strong>Faster booking:</strong> The whole flow takes under 60 seconds</li>
          <li><strong>24/7 availability:</strong> Customers can book at midnight with no staff involvement</li>
          <li><strong>Automatic confirmations:</strong> No manual confirmation messages needed</li>
          <li><strong>Fewer no-shows:</strong> Automated reminders reduce missed appointments significantly</li>
          <li><strong>Staff freed up:</strong> Receptionists spend less time on the phone taking bookings</li>
          <li><strong>CRM built automatically:</strong> Every booking creates or updates a customer profile</li>
        </ul>

        <h2>WhatsApp Booking for Spas and Beauty Parlours</h2>
        <p>
          The same booking flow works for spas, beauty parlours, wellness centres, and nail studios.
          Treatment-based businesses benefit especially from the reminder system - longer appointments
          are harder to rebook after a missed visit.
          Read more: <a href="/spa-whatsapp-marketing" className="text-emerald-600 hover:underline">WhatsApp marketing for spas</a>
          {' '}and <a href="/beauty-parlour-software-india" className="text-emerald-600 hover:underline">beauty parlour software in India</a>.
        </p>

        <div className="not-prose mt-8 p-6 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-emerald-100">
          <p className="text-base font-semibold text-slate-900 mb-2">Set up WhatsApp booking for your salon in 10 minutes</p>
          <p className="text-sm text-slate-600 mb-4">15-day free trial. No credit card. Full setup included.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/signup" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">Start Free Trial</Link>
            <Link href="/#pricing" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:border-emerald-300 hover:text-emerald-600 transition-colors">View Plans</Link>
          </div>
        </div>

        <h2>Frequently Asked Questions</h2>

        <h3>How does WhatsApp appointment booking work for salons?</h3>
        <p>A customer messages your salon's WhatsApp number or scans a QR code. An automated menu guides them through service, staff, and time selection. The booking is confirmed instantly and a reminder is sent 24 hours before.</p>

        <h3>Do customers need to download an app?</h3>
        <p>No. Customers book directly through WhatsApp - no app download, no website signup, no form. This reduces friction and increases bookings.</p>

        <h3>What's the difference between a shared and dedicated WhatsApp number?</h3>
        <p>Shared means bookings run through Snip and Glow's platform number - zero setup, all costs covered. Your own number (Pro/Growth) gives a branded experience with your salon name on every message.</p>

        <h3>Can customers reschedule via WhatsApp?</h3>
        <p>Yes. The booking flow includes reschedule and cancel options. The salon dashboard updates in real time.</p>

        <h3>Does it work for spas and beauty parlours?</h3>
        <p>Yes. Snip and Glow works for any appointment-based beauty business - salons, spas, parlours, wellness centres, and nail studios.</p>
      </article>
    </SeoPageLayout>
  );
}
