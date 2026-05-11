// PingFlow — Refund Policy Page

import { useNavigate } from 'react-router-dom';

export default function RefundPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px 80px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#E11D48', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginBottom: '24px', padding: 0 }}>← Back</button>

        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '32px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' }}>Refund Policy</h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', margin: '0 0 32px' }}>Last updated: April 28, 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontSize: '15px', color: '#334155', lineHeight: '1.8' }}>
          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>1. Free Trial</h2>
            <p>PingFlow offers a 14-day free trial with full access to all features. No credit card is required for the trial. If you do not subscribe after the trial, your account will be downgraded to the Starter plan limits automatically. No charges are made during the trial period.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>2. Subscription Refunds</h2>
            <p>If you are not satisfied with PingFlow, you may request a full refund within 7 days of your subscription payment. Refund requests made after 7 days will be evaluated on a case-by-case basis. To request a refund, email us at <a href="mailto:hello@pixalara.com" style={{ color: '#E11D48', fontWeight: '600' }}>hello@pixalara.com</a> with your account email and reason for the refund.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>3. Refund Process</h2>
            <p>Once your refund request is approved, the refund will be processed within 5-7 business days to your original payment method. You will receive an email confirmation when the refund is initiated.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>4. Non-Refundable Items</h2>
            <p>The following are not eligible for refunds:</p>
            <ul style={{ paddingLeft: '24px', margin: '8px 0' }}>
              <li>WhatsApp message credits consumed via AiSensy (these are billed by AiSensy directly)</li>
              <li>Wallet top-up amounts already used for WhatsApp messaging</li>
              <li>Partial month usage after the 7-day refund window</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>5. Cancellation</h2>
            <p>You may cancel your subscription at any time. Upon cancellation, you will retain access to your current plan until the end of the billing period. After that, your account will be downgraded to Starter plan limits. Your data will be preserved and accessible.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>6. Plan Downgrades</h2>
            <p>If you downgrade from Pro to Starter, features exclusive to Pro (Broadcasting, Expense Tracking, Advanced Analytics, Global View, Audit Trails) will become inaccessible. Your data will be preserved but not visible until you upgrade again. Resource limits (members, employees, branches, leads) will be enforced at Starter levels.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>7. Contact Us</h2>
            <p>For refund requests or billing questions, contact us at:<br />
            Email: <a href="mailto:hello@pixalara.com" style={{ color: '#E11D48', fontWeight: '600' }}>hello@pixalara.com</a><br />
            Company: Pixalara Technologies<br />
            Response time: Within 24 hours on business days</p>
          </section>
        </div>
      </div>
    </div>
  );
}
