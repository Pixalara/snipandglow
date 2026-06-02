'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { formatINR, formatDateIN, formatTimeIST } from '@/lib/utils';
import { getInvoiceDocument, type InvoiceDocument } from './actions';

// =============================================================================
// Premium Invoice Document — print & download (Save as PDF) friendly.
// White background · black body text · red accents · brand gradient header.
// =============================================================================

interface Props {
  invoiceId: string;
  onClose: () => void;
}

export function InvoiceDocumentModal({ invoiceId, onClose }: Props) {
  const [doc, setDoc] = useState<InvoiceDocument | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

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

  function handlePrint() {
    window.print();
  }

  return createPortal(
    <div className="invoice-overlay fixed inset-0 z-[100] flex flex-col bg-slate-900/70 backdrop-blur-sm">
      {/* Toolbar (hidden on print) */}
      <div className="invoice-toolbar flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 print:hidden">
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

      {/* Scrollable document area */}
      <div className="invoice-scroll flex-1 overflow-y-auto p-4 sm:p-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-white/70" />
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-xl bg-white p-6 text-center text-sm text-red-600">
            {error}
          </div>
        ) : doc ? (
          <div ref={printRef} className="invoice-sheet mx-auto w-full max-w-[800px]">
            <InvoiceSheet doc={doc} />
          </div>
        ) : null}
      </div>

      {/* Print stylesheet: isolate the invoice sheet for printing / Save as PDF */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body * { visibility: hidden !important; }
          .invoice-sheet, .invoice-sheet * { visibility: visible !important; }
          .invoice-overlay {
            position: static !important;
            background: #fff !important;
            backdrop-filter: none !important;
            display: block !important;
          }
          .invoice-scroll { overflow: visible !important; padding: 0 !important; }
          .invoice-sheet {
            max-width: 100% !important;
            box-shadow: none !important;
          }
          .invoice-toolbar { display: none !important; }
        }
      `}</style>
    </div>,
    document.body
  );
}

// =============================================================================
// The printable invoice sheet
// =============================================================================

function InvoiceSheet({ doc }: { doc: InvoiceDocument }) {
  const date = new Date(doc.created_at);
  const statusColor =
    doc.payment_status === 'paid'
      ? '#059669'
      : doc.payment_status === 'partial'
        ? '#d97706'
        : '#dc2626';

  return (
    <div
      className="overflow-hidden rounded-2xl bg-white text-black shadow-2xl print:rounded-none print:shadow-none"
      style={{ colorScheme: 'light' }}
    >
      {/* Brand header band */}
      <div
        className="relative px-8 py-7 text-white"
        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 55%, #f5576c 100%)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">{doc.salon.name}</h2>
            {doc.salon.address && (
              <p className="mt-1 max-w-xs text-sm leading-snug text-white/85">{doc.salon.address}</p>
            )}
            <div className="mt-2 space-y-0.5 text-xs text-white/80">
              {doc.salon.phone && <p>Phone: {doc.salon.phone}</p>}
              {doc.salon.email && <p>Email: {doc.salon.email}</p>}
              {doc.salon.gst_number && <p>GSTIN: {doc.salon.gst_number}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black uppercase tracking-tight">Invoice</p>
            <p className="mt-1 font-mono text-sm text-white/90">{doc.invoice_number}</p>
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-4 border-b-2 border-black/5 px-8 py-5 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Billed To</p>
          <p className="mt-1 text-sm font-semibold text-black">{doc.customer.name}</p>
          {doc.customer.phone && <p className="text-xs text-neutral-600">{doc.customer.phone}</p>}
          {doc.customer.email && <p className="text-xs text-neutral-600">{doc.customer.email}</p>}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Date Issued</p>
          <p className="mt-1 text-sm font-semibold text-black">{formatDateIN(date)}</p>
          <p className="text-xs text-neutral-600">{formatTimeIST(date)}</p>
        </div>
        <div className="col-span-2 sm:col-span-1 sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Status</p>
          <p
            className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold uppercase"
            style={{ color: statusColor }}
          >
            <span className="inline-block size-2 rounded-full" style={{ background: statusColor }} />
            {doc.payment_status}
          </p>
          <p className="text-xs uppercase text-neutral-600">via {doc.payment_method}</p>
        </div>
      </div>

      {/* Items table */}
      <div className="px-8 py-6">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: '#111827' }} className="text-white">
              <th className="rounded-l-lg px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider">Service</th>
              <th className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider">Qty</th>
              <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider">Rate</th>
              <th className="rounded-r-lg px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i} className="border-b border-black/5">
                <td className="px-4 py-3 font-medium text-black">{it.service_name}</td>
                <td className="px-4 py-3 text-center text-neutral-700">{it.quantity}</td>
                <td className="px-4 py-3 text-right text-neutral-700">{formatINR(it.unit_price)}</td>
                <td className="px-4 py-3 text-right font-semibold text-black">{formatINR(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex items-center justify-between text-neutral-700">
              <span>Subtotal</span>
              <span className="font-medium text-black">{formatINR(doc.subtotal)}</span>
            </div>
            {doc.discount_amount > 0 && (
              <div className="flex items-center justify-between text-rose-600">
                <span>Discount {doc.discount_pct > 0 ? `(${doc.discount_pct}%)` : ''}</span>
                <span className="font-medium">- {formatINR(doc.discount_amount)}</span>
              </div>
            )}
            {doc.gst_amount > 0 && (
              <div className="flex items-center justify-between text-neutral-700">
                <span>GST {doc.gst_rate > 0 ? `(${doc.gst_rate}%)` : ''}</span>
                <span className="font-medium text-black">{formatINR(doc.gst_amount)}</span>
              </div>
            )}
            <div className="my-2 h-px bg-black/10" />
            <div
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-base font-extrabold text-white"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)' }}
            >
              <span>Total</span>
              <span>{formatINR(doc.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-black/5 px-8 py-5 text-center">
        <p className="text-sm font-bold text-black">Thank you for choosing {doc.salon.name}!</p>
        <p className="mt-1 text-xs text-neutral-500">
          This is a computer-generated invoice and does not require a signature.
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-widest text-rose-600">Powered by SnipandGlow</p>
      </div>
    </div>
  );
}
