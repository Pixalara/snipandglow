import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy — snipandglow',
  description: 'No charge during your free trial and a 7-day grace-period full refund after your first payment.',
};

export default function RefundPolicyPage() {
  return (
    <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-p:leading-relaxed prose-li:leading-relaxed">
      <h1>Refund Policy</h1>
      <p className="text-sm text-slate-500 not-prose">
        Effective Date: June 22, 2026 &middot; Last Updated: June 22, 2026
      </p>

      <p>
        At snipandglow, we want you to be completely satisfied with our salon management platform.
        You are never charged during your free trial, and after your first payment you are protected
        by a 7-day grace period — so there is no risk in trying us out.
      </p>

      <h2>1. No Charge During Your Free Trial</h2>
      <p>
        Every new account starts with a <strong>15-day free trial</strong> with full access to all
        features. <strong>No payment is collected during the trial</strong> and no card is required to
        begin. You only pay once you choose to subscribe after the trial ends.
      </p>

      <h2>2. 7-Day Grace Period — Full Refund</h2>
      <p>
        After your free trial, once you make your first payment, you get a <strong>7-day grace
        period</strong>. If you decide snipandglow isn&apos;t right for you within those 7 days, you
        can cancel and receive a <strong>full refund — no questions asked</strong>.
      </p>
      <ul>
        <li>The 7-day grace period starts from the date of your first subscription payment</li>
        <li>This applies to <strong>both monthly and yearly</strong> billing on all plans — Essentials, Pro, and Growth</li>
        <li>The free trial period itself is free and is separate from this 7-day refund window</li>
      </ul>

      <h2>3. How to Request a Refund</h2>
      <p>To request a refund, simply:</p>
      <ol>
        <li>
          Send an email to{' '}
          <a href="mailto:snipandglow.support@pixalara.com" className="text-emerald-600 hover:underline">snipandglow.support@pixalara.com</a>{' '}
          with the subject line &quot;Refund Request&quot;
        </li>
        <li>Include your registered email address and salon name</li>
        <li>Briefly mention the reason for your refund (optional, but helps us improve)</li>
      </ol>
      <p>
        Our team will acknowledge your request within 24 hours.
      </p>

      <h2>4. Refund Process</h2>
      <ul>
        <li>Refunds are processed within <strong>5–7 business days</strong> of approval</li>
        <li>The refund will be credited to your original payment method (bank account or UPI)</li>
        <li>You will receive an email confirmation once the refund is initiated</li>
        <li>Bank processing times may vary — please allow up to 10 business days for the amount to reflect in your account</li>
      </ul>

      <h2>5. Non-Refundable Items</h2>
      <p>The following are <strong>not eligible</strong> for refunds:</p>
      <ul>
        <li>Subscription payments made more than 7 days ago (outside the grace period)</li>
        <li>The one-time WhatsApp API setup fee, once setup work has begun</li>
        <li>WhatsApp message credits that have already been consumed</li>
        <li>Add-on services or top-ups that have been used</li>
        <li>Accounts terminated due to Terms of Service violations</li>
      </ul>

      <h2>6. Cancellation Policy</h2>
      <p>
        You can cancel your subscription at any time from your account settings. Here&apos;s what happens:
      </p>
      <ul>
        <li><strong>Immediate effect:</strong> No further charges will be made</li>
        <li><strong>Access continues:</strong> You retain access to all features until the end of your current billing period</li>
        <li><strong>Data retention:</strong> Your data is kept for 90 days after cancellation in case you wish to reactivate</li>
        <li><strong>After 90 days:</strong> All data is permanently deleted</li>
      </ul>
      <p>
        Cancellation does not automatically trigger a refund. If you are within the 7-day grace
        period after your first payment, please submit a separate refund request as described above.
      </p>

      <h2>7. Partial Refunds</h2>
      <p>
        We do not offer partial or prorated refunds for unused days within a billing cycle.
        If you cancel mid-cycle, you continue to have access until the end of that period.
      </p>

      <h2>8. Disputes</h2>
      <p>
        If you believe a charge was made in error or have a billing dispute, please contact us
        before initiating a chargeback with your bank. We are committed to resolving billing
        issues quickly and fairly.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        For refund requests or billing questions:
      </p>
      <ul>
        <li><strong>Email:</strong>{' '}
          <a href="mailto:snipandglow.support@pixalara.com" className="text-emerald-600 hover:underline">snipandglow.support@pixalara.com</a>
        </li>
        <li><strong>Website:</strong>{' '}
          <a href="https://snipandglow.com" className="text-emerald-600 hover:underline">snipandglow.com</a>
        </li>
        <li><strong>Response time:</strong> Within 24 hours on business days</li>
      </ul>
    </article>
  );
}
