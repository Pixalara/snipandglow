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
    /**
     * Meta's real message id (wamid) returned by sendMessage. Storing it lets
     * the delivery-status webhook correlate the callback and flip this row to
     * delivered/failed. Without it (synthetic fallback) the row is stuck at its
     * initial status forever — which is exactly how a billing block showed as
     * "sent" while nothing delivered.
     */
    messageId?: string | null;
    /** Human-readable error ("code: title") when the send failed. */
    errorDetails?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const category = getTemplateCategory(params.template_name, params.direction);
    await (admin.from('whatsapp_sessions').insert({
      tenant_id: params.tenant_id,
      message_id: params.messageId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      phone: params.phone,
      direction: params.direction,
      template_name: params.template_name,
      template_category: category,
      status: params.status,
      error_details: params.errorDetails ?? null,
      metadata: params.metadata ?? {},
    } as any) as any);
  } catch (err) {
    // Non-critical — don't fail the main flow
    console.error('[LogMessage] Failed to log:', err);
  }
}
