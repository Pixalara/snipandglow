-- =============================================================================
-- 028_staff_login_credentials.sql
--
-- Staff/employee login support.
--
-- Owners create staff accounts with an email + password (set by the owner).
-- Staff then log in with those credentials on the same login screen the owner
-- uses. For security, the owner must explicitly VERIFY the staff member's email
-- and WhatsApp/phone from the owner dashboard before the staff member is allowed
-- to log in for the first time.
--
-- New columns on employees:
--   email_verified_by_owner  — owner confirmed this email belongs to the staff
--   phone_verified_by_owner  — owner confirmed this WhatsApp/phone belongs to them
--   login_method             — 'password' for owner-provisioned staff, 'otp'/'oauth'
--                              for self-onboarded owners (informational)
--   must_change_password     — force a password change on first staff login (optional UX)
-- =============================================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS email_verified_by_owner BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS phone_verified_by_owner BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS login_method TEXT NOT NULL DEFAULT 'otp'
    CHECK (login_method IN ('otp', 'oauth', 'password'));

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Existing owners/staff were created via OTP/OAuth and are inherently trusted
-- (the owner self-onboarded). Mark all existing rows verified so this migration
-- doesn't lock anyone out. New password-based staff default to unverified.
UPDATE employees
  SET email_verified_by_owner = true,
      phone_verified_by_owner = true
  WHERE login_method <> 'password';
