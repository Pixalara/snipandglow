import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions — snipandglow',
  description: 'Terms and conditions for using the snipandglow salon management platform.',
};

export default function TermsPage() {
  return (
    <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-p:leading-relaxed prose-li:leading-relaxed">
      <h1>Terms and Conditions</h1>
      <p className="text-sm text-slate-500 not-prose">
        Effective Date: May 12, 2026 &middot; Last Updated: May 12, 2026
      </p>

      <p>
        These Terms and Conditions (&quot;Terms&quot;) govern your use of the snipandglow platform
        operated by snipandglow (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), accessible at{' '}
        <a href="https://snipandglow.com" className="text-emerald-600 hover:underline">snipandglow.com</a>.
        By accessing or using our service, you agree to be bound by these Terms.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By creating an account or using snipandglow, you confirm that you are at least 18 years old,
        have the legal authority to enter into this agreement, and agree to comply with these Terms.
        If you are using the service on behalf of a business, you represent that you have the authority
        to bind that business to these Terms.
      </p>

      <h2>2. Service Description</h2>
      <p>
        snipandglow is a cloud-based salon management software-as-a-service (SaaS) platform that provides:
      </p>
      <ul>
        <li>Appointment scheduling and management</li>
        <li>Automated WhatsApp reminders and client communication</li>
        <li>Billing, invoicing, and payment tracking</li>
        <li>Customer relationship management (CRM)</li>
        <li>Staff management and performance tracking</li>
        <li>Business analytics and reporting</li>
        <li>Multi-branch management</li>
      </ul>

      <h2>3. Account Registration</h2>
      <ul>
        <li>You must provide accurate and complete information during registration</li>
        <li>You are responsible for maintaining the security of your account credentials</li>
        <li>You must notify us immediately of any unauthorized access to your account</li>
        <li>One account per salon business — multiple branches are managed within a single account</li>
        <li>We reserve the right to suspend or terminate accounts that violate these Terms</li>
      </ul>

      <h2>4. Subscription and Billing</h2>
      <h3>Plans and Pricing</h3>
      <ul>
        <li><strong>Starter Plan:</strong> ₹799/month</li>
        <li><strong>Pro Plan:</strong> ₹1,199/month</li>
      </ul>

      <h3>Free Trial</h3>
      <p>
        New users receive a 15-day free trial with full access to features. No credit card is required
        to start the trial. At the end of the trial, you must subscribe to a paid plan to continue using the service.
      </p>

      <h3>Billing Terms</h3>
      <ul>
        <li>Subscriptions are billed monthly in advance</li>
        <li>Payments are processed securely via Razorpay</li>
        <li>Prices are in Indian Rupees (INR) and inclusive of applicable taxes unless stated otherwise</li>
        <li>We reserve the right to change pricing with 30 days&apos; advance notice</li>
        <li>Failed payments may result in service suspension after a 7-day grace period</li>
      </ul>

      <h2>5. User Responsibilities</h2>
      <p>You agree to:</p>
      <ul>
        <li>Use the service only for lawful purposes related to salon business management</li>
        <li>Obtain proper consent from your clients before storing their data or sending them messages</li>
        <li>Not misuse the WhatsApp messaging feature for spam or unsolicited marketing</li>
        <li>Keep your account information up to date</li>
        <li>Not attempt to reverse-engineer, copy, or redistribute any part of the platform</li>
        <li>Not share your account credentials with unauthorized individuals</li>
        <li>Comply with all applicable laws, including data protection regulations</li>
      </ul>

      <h2>6. Intellectual Property</h2>
      <p>
        All content, features, functionality, design, code, and branding of snipandglow are owned by us
        and protected by intellectual property laws. You may not copy, modify, distribute, or create
        derivative works from any part of our platform without written permission.
      </p>
      <p>
        You retain ownership of all data you input into the platform (salon data, client records, etc.).
        You grant us a limited license to process this data solely to provide the service.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law:
      </p>
      <ul>
        <li>snipandglow is provided &quot;as is&quot; without warranties of any kind, express or implied</li>
        <li>We do not guarantee uninterrupted or error-free service</li>
        <li>We are not liable for any indirect, incidental, special, or consequential damages</li>
        <li>Our total liability shall not exceed the amount you paid us in the 3 months preceding the claim</li>
        <li>We are not responsible for losses caused by third-party services (WhatsApp, payment gateways, etc.)</li>
      </ul>

      <h2>8. Termination</h2>
      <ul>
        <li>You may cancel your subscription at any time from your account settings</li>
        <li>Upon cancellation, you retain access until the end of your current billing period</li>
        <li>We may terminate or suspend your account for violation of these Terms with prior notice</li>
        <li>Upon termination, your data is retained for 90 days and then permanently deleted</li>
        <li>You may request data export before account deletion</li>
      </ul>

      <h2>9. Service Availability</h2>
      <p>
        We strive for 99.9% uptime but do not guarantee it. Scheduled maintenance will be communicated
        in advance. We are not liable for downtime caused by factors beyond our control, including
        internet outages, third-party service failures, or force majeure events.
      </p>

      <h2>10. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the laws of India. Any disputes arising from these Terms or your
        use of the service shall be subject to the exclusive jurisdiction of the courts in India.
        We encourage resolving disputes amicably through email communication before pursuing legal action.
      </p>

      <h2>11. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be communicated via email
        or in-app notification at least 15 days before they take effect. Continued use of the service
        after changes constitutes acceptance of the updated Terms.
      </p>

      <h2>12. Contact Us</h2>
      <p>
        If you have questions about these Terms, please contact us:
      </p>
      <ul>
        <li><strong>Email:</strong>{' '}
          <a href="mailto:snipandglow.support@pixalara.com" className="text-emerald-600 hover:underline">snipandglow.support@pixalara.com</a>
        </li>
        <li><strong>Website:</strong>{' '}
          <a href="https://snipandglow.com" className="text-emerald-600 hover:underline">snipandglow.com</a>
        </li>
        <li><strong>Location:</strong> India</li>
      </ul>
    </article>
  );
}
