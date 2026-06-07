// =============================================================================
// Shared bill-receipt sender (single source of truth).
//
// Both the billing page (createInvoice) and the appointment-completion flow
// send the customer their bill the SAME way:
//   1. Generate + upload the invoice PDF (bounded by a timeout).
//   2. Send `bill_receipt_v2` with the PDF as a DOCUMENT HEADER so the file
//      rides inside the same message. Falls back to `bill_receipt_v1` (text)
//      if v2 is rejected or the PDF is unavailable.
//   3. Send `feedback_request_v1` (the single rating ask).
//   4. Write an `awaiting_feedback` customer session so the "Rate Now" tap
//      routes back to the correct tenant.
//
// Keeping this in one place prevents the two callers from drifting apart.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { sendMessage } from '@/lib/whatsapp/templates';
import { generateInvoicePdfBuffer } from '@/lib/invoice/generate-pdf';
import { uploadInvoicePdf } from '@/lib/invoice/upload-invoice';
import type { InvoiceDocument } from '@/app/(dashboard)/dashboard/billing/actions';

export interface BillReceiptItem {
  service_name: string;
  unit_price: number;
  quantity: number;
}

export interface SendBillReceiptInput {
  tenantId: string;
  customerId: string;
  items: BillReceiptItem[];
  invoiceNumber: string;
  total: number;
  paymentMethod: string;
}

const PDF_TIMEOUT_MS = 8000;

/**
 * Build the full InvoiceDocument for PDF rendering using the admin client.
 * Returns null if the invoice can't be found.
 */
