-- =============================================================================
-- 056_whatsapp_processed_messages.sql
-- Idempotency ledger for inbound WhatsApp webhook events.
--
-- WHY: WhatsApp re-delivers a webhook with the SAME message id when our endpoint
-- doesn't acknowledge quickly enough, and a phone number can even be subscribed
-- by more than one app — either way the identical inbound event arrives twice.
-- The webhook had no dedupe guard, so every customer tap (Rate Now, a star
-- rating, a reply) was processed twice: the customer received two rating
-- prompts, two "we're sorry to hear that" replies, and so on.
--
-- HOW: the webhook atomically claims each incoming message id here via
-- INSERT ... ON CONFLICT DO NOTHING. If the row already exists, the delivery is
-- a duplicate and is skipped. Because the primary key makes the claim atomic,
-- this is safe even when the two deliveries arrive at the same instant.
--
-- Only the service-role webhook reads/writes this table. Idempotent + additive.
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (
  message_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Retries only happen within minutes/hours, so old rows can be purged safely by
-- a periodic job. This index makes that cleanup cheap.
CREATE INDEX IF NOT EXISTS idx_wa_processed_at ON whatsapp_processed_messages(processed_at);

-- Only the service-role client (the webhook) touches this. Enable RLS with no
-- policies so tenant/anon roles can never read or write it.
ALTER TABLE whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;
