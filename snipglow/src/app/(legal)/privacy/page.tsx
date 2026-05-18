import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — SnipandGlow',
  description: 'Learn how SnipandGlow collects, uses, and protects your personal data. Compliant with Meta WhatsApp Business API policies.',
};

export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-p:leading-relaxed prose-li:leading-relaxed">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-slate-500 not-prose">
        Effective Date: May 18, 2026 &middot; Last Updated: May 18, 2026
      </p>

      <p>
        SnipandGlow (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), operated by Pixalara LLP, provides the website{' '}
        <a href="https://snipandglow.com" className="text-emerald-600 hover:underline">snipandglow.com</a>{' '}
        and the SnipandGlow salon management platform including WhatsApp Business API integration. This Privacy Policy explains how we collect, use,
        store, and protect your information when you use our services.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>Personal Information (Salon Owners / Users)</h3>
      <ul>
        <li><strong>Account details:</strong> Name, email address (via Google OAuth), and phone number (verified via WhatsApp OTP)</li>
        <li><strong>Business information:</strong> Salon name, address, staff details, services offered, and working hours</li>
        <li><strong>Billing data:</strong> Subscription plan, payment history, and invoice records</li>
      </ul>

      <h3>Customer Data (Your Salon&apos;s Clients)</h3>
      <ul>
        <li>Client names, phone numbers, appointment history, billing records, and feedback that you or your customers enter into the platform</li>
        <li>WhatsApp conversation data including messages sent/received through the platform for appointment booking, reminders, and notifications</li>
      </ul>

      <h3>WhatsApp Messaging Data</h3>
      <ul>
        <li>Phone numbers of customers who interact with your salon via WhatsApp</li>
        <li>Message delivery status (sent, delivered, read, failed)</li>
        <li>Template messages sent (appointment confirmations, reminders, marketing broadcasts)</li>
        <li>Customer replies and button interactions within WhatsApp conversations</li>
      </ul>

      <h3>Usage Data</h3>
      <ul>
        <li>Browser type, device information, IP address, pages visited, and interaction patterns</li>
        <li>Feature usage analytics to improve our product</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <ul>
        <li><strong>Provide our service:</strong> Manage appointments, send WhatsApp reminders and confirmations, generate invoices, and run your salon operations</li>
        <li><strong>WhatsApp Business messaging:</strong> Send appointment confirmations, reminders, invoices, feedback requests, and marketing broadcasts on your behalf to your customers</li>
        <li><strong>Improve the product:</strong> Analyze usage patterns to build better features</li>
        <li><strong>Communicate:</strong> Send service updates, billing notifications, and support responses</li>
        <li><strong>Security:</strong> Detect and prevent fraud, abuse, or unauthorized access</li>
      </ul>

      <h2>3. WhatsApp Business API Compliance</h2>
      <p>
        SnipandGlow uses the <strong>Meta WhatsApp Business API</strong> to enable salon owners to communicate with their customers. We comply with Meta&apos;s Business Messaging Policy and WhatsApp Business Policy:
      </p>
      <ul>
        <li><strong>Consent:</strong> Messages are only sent to customers who have initiated contact with the salon via WhatsApp, booked an appointment, or explicitly opted in to receive communications</li>
        <li><strong>Purpose limitation:</strong> WhatsApp messages are used solely for appointment management, service notifications, and salon-related communications</li>
        <li><strong>Opt-out:</strong> Customers can stop receiving messages at any time by replying &quot;STOP&quot; or by requesting removal from the salon&apos;s customer list</li>
        <li><strong>No spam:</strong> We do not send unsolicited messages. Marketing messages are only sent to existing customers with prior business relationship</li>
        <li><strong>Data minimization:</strong> We only collect and process the minimum data necessary to provide the messaging service</li>
        <li><strong>Template compliance:</strong> All business-initiated messages use Meta-approved templates</li>
      </ul>

      <h2>4. Data Storage and Security</h2>
      <p>
        Your data is stored on <strong>Supabase</strong> infrastructure with enterprise-grade security.
        We use industry-standard encryption (TLS 1.3 in transit, AES-256 at rest) and follow security best practices
        including row-level security policies, regular backups, access controls, and secure token storage.
      </p>
      <ul>
        <li>WhatsApp access tokens are stored encrypted and never exposed in client-side code</li>
        <li>Customer phone numbers are stored in E.164 format with tenant-level isolation</li>
        <li>Message logs are retained for service delivery and dispute resolution purposes</li>
      </ul>

      <h2>5. Third-Party Services</h2>
      <p>We share data with the following third-party services only as necessary to operate our platform:</p>
      <ul>
        <li><strong>Google OAuth:</strong> For secure authentication — we receive your name and email from Google</li>
        <li><strong>Meta / WhatsApp Business API:</strong> To send and receive WhatsApp messages on behalf of salon owners to their customers. Meta processes message delivery and may retain message metadata per their own privacy policy</li>
        <li><strong>Vercel:</strong> For hosting and serving the web application</li>
        <li><strong>Razorpay:</strong> For processing subscription payments securely</li>
      </ul>
      <p>
        We do not sell, rent, or trade your personal information or your customers&apos; data to any third party for marketing purposes.
      </p>

      <h2>6. Data Retention</h2>
      <ul>
        <li><strong>Account data:</strong> Retained for as long as your account is active. After cancellation, retained for 90 days then permanently deleted</li>
        <li><strong>WhatsApp message logs:</strong> Retained for 90 days for service delivery verification, then automatically purged</li>
        <li><strong>Customer session data:</strong> WhatsApp conversation sessions expire after 24 hours of inactivity</li>
        <li><strong>Appointment data:</strong> Retained as long as your account is active for business continuity</li>
      </ul>
      <p>You may request earlier deletion of any data at any time.</p>

      <h2>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of all personal data we hold about you</li>
        <li><strong>Correction:</strong> Update or correct inaccurate information</li>
        <li><strong>Deletion:</strong> Request permanent deletion of your account and all associated data</li>
        <li><strong>Export:</strong> Download your data in a machine-readable format (JSON/CSV)</li>
        <li><strong>Withdraw consent:</strong> Opt out of non-essential communications at any time</li>
        <li><strong>Object to processing:</strong> Object to the processing of your data for specific purposes</li>
      </ul>
      <p>
        To exercise any of these rights, email us at{' '}
        <a href="mailto:snipandglow.support@pixalara.com" className="text-emerald-600 hover:underline">snipandglow.support@pixalara.com</a>.
      </p>

      <h2>8. Your Customers&apos; Rights</h2>
      <p>
        Customers of salons using SnipandGlow have the right to:
      </p>
      <ul>
        <li>Stop receiving WhatsApp messages by replying &quot;STOP&quot; or contacting the salon</li>
        <li>Request deletion of their data from the salon&apos;s database</li>
        <li>Know how their phone number and appointment data is being used</li>
      </ul>
      <p>
        Salon owners are responsible for ensuring they have appropriate consent from their customers before using WhatsApp messaging features.
      </p>

      <h2>9. Cookies</h2>
      <p>
        We use essential cookies to maintain your login session and preferences. We do not use
        third-party advertising or tracking cookies. Analytics data is collected server-side
        without invasive browser tracking.
      </p>

      <h2>10. Children&apos;s Privacy</h2>
      <p>
        SnipandGlow is a business tool designed for salon owners and professionals. Our service is
        not directed at individuals under the age of 18. We do not knowingly collect personal
        information from children. If you believe a minor has provided us with personal data,
        please contact us and we will promptly delete it.
      </p>

      <h2>11. International Data Transfers</h2>
      <p>
        Your data is primarily stored and processed in India. When using WhatsApp Business API,
        message data may be processed by Meta&apos;s infrastructure in accordance with Meta&apos;s
        data processing terms. We ensure appropriate safeguards are in place for any data transfers.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of significant
        changes via email or an in-app notification. Continued use of the service after changes
        constitutes acceptance of the updated policy.
      </p>

      <h2>13. Contact Us</h2>
      <p>
        If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
      </p>
      <ul>
        <li><strong>Email:</strong>{' '}
          <a href="mailto:snipandglow.support@pixalara.com" className="text-emerald-600 hover:underline">snipandglow.support@pixalara.com</a>
        </li>
        <li><strong>Website:</strong>{' '}
          <a href="https://snipandglow.com" className="text-emerald-600 hover:underline">snipandglow.com</a>
        </li>
        <li><strong>Company:</strong> Pixalara LLP, India (DPIIT Recognized)</li>
      </ul>
    </article>
  );
}
