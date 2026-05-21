-- =============================================================================
-- Migration 019: Add short ticket_number to support_tickets
-- Format: TKT-0001, TKT-0002, etc. Auto-generated via trigger.
-- =============================================================================

-- Add ticket_number column
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ticket_number TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 1;

-- Trigger function to auto-generate ticket_number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'TKT-' || LPAD(nextval('support_ticket_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS set_ticket_number ON support_tickets;
CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL)
  EXECUTE FUNCTION generate_ticket_number();

-- Add unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_number ON support_tickets(ticket_number) WHERE ticket_number IS NOT NULL;

-- Backfill existing tickets that don't have a number
UPDATE support_tickets 
SET ticket_number = 'TKT-' || LPAD(nextval('support_ticket_seq')::TEXT, 4, '0')
WHERE ticket_number IS NULL;
