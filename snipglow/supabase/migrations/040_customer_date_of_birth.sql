-- =============================================================================
-- 040_customer_date_of_birth.sql
-- Add optional Date of Birth to customers.
-- Powers birthday WhatsApp wishes (Pro & Growth plans) and is captured for all
-- plans so Essentials users benefit immediately if they upgrade later.
-- =============================================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- DB-level guard with an IMMUTABLE lower bound (avoids non-immutable CURRENT_DATE
-- in a CHECK). The "not in the future" rule is enforced in the application layer
-- (form + server action) where CURRENT_DATE comparison is safe.
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_date_of_birth_min;

ALTER TABLE customers
  ADD CONSTRAINT customers_date_of_birth_min
  CHECK (date_of_birth IS NULL OR date_of_birth >= DATE '1950-01-01');

-- Functional index on (month, day) to support fast "whose birthday is today"
-- lookups for the birthday campaign cron.
CREATE INDEX IF NOT EXISTS idx_customers_dob_month_day
  ON customers ((EXTRACT(MONTH FROM date_of_birth)), (EXTRACT(DAY FROM date_of_birth)));
