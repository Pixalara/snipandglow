// PingFlow — Privacy Policy Page

import { useNavigate } from 'react-router-dom';

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px 80px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#E11D48', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginBottom: '24px', padding: 0 }}>← Back</button>

        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '32px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' }}>Privacy Policy</h1>
        <p style={{ fontSize: '14px', color: '#94A3B8', margin: '0 0 32px' }}>Last updated: April 28, 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontSize: '15px', color: '#334155', lineHeight: '1.8' }}>
          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>1. Information We Collect</h2>
            <p>When you use PingFlow, we collect information you provide directly, including your name, email address, phone number, gym name, and business details during registration. We also collect member data you enter into the system (names, phone numbers, membership plans) and payment records you create.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>2. How We Use Your Information</h2>
            <p>We use your information to provide and maintain the PingFlow service, send WhatsApp automation messages on your behalf via AiSensy, generate invoices and billing records, provide customer support, and improve our services. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>3. Data Storage & Security</h2>
            <p>Your data is stored securely on Google Firebase (Firestore) servers. We use industry-standard encryption for data in transit (TLS/SSL) and at rest. Access to your gym's data is restricted to your account and any employee accounts you create. We implement role-based access controls to ensure employees only see data relevant to their role.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>4. Third-Party Services</h2>
            <p>PingFlow integrates with the following third-party services:</p>
            <ul style={{ paddingLeft: '24px', margin: '8px 0' }}>
              <li><strong>Firebase (Google)</strong> — Authentication, database, hosting</li>
              <li><strong>AiSensy</strong> — WhatsApp Business API for sending automated messages</li>
              <li><strong>Zoho SMTP</strong> — Email delivery for OTP verification</li>
            </ul>
            <p>Each service has its own privacy policy governing how they handle data.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>5. WhatsApp Messages</h2>
            <p>PingFlow sends WhatsApp messages to your gym members on your behalf using Meta-verified WhatsApp Business API through AiSensy. Messages are sent from your gym's configured WhatsApp number. You are responsible for ensuring you have consent from your members to receive these messages.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>6. Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you delete your account, we will delete your data within 30 days, except where we are required to retain it for legal or regulatory purposes. Audit logs are retained for 1 year for accountability.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>7. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data at any time. You can export your data from the Settings page. To request account deletion, contact us at <a href="mailto:hello@pixalara.com" style={{ color: '#E11D48', fontWeight: '600' }}>hello@pixalara.com</a>.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '0 0 12px' }}>8. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, contact us at:<br />
            Email: <a href="mailto:hello@pixalara.com" style={{ color: '#E11D48', fontWeight: '600' }}>hello@pixalara.com</a><br />
            Company: Pixalara Technologies</p>
          </section>
        </div>
      </div>
    </div>
  );
}
