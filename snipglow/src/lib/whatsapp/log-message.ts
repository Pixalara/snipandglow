// =============================================================================
// WhatsApp Message Logger
// Logs every outbound message to whatsapp_sessions with template_category
// for accurate per-tenant cost tracking.
// =============================================================================

import { getTemplateCategory } from './pricing';

/**
 * Log a WhatsApp message to whatsapp_sessions with cost category.
 * Call this after every sendMessage() call.
 */
export async function logWhatsAppMessage(
  admin: any,
  params: {
    tenant_id: string;
    phone: string;
    direction: 'inbound' | 'outbound';
    template_name: string | null;
    status: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const category = getTemplateCategory(params.template_name, params.direction);
    await (admin.from('whatsapp_sessions').insert({
      tenant_id: params.tenant_id,
      message_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      phone: params.phone,
      direction: params.direction,
      template_name: params.template_name,
      template_category: category,
      status: params.status,
      metadata: params.metadata ?? {},
    } as any) as any);
  } catch (err) {
    // Non-critical — don't fail the main flow
    console.error('[LogMessage] Failed to log:', err);
  }
}
