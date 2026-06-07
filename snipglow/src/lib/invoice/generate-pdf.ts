// =============================================================================
// Server-side invoice PDF generation.
// Uses @react-pdf/renderer's renderToBuffer (Node.js path) to produce a real
// vector PDF without a browser. This is the same InvoiceDocument shape and
// InvoicePDF component used client-side — consistent output.
//
// Note: we import the InvoicePDF component and React here in a server context.
// @react-pdf/renderer supports this via its server/Node entry point.
// The 'use client' directive on invoice-pdf.tsx is fine — it only affects
// client bundling, not server-side imports.
// =============================================================================

import type { InvoiceDocument } from '@/app/(dashboard)/dashboard/billing/actions';

/**
 * Generate the invoice PDF as a Buffer (Node.js).
 * Returns the raw PDF bytes ready for upload or streaming.
 */
export async function generateInvoicePdfBuffer(
  doc: InvoiceDocument
): Promise<Buffer> {
  // Dynamic import so the heavy PDF renderer is only loaded when needed.
  const [{ renderToBuffer }, { InvoicePDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/app/(dashboard)/dashboard/billing/invoice-pdf'),
  ]);

  // IMPORTANT: react-pdf v4's reconciler throws "Cannot read properties of null
  // (reading 'props')" under React 19 when it's handed a *function component*
  // to reconcile. Calling InvoicePDF({ doc }) ourselves returns the underlying
  // <Document> element tree directly, which renderToBuffer renders reliably.
  const element = InvoicePDF({ doc });

  const pdfBuffer = await renderToBuffer(element as any);

  return Buffer.from(pdfBuffer);
}
