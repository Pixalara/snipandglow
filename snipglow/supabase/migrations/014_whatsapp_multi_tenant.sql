-- =============================================================================
-- WhatsApp Multi-Tenant Architecture
-- Supports: Shared mode (Snip and Glow number) + Dedicated mode (salon's own number)
-- =============================================================================

-- Tenant WhatsApp Settings
CREATE TABLE IF NOT EXISTS tenant_whatsapp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'shared' CHECK (mode IN ('shared', 'dedicated')),
  
  -- Shared mode fields
  booking_slug TEXT UNIQUE, -- e.g., "glamour_studio" → BOOK_GLAMOUR_STUDIO
  qr_text TEXT, -- prefilled message text
  qr_url TEXT, -- full wa.me URL
  
  -- Dedicated mode fields
  waba_id TEXT,
  phone_number_id TEXT,
  display_phone_number TEXT,
  access_token_encrypted TEXT, -- encrypted access token
  display_name TEXT,
  display_name_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  webhook_status TEXT DEFAULT 'inactive', -- active, inactive
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one setting per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_whatsapp_tenant ON tenant_whatsapp_settings(tenant_id);
-- Index for dedicated mode lookup by phone_number_id
CREATE INDEX IF NOT EXISTS idx_tenant_whatsapp_phone ON tenant_whatsapp_settings(phone_number_id) WHERE phone_number_id IS NOT NULL;
-- Index for shared mode lookup by booking_slug
CREATE INDEX IF NOT EXISTS idx_tenant_whatsapp_slug ON tenant_whatsapp_settings(booking_slug) WHERE booking_slug IS NOT NULL;

-- WhatsApp Customer Sessions (for shared mode tenant routing)
CREATE TABLE IF NOT EXISTS whatsapp_customer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'shared' CHECK (mode IN ('shared', 'dedicated')),
  source TEXT NOT NULL DEFAULT 'qr' CHECK (source IN ('qr', 'direct', 'campaign')),
  current_state TEXT NOT NULL DEFAULT 'welcome', -- welcome, booking, feedback, idle
  booking_slug TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast session lookup by phone
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_session_phone_tenant ON whatsapp_customer_sessions(customer_phone, tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_session_phone ON whatsapp_customer_sessions(customer_phone, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_session_expires ON whatsapp_customer_sessions(expires_at) WHERE expires_at > now();
