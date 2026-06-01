-- Migration 022: Notifications table for real-time dashboard alerts
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'new_booking' | 'reschedule' | 'cancel' | 'feedback'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  appointment_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_tenant ON notifications(tenant_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(tenant_id, is_read) WHERE is_read = false;

-- RLS: tenants can only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants see own notifications"
  ON notifications FOR ALL
  USING (tenant_id = (SELECT (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid));
