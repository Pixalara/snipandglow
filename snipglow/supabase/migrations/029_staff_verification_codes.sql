-- =============================================================================
-- 029_staff_verification_codes.sql
--
-- Code-based staff verification. A password-provisioned staff member must prove
-- ownership of their WhatsApp number (and email) by entering OTP codes before
-- they can log in. This replaces pure owner-attestation with real proof.
--
-- WhatsApp codes are generated and stored here, then sent via the Meta Cloud
-- API (same channel as login OTP). Email proof is handled by Supabase Auth's
-- email OTP, so only the WhatsApp code lives in this table.
--
-- The columns email_verified_by_owner / phone_verified_by_owner from migration
-- 028 are reused as the canonical "verified" flags; they are now set when the
-- staff member proves each channel (the owner can still override from the
-- dashboard).
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  phone_code TEXT NOT NULL,
  -- Opaque token returned to the client after credentials are validated, so
  -- follow-up confirm calls don't need to resend the password.
  session_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_verif_employee ON staff_verification_codes(employee_id);
CREATE INDEX IF NOT EXISTS idx_staff_verif_token ON staff_verification_codes(session_token);

-- Service-role only — all access goes through server actions with the admin
-- client. Enable RLS with no policies so the anon/auth keys can't read codes.
ALTER TABLE staff_verification_codes ENABLE ROW LEVEL SECURITY;
