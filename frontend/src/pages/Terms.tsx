// PingFlow — Terms of Service Page

import { useNavigate } from 'react-router-dom';

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px 80px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#E11D48', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginBottom: '24px', padding: 0 }}>← Back</button>

        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '32px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' }}>Terms of Service</h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', margin: '0 0 32px' }}>Last updated: April 28, 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontSize: '15px', color: '#334155', lineHeight: '1.8' }}>
          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>1. Acceptance of Terms</h2>
            <p>By accessing or using PingFlow ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. PingFlow is operated by Pixalara Technologies.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>2. Description of Service</h2>
            <p>PingFlow is a WhatsApp-based CRM designed for gym owners. The Service includes member management, automated WhatsApp reminders, billing and invoicing, employee management, lead tracking, expense tracking, and analytics. The Service is provided "as is" and may be updated or modified at any time.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>3. Account Registration</h2>
            <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use the Service. One gym account per email address.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>4. Subscription Plans & Billing</h2>
            <p>PingFlow offers a 14-day free trial with full access. After the trial, you may subscribe to the Starter plan (₹499/month) or Pro plan (₹999/month). Subscriptions are billed monthly or annually. You may cancel at any time — access continues until the end of the billing period.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>5. WhatsApp Messaging</h2>
            <p>PingFlow sends WhatsApp messages through the AiSensy WhatsApp Business API. You are responsible for obtaining consent from your gym members before sending them messages. You agree not to use the messaging feature for spam, harassment, or any illegal purpose. WhatsApp message delivery is subject to Meta's policies and AiSensy's service availability.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>6. Acceptable Use</h2>
            <p>You agree not to: use the Service for any unlawful purpose, attempt to gain unauthorized access to other accounts, interfere with the Service's operation, upload malicious code, or resell the Service without authorization.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>7. Data Ownership</h2>
            <p>You retain ownership of all data you enter into PingFlow (member records, payment data, etc.). We do not claim ownership of your content. You grant us a limited license to process your data solely for the purpose of providing the Service.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>8. Limitation of Liability</h2>
            <p>PingFlow is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid for the Service in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>9. Termination</h2>
            <p>We may suspend or terminate your account if you violate these Terms. You may delete your account at any time by contacting us. Upon termination, your data will be deleted within 30 days.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>10. Contact</h2>
            <p>For questions about these Terms, contact us at:<br />
            Email: <a href="mailto:hello@pixalara.com" style={{ color: '#E11D48', fontWeight: '600' }}>hello@pixalara.com</a><br />
            Company: Pixalara Technologies</p>
          </section>
        </div>
      </div>
    </div>
  );
}