async function buildInvoiceDocument(
  tenantId: string,
  invoiceNumber: string
): Promise<InvoiceDocument | null> {
  const admin = createAdminClient();

  const { data: invFull } = await (admin
    .from('invoices' as any)
    .select('id, invoice_number, created_at, payment_method, payment_status, subtotal, discount_pct, discount_amount, gst_rate, gst_amount, total, customer_id, branch_id')
    .eq('invoice_number', invoiceNumber)
    .eq('tenant_id', tenantId)
    .maybeSingle() as any);

  if (!invFull) return null;

  const [itemsRes, custRes, tenantRes, branchRes] = await Promise.all([
    admin.from('invoice_items').select('service_name, unit_price, quantity, line_total').eq('invoice_id', invFull.id),
    admin.from('customers').select('name, phone, email').eq('id', invFull.customer_id).single(),
    admin.from('tenants').select('name, phone, settings').eq('id', tenantId).single(),
    invFull.branch_id
      ? admin.from('branches').select('name, address, phone').eq('id', invFull.branch_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const settings = ((tenantRes.data?.settings as Record<string, unknown>) ?? {});
  const custData = (custRes.data as { name: string; phone: string | null; email: string | null } | null);
  const branchData = (branchRes.data as { name: string; address: string | null; phone: string | null } | null);

  return {
    invoice_number: invFull.invoice_number,
    created_at: invFull.created_at ?? new Date().toISOString(),
    payment_method: invFull.payment_method ?? 'cash',
    payment_status: invFull.payment_status ?? 'paid',
    subtotal: invFull.subtotal ?? 0,
    discount_pct: invFull.discount_pct ?? 0,
    discount_amount: invFull.discount_amount ?? 0,
    gst_rate: invFull.gst_rate ?? 0,
    gst_amount: invFull.gst_amount ?? 0,
    total: invFull.total ?? 0,
    items: (itemsRes.data ?? []).map((it: any) => ({
      service_name: it.service_name,
      unit_price: it.unit_price,
      quantity: it.quantity,
      line_total: it.line_total ?? it.unit_price * it.quantity,
    })),
    customer: {
      name: custData?.name ?? '—',
      phone: custData?.phone ?? null,
      email: custData?.email ?? null,
    },
    salon: {
      name: (tenantRes.data?.name as string) ?? 'Salon',
      legal_name: (settings.legal_name as string) ?? null,
      trade_name: (settings.trade_name as string) ?? null,
      address: branchData?.address ?? null,
      phone: branchData?.phone ?? (tenantRes.data?.phone as string) ?? null,
      email: (settings.email as string) ?? null,
      gst_number: (settings.gst_number as string) ?? null,
    },
  };
}

/**
 * Generate + upload the invoice PDF, bounded by a timeout so a slow render can
 * never starve the rest of the bill flow. Returns the public URL or null.
 */
async function generateAndUploadPdf(
  tenantId: string,
  invoiceNumber: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const invoiceDoc = await buildInvoiceDocument(tenantId, invoiceNumber);
    if (!invoiceDoc) return { url: null, error: 'invoice not found for PDF' };

    const pdfWork = (async () => {
      const pdfBuffer = await generateInvoicePdfBuffer(invoiceDoc);
      return uploadInvoicePdf(tenantId, invoiceNumber, pdfBuffer);
    })();
    const timeout = new Promise<{ ok: false; error: string }>((resolve) =>
      setTimeout(() => resolve({ ok: false, error: 'PDF generation timed out' }), PDF_TIMEOUT_MS)
    );
    const uploadResult = await Promise.race([pdfWork, timeout]);

    if (uploadResult.ok) return { url: uploadResult.url, error: null };
    return { url: null, error: uploadResult.error };
  } catch (err) {
    return { url: null, error: `PDF generation error: ${String(err)}` };
  }
}

/**
 * Send the bill receipt (with PDF when possible) + feedback request, and write
 * the awaiting_feedback session. Best-effort: never throws.
 */
export async function sendBillReceiptWithPdf(input: SendBillReceiptInput): Promise<void> {
  const { tenantId, customerId, items, invoiceNumber, total, paymentMethod } = input;

  try {
    console.log('[BillReceipt] Starting for customer:', customerId, 'tenant:', tenantId);
    const admin = createAdminClient();
    const credentials = getPlatformCredentials();
    if (!credentials) {
      console.log('[BillReceipt] No credentials found');
      return;
    }

    const { data: customer } = await admin
      .from('customers')
      .select('name, phone')
      .eq('id', customerId)
      .single();

    if (!customer?.phone) {
      console.log('[BillReceipt] Customer has no phone');
      return;
    }

    const { data: tenant } = await (admin.from('tenants' as any).select('name, tenant_code').eq('id', tenantId).single() as any);
    const salonName = ((tenant?.name as string) || 'the salon').trim();

    // Generate + upload the PDF (best-effort, time-bounded).
    const { url: pdfDownloadUrl, error: pdfGenError } = await generateAndUploadPdf(tenantId, invoiceNumber);
    if (pdfDownloadUrl) {
      console.log('[BillReceipt] PDF uploaded:', pdfDownloadUrl);
    } else {
      console.error('[BillReceipt] PDF unavailable:', pdfGenError);
    }

    const phone = customer.phone.replace(/\D/g, '');
    const serviceList = items.map((s) => s.service_name).join(', ');
    const bodyParameters = [
      { type: 'text', text: customer.name },
      { type: 'text', text: salonName },
      { type: 'text', text: invoiceNumber },
      { type: 'text', text: serviceList },
      { type: 'text', text: String(total) },
      { type: 'text', text: paymentMethod.toUpperCase() },
    ];

    let sendResult: { success: boolean; error?: string; messageId?: string };
    let v2Error: string | null = pdfDownloadUrl ? null : (pdfGenError ?? 'no PDF URL');

    if (pdfDownloadUrl) {
      // bill_receipt_v2: PDF as DOCUMENT HEADER → file rides inside the same message.
      sendResult = await sendMessage(credentials, phone, {
        type: 'template',
        template: {
          name: 'bill_receipt_v2',
          language: { code: 'en' },
          components: [
            {
              type: 'header',
              parameters: [
                {
                  type: 'document',
                  document: { link: pdfDownloadUrl, filename: `Invoice-${invoiceNumber}.pdf` },
                },
              ],
            },
            { type: 'body', parameters: bodyParameters },
          ],
        },
      });
      console.log('[BillReceipt] v2 (with PDF) send result:', JSON.stringify(sendResult));

      if (!sendResult.success) {
        v2Error = sendResult.error ?? 'unknown v2 error';
        console.warn('[BillReceipt] v2 failed, falling back to bill_receipt_v1:', v2Error);
        sendResult = await sendMessage(credentials, phone, {
          type: 'template',
          template: {
            name: 'bill_receipt_v1',
            language: { code: 'en' },
            components: [{ type: 'body', parameters: bodyParameters }],
          },
        });
        console.log('[BillReceipt] v1 fallback send result:', JSON.stringify(sendResult));
      }
    } else {
      sendResult = await sendMessage(credentials, phone, {
        type: 'template',
        template: {
          name: 'bill_receipt_v1',
          language: { code: 'en' },
          components: [{ type: 'body', parameters: bodyParameters }],
        },
      });
      console.log('[BillReceipt] v1 (no PDF) send result:', JSON.stringify(sendResult));
    }

    // Log the bill send with diagnostics so PDF-attach issues are debuggable from the DB.
    await (admin.from('whatsapp_sessions').insert({
      tenant_id: tenantId,
      message_id: `bill_${Date.now()}`,
      phone,
      direction: 'outbound',
      template_name: v2Error ? 'bill_receipt_v1' : 'bill_receipt_v2',
      status: 'sent',
      metadata: {
        customer_name: customer.name,
        pdf_url: pdfDownloadUrl,
        v2_error: v2Error,
        send_error: sendResult.error ?? null,
      },
    } as any) as any);

    // Feedback request (single rating ask).
    // The bill above carries a PDF document header — WhatsApp must fetch and
    // process that media before delivering it, whereas this feedback template is
    // plain text and delivers instantly. Without a pause the feedback message
    // lands BEFORE the bill, which looks wrong to the customer. A short delay
    // lets the media bill arrive first.
    if (pdfDownloadUrl && !v2Error) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }

    await sendMessage(credentials, phone, {
      type: 'template',
      template: {
        name: 'feedback_request_v1',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customer.name },
              { type: 'text', text: salonName },
            ],
          },
        ],
      },
    });

    // awaiting_feedback session so "Rate Now" routes back to this tenant.
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await (admin.from('whatsapp_customer_sessions' as any).delete().eq('customer_phone', phone) as any);
    const { error: sessionErr } = await (admin.from('whatsapp_customer_sessions' as any).insert({
      tenant_id: tenantId,
      customer_phone: phone,
      mode: 'shared',
      source: 'bill_feedback',
      current_state: 'awaiting_feedback',
      booking_slug: tenant?.tenant_code || '',
      last_message_at: new Date().toISOString(),
      expires_at: expiresAt,
    }) as any);
    if (sessionErr) {
      // A failed insert here silently breaks the "Rate Now" flow (no session to
      // route the feedback tap). Surface it loudly.
      console.error('[BillReceipt] awaiting_feedback session insert FAILED:', sessionErr.message);
    }

    await (admin.from('whatsapp_sessions').insert({
      tenant_id: tenantId,
      message_id: `feedback_req_${Date.now()}`,
      phone,
      direction: 'outbound',
      template_name: 'feedback_request',
      status: 'sent',
      metadata: { customer_name: customer.name },
    } as any) as any);
  } catch (err) {
    console.error('[BillReceipt] Failed to send bill receipt via WhatsApp:', err);
  }
}
