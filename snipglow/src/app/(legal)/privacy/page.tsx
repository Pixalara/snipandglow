import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — snipandglow',
  description: 'Learn how snipandglow collects, uses, and protects your personal data.',
};

export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-p:leading-relaxed prose-li:leading-relaxed">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-slate-500 not-prose">
        Effective Date: May 12, 2026 &middot; Last Updated: May 12, 2026
      </p>

      <p>
        snipandglow (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the website{' '}
        <a href="https://snipandglow.com" className="text-emerald-600 hover:underline">snipandglow.com</a>{' '}
        and the snipandglow salon management platform. This Privacy Policy explains how we collect, use,
        store, and protect your information when you use our services.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>Personal Information</h3>
      <ul>
        <li><strong>Account details:</strong> Name, email address (via Google OAuth), and phone number</li>
        <li><strong>Business information:</strong> Salon name, address, staff details, services offered, and working hours</li>
        <li><strong>Billing data:</strong> Subscription plan, payment history, and invoice records</li>
      </ul>

      <h3>Customer Data (Your Salon&apos;s Clients)</h3>
      <ul>
        <li>Client names, phone numbers, appointment history, and billing records that you enter into the platform</li>
      </ul>

      <h3>Usage Data</h3>
      <ul>
        <li>Browser type, device information, IP address, pages visited, and interaction patterns</li>
        <li>Feature usage analytics to improve our product</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <ul>
        <li><strong>Provide our service:</strong> Manage appointments, send WhatsApp reminders, generate invoices, and run your salon operations</li>
        <li><strong>Improve the product:</strong> Analyze usage patterns to build better features</li>
        <li><strong>Communicate:</strong> Send service updates, billing notifications, and support responses</li>
        <li><strong>Security:</strong> Detect and prevent fraud, abuse, or unauthorized access</li>
      </ul>

      <h2>3. Data Storage and Security</h2>
      <p>
        Your data is stored on <strong>Supabase</strong> infrastructure hosted in the <strong>Mumbai (ap-south-1) region, India</strong>.
        We use industry-standard encryption (TLS in transit, AES-256 at rest) and follow security best practices
        including row-level security policies, regular backups, and access controls.
      </p>

      <h2>4. Third-Party Services</h2>
      <p>We share data with the following third-party services only as necessary to operate our platform:</p>
      <ul>
        <li><strong>Google OAuth:</strong> For secure authentication — we receive your name and email from Google</li>
        <li><strong>Meta / WhatsApp Business API:</strong> To send appointment reminders, invoices, and promotional messages to your salon&apos;s clients</li>
        <li><strong>Vercel:</strong> For hosting and serving the web application</li>
        <li><strong>Razorpay:</strong> For processing subscription payments securely</li>
      </ul>
      <p>
        We do not sell, rent, or trade your personal information to any third party for marketing purposes.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain your data for as long as your account is active. If you cancel your subscription,
        we retain your data for 90 days in case you wish to reactivate. After 90 days, your data
        is permanently deleted from our systems. You may request earlier deletion at any time.
      </p>

      <h2>6. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of all personal data we hold about you</li>
        <li><strong>Correction:</strong> Update or correct inaccurate information</li>
        <li><strong>Deletion:</strong> Request permanent deletion of your account and all associated data</li>
        <li><strong>Export:</strong> Download your data in a machine-readable format (JSON/CSV)</li>
        <li><strong>Withdraw consent:</strong> Opt out of non-essential communications at any time</li>
      </ul>
      <p>
        To exercise any of these rights, email us at{' '}
        <a href="mailto:dileep.cloudops@gmail.com" className="text-emerald-600 hover:underline">dileep.cloudops@gmail.com</a>.
      </p>

      <h2>7. Cookies</h2>
      <p>
        We use essential cookies to maintain your login session and preferences. We do not use
        third-party advertising or tracking cookies. Analytics data is collected server-side
        without invasive browser tracking.
      </p>

      <h2>8. Children&apos;s Privacy</h2>
      <p>
        snipandglow is a business tool designed for salon owners and professionals. Our service is
        not directed at individuals under the age of 18. We do not knowingly collect personal
        information from children. If you believe a minor has provided us with personal data,
        please contact us and we will promptly delete it.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of significant
        changes via email or an in-app notification. Continued use of the service after changes
        constitutes acceptance of the updated policy.
      </p>

      <h2>10. Contact Us</h2>
      <p>
        If you have questions or concerns about this Privacy Policy, please contact us:
      </p>
      <ul>
        <li><strong>Email:</strong>{' '}
          <a href="mailto:dileep.cloudops@gmail.com" className="text-emerald-600 hover:underline">dileep.cloudops@gmail.com</a>
        </li>
        <li><strong>Website:</strong>{' '}
          <a href="https://snipandglow.com" className="text-emerald-600 hover:underline">snipandglow.com</a>
        </li>
        <li><strong>Location:</strong> India</li>
      </ul>
    </article>
  );
}
