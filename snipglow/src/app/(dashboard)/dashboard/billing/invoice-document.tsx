'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { formatINR, formatDateIN, formatTimeIST } from '@/lib/utils';
import { getInvoiceDocument, type InvoiceDocument } from './actions';

// =============================================================================
// Premium Invoice Document — print & download (Save as PDF) friendly.
// White background · black body text · red accents · brand gradient header.
//
// The SAME self-contained HTML string is used for both the on-screen preview
// and the print/PDF output, guaranteeing a pixel-identical result. Printing is
// done via an isolated hidden iframe so only the invoice prints (no blank
// pages from the dashboard behind it). Works on web, mobile and tablet.
// =============================================================================

interface Props {
  invoiceId: string;
  onClose: () => void;
}

function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Build the self-contained invoice sheet markup (fully inline-styled). */
function buildInvoiceSheetHTML(doc: InvoiceDocument): string {
  const date = new Date(doc.created_at);
  const statusColor =
    doc.payment_status === 'paid' ? '#059669'
      : doc.payment_status === 'partial' ? '#d97706'
        : '#dc2626';

  const itemRows = doc.items
    .map(
      (it) => `
      <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
        <td style="padding:12px 16px;font-weight:500;color:#000;">${escapeHtml(it.service_name)}</td>
        <td style="padding:12px 16px;text-align:center;color:#404040;">${it.quantity}</td>
        <td style="padding:12px 16px;text-align:right;color:#404040;">${formatINR(it.unit_price)}</td>
        <td style="padding:12px 16px;text-align:right;font-weight:600;color:#000;">${formatINR(it.line_total)}</td>
      </tr>`
    )
    .join('');

  const discountRow =
    doc.discount_amount > 0
      ? `<div style="display:flex;justify-content:space-between;color:#e11d48;padding:3px 0;">
          <span>Discount${doc.discount_pct > 0 ? ` (${doc.discount_pct}%)` : ''}</span>
          <span style="font-weight:500;">- ${formatINR(doc.discount_amount)}</span>
        </div>`
      : '';

  const gstRow =
    doc.gst_amount > 0
      ? `<div style="display:flex;justify-content:space-between;color:#404040;padding:3px 0;">
          <span>GST${doc.gst_rate > 0 ? ` (${doc.gst_rate}%)` : ''}</span>
          <span style="font-weight:500;color:#000;">${formatINR(doc.gst_amount)}</span>
        </div>`
      : '';

  const salon = doc.salon;
  const cust = doc.customer;

  return `
  <div class="invoice-sheet" style="width:100%;max-width:760px;margin:0 auto;background:#ffffff;color:#000000;border-radius:16px;overflow:hidden;font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 10px 40px rgba(0,0,0,0.18);-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <!-- Brand header -->
    <div style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 55%,#f5576c 100%);color:#ffffff;padding:28px 32px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <div>
          <div style="font-size:24px;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(salon.name)}</div>
          ${salon.address ? `<div style="margin-top:4px;max-width:280px;font-size:13px;line-height:1.4;color:rgba(255,255,255,0.85);">${escapeHtml(salon.address)}</div>` : ''}
          <div style="margin-top:8px;font-size:11px;color:rgba(255,255,255,0.82);line-height:1.7;">
            ${salon.phone ? `<div>Phone: ${escapeHtml(salon.phone)}</div>` : ''}
            ${salon.email ? `<div>Email: ${escapeHtml(salon.email)}</div>` : ''}
            ${salon.gst_number ? `<div>GSTIN: ${escapeHtml(salon.gst_number)}</div>` : ''}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;">Invoice</div>
          <div style="margin-top:4px;font-family:ui-monospace,'SFMono-Regular',Menlo,monospace;font-size:13px;color:rgba(255,255,255,0.92);">${escapeHtml(doc.invoice_number)}</div>
        </div>
      </div>
    </div>

    <!-- Meta row -->
    <div style="display:flex;flex-wrap:wrap;gap:16px;border-bottom:2px solid rgba(0,0,0,0.05);padding:20px 32px;">
      <div style="flex:1;min-width:150px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e11d48;">Billed To</div>
        <div style="margin-top:4px;font-size:14px;font-weight:600;color:#000;">${escapeHtml(cust.name)}</div>
        ${cust.phone ? `<div style="font-size:12px;color:#525252;">${escapeHtml(cust.phone)}</div>` : ''}
        ${cust.email ? `<div style="font-size:12px;color:#525252;">${escapeHtml(cust.email)}</div>` : ''}
      </div>
      <div style="flex:1;min-width:150px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e11d48;">Date Issued</div>
        <div style="margin-top:4px;font-size:14px;font-weight:600;color:#000;">${formatDateIN(date)}</div>
        <div style="font-size:12px;color:#525252;">${formatTimeIST(date)}</div>
      </div>
      <div style="flex:1;min-width:130px;text-align:right;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#e11d48;">Status</div>
        <div style="margin-top:4px;font-size:14px;font-weight:700;text-transform:uppercase;color:${statusColor};">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>${escapeHtml(doc.payment_status)}
        </div>
        <div style="font-size:12px;text-transform:uppercase;color:#737373;">via ${escapeHtml(doc.payment_method)}</div>
      </div>
    </div>

    <!-- Items -->
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:separate;border-spacing:0;font-size:14px;">
        <thead>
          <tr style="background:#111827;color:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
            <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border-radius:8px 0 0 8px;">Service</th>
            <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
            <th style="padding:11px 16px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Rate</th>
            <th style="padding:11px 16px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border-radius:0 8px 8px 0;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <div style="margin-top:24px;display:flex;justify-content:flex-end;">
        <div style="width:100%;max-width:280px;font-size:14px;">
          <div style="display:flex;justify-content:space-between;color:#404040;padding:3px 0;">
            <span>Subtotal</span><span style="font-weight:500;color:#000;">${formatINR(doc.subtotal)}</span>
          </div>
          ${discountRow}
          ${gstRow}
          <div style="height:1px;background:rgba(0,0,0,0.1);margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);color:#ffffff;border-radius:8px;padding:11px 14px;font-size:16px;font-weight:800;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
            <span>Total</span><span>${formatINR(doc.total)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:2px solid rgba(0,0,0,0.05);padding:20px 32px;text-align:center;">
      <div style="font-size:14px;font-weight:700;color:#000;">Thank you for choosing ${escapeHtml(salon.name)}!</div>
      <div style="margin-top:4px;font-size:12px;color:#737373;">This is a computer-generated invoice and does not require a signature.</div>
      <div style="margin-top:8px;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#e11d48;">Powered by SnipandGlow</div>
    </div>
  </div>`;
}

