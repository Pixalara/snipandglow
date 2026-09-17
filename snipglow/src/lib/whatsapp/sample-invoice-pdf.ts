// =============================================================================
// PII-free sample invoice PDF, used only as the example media for cloning a
// document-header template (bill_receipt_v2 / wallet_recharge_v1). It uses the
// SAME renderer as real receipts so Meta's preview looks right, but with dummy
// placeholder data — no real customer or salon details ever leak into the
// permanent template preview.
// =============================================================================

import type { InvoiceDocument } from '@/app/(dashboard)/dashboard/billing/actions';
import { generateInvoicePdfBuffer } from '@/lib/invoice/generate-pdf';

/** Render a small, dummy invoice PDF and return its bytes. */
export async function buildSampleInvoicePdf(): Promise<Buffer> {
  const doc: InvoiceDocument = {
    invoice_number: 'SAMPLE-0001',
    created_at: new Date().toISOString(),
    payment_method: 'cash',
    payment_status: 'paid',
    subtotal: 750,
    discount_pct: 0,
    discount_amount: 0,
    gst_rate: 0,
    gst_amount: 0,
    total: 750,
    items: [
      { service_name: 'Haircut', unit_price: 500, quantity: 1, discount_pct: 0, discount_amount: 0, line_total: 500 },
      { service_name: 'Hair Spa', unit_price: 250, quantity: 1, discount_pct: 0, discount_amount: 0, line_total: 250 },
    ],
    customer: { name: 'Sample Customer', phone: null, email: null },
    salon: {
      name: 'Sample Salon',
      legal_name: null,
      trade_name: null,
      address: null,
      phone: null,
      email: null,
      gst_number: null,
    },
    invoice_type: 'service',
  };

  return generateInvoicePdfBuffer(doc);
}