/** Print just the invoice via an isolated hidden iframe (no blank pages). */
function printInvoice(sheetHtml: string, title: string) {
  const fullDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  html, body { background:#ffffff; color:#000000; font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif; }
  body { padding:0; }
  @page { size:A4; margin:12mm; }
  @media print {
    .invoice-sheet { box-shadow:none !important; border-radius:0 !important; max-width:100% !important; }
  }
</style>
</head>
<body>${sheetHtml}</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 500);
  };

  const win = iframe.contentWindow;
  if (!win) {
    cleanup();
    return;
  }

  const idoc = win.document;
  idoc.open();
  idoc.write(fullDoc);
  idoc.close();

  // Wait for the iframe document to be ready, then print only that frame.
  const doPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      // Fallback: open a new tab with the document for manual print/save.
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(fullDoc);
        w.document.close();
        w.focus();
        w.print();
      }
    } finally {
      cleanup();
    }
  };

  // Give the browser a tick to lay out the iframe content (mobile-safe).
  if (idoc.readyState === 'complete') {
    setTimeout(doPrint, 250);
  } else {
    iframe.onload = () => setTimeout(doPrint, 250);
  }
}

export function InvoiceDocumentModal({ invoiceId, onClose }: Props) {
  const [doc, setDoc] = useState<InvoiceDocument | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getInvoiceDocument(invoiceId).then((res) => {
      if (!active) return;
      if (res.success) setDoc(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [invoiceId]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const sheetHtml = doc ? buildInvoiceSheetHTML(doc) : '';

  function handlePrint() {
    if (!doc) return;
    printInvoice(sheetHtml, `Invoice ${doc.invoice_number}`);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/70 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3">
        <p className="text-sm font-medium text-white">
          {doc ? `Invoice ${doc.invoice_number}` : 'Invoice'}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={!doc}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Download PDF</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={!doc}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-40"
          >
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Scrollable preview area — identical markup to the printed PDF */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-white/70" />
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-xl bg-white p-6 text-center text-sm text-red-600">
            {error}
          </div>
        ) : doc ? (
          <div dangerouslySetInnerHTML={{ __html: sheetHtml }} />
        ) : null}
      </div>
    </div>,
    document.body
  );
}
