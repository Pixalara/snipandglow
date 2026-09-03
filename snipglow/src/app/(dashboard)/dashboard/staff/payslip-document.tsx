'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, Printer, X } from 'lucide-react';
import { formatINR, formatDateIN, amountInWordsINR } from '@/lib/utils';
import { formatHours } from '@/lib/attendance';
import { getPayslipDocument, type PayslipDocument } from './payslip-actions';

// =============================================================================
// Payslip viewer — full-screen preview with Download and Print.
//
// Mirrors billing/invoice-document.tsx: the on-screen preview is HTML (so it can
// use gradients and reflow on a phone), while Download and Print generate the
// real vector PDF from the shared `payslip-pdf.tsx` component. The renderer is
// dynamically imported so ~400kB of PDF machinery stays out of the main bundle
// until someone actually asks for a payslip.
// =============================================================================

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * On-screen preview. Deliberately a close visual match to the PDF rather than a
 * pixel-perfect one — it has to reflow on a phone, which A4 does not.
 */
function buildPreviewHTML(doc: PayslipDocument): string {
  const { attendance, earnings, period, employee, salon, payment } = doc;
  const paid = payment.status === 'paid';

  const salonLines = [
    salon.legal_name,
    salon.address,
    salon.phone ? `Phone: ${salon.phone}` : null,
    salon.email ? `Email: ${salon.email}` : null,
    salon.gst_number ? `GSTIN: ${salon.gst_number}` : null,
  ]
    .filter(Boolean)
    .map((line) => `<p style="margin:2px 0;font-size:11px;color:#d1fae5">${escapeHtml(String(line))}</p>`)
    .join('');

  const stat = (value: string, label: string) => `
    <div style="flex:1;min-width:110px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px">
      <p style="margin:0;font-size:17px;font-weight:700;color:#111827">${escapeHtml(value)}</p>
      <p style="margin:3px 0 0;font-size:9px;letter-spacing:.5px;text-transform:uppercase;color:#6b7280">${escapeHtml(label)}</p>
    </div>`;

  const bandRows = attendance.rate_bands
    .map(
      (band) => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827">
          Hours worked${attendance.rate_bands.length > 1 ? ` at ${escapeHtml(formatINR(band.hourly_rate))}/hr` : ''}
        </td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:#4b5563">${band.days}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#4b5563">${band.hours.toFixed(2)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#4b5563">${escapeHtml(formatINR(band.hourly_rate))}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:#111827">${escapeHtml(formatINR(band.amount))}</td>
      </tr>`
    )
    .join('');

  const timesheet =
    attendance.rate_bands.length > 0
      ? `
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#111827;color:#fff">
            <th style="padding:8px 12px;text-align:left;font-size:10px;letter-spacing:.4px;text-transform:uppercase">Description</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;letter-spacing:.4px;text-transform:uppercase">Days</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:.4px;text-transform:uppercase">Hours</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:.4px;text-transform:uppercase">Rate / Hr</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:.4px;text-transform:uppercase">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${bandRows}
          <tr style="background:#f9fafb">
            <td style="padding:9px 12px;font-weight:700;color:#111827">Timesheet total</td>
            <td style="padding:9px 12px;text-align:center;font-weight:700;color:#111827">${attendance.days_worked}</td>
            <td style="padding:9px 12px;text-align:right;font-weight:700;color:#111827">${attendance.total_hours.toFixed(2)}</td>
            <td style="padding:9px 12px;text-align:right;color:#9ca3af">&mdash;</td>
            <td style="padding:9px 12px;text-align:right;font-weight:700;color:#111827">${escapeHtml(formatINR(attendance.amount))}</td>
          </tr>
        </tbody>
      </table>`
      : `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center;font-size:12px;color:#6b7280">
           No attendance was recorded for this period. The salary below was entered manually.
         </div>`;

  const unrecordedNote =
    attendance.recorded && attendance.days_unrecorded > 0
      ? `<div style="margin-top:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:11px;line-height:1.5;color:#92400e">
           ${attendance.days_unrecorded} of ${period.calendar_days} days in this period have no attendance entry.
           Hours and the amount above cover only the ${attendance.days_recorded} recorded days.
         </div>`
      : '';

  const earningRow = (label: string, value: string, color?: string, strong = false) => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;${strong ? 'font-weight:600;color:#111827' : 'color:#4b5563'}">${escapeHtml(label)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:${color ?? '#111827'}">${escapeHtml(value)}</td>
    </tr>`;

  const reconcileNote = earnings.differs_from_attendance
    ? `<div style="margin-top:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:11px;line-height:1.5;color:#92400e">
         Basic pay of ${escapeHtml(formatINR(earnings.base_salary))} was set separately and differs from the
         timesheet total of ${escapeHtml(formatINR(attendance.amount))}${
           earnings.base_salary > attendance.amount
             ? ' &mdash; the difference is an agreed addition.'
             : ' &mdash; the difference is an agreed adjustment.'
         }
       </div>`
    : '';

  return `
  <div style="max-width:820px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.18);font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111827">

    <div style="background:linear-gradient(135deg,#047857,#065f46);padding:24px;display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between">
      <div style="min-width:200px">
        <h2 style="margin:0;font-size:22px;font-weight:700;color:#fff">${escapeHtml(salon.trade_name || salon.name)}</h2>
        ${salonLines}
      </div>
      <div style="text-align:right">
        <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:1px">PAYSLIP</p>
        <p style="margin:4px 0 0;font-size:13px;color:#fff">${escapeHtml(period.label)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#d1fae5">${escapeHtml(doc.payslip_number)}</p>
      </div>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between;padding:18px 24px;border-bottom:1px solid #e5e7eb">
      <div style="min-width:170px">
        <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#047857">Employee</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:700">${escapeHtml(employee.name)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280;text-transform:capitalize">${escapeHtml(employee.role)}</p>
        ${employee.phone ? `<p style="margin:2px 0 0;font-size:11px;color:#6b7280">${escapeHtml(employee.phone)}</p>` : ''}
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280">ID: ${escapeHtml(employee.code)}</p>
      </div>
      <div style="min-width:170px">
        <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#047857">Pay Period</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:700">${escapeHtml(period.label)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280">${escapeHtml(formatDateIN(period.start))} to ${escapeHtml(formatDateIN(period.end))}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280">${period.calendar_days} calendar days</p>
      </div>
      <div style="min-width:140px;text-align:right">
        <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#047857">Payment</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:700;text-transform:uppercase;color:${paid ? '#059669' : '#d97706'}">${paid ? 'Paid' : 'Pending'}</p>
        ${payment.method ? `<p style="margin:2px 0 0;font-size:11px;color:#6b7280;text-transform:capitalize">via ${escapeHtml(payment.method.replace(/_/g, ' '))}</p>` : ''}
        ${payment.paid_date ? `<p style="margin:2px 0 0;font-size:11px;color:#6b7280">${escapeHtml(formatDateIN(payment.paid_date))}</p>` : ''}
      </div>
    </div>

    <div style="padding:20px 24px">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#047857">Attendance Summary</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">
        ${stat(String(attendance.days_worked), 'Days Worked')}
        ${stat(formatHours(attendance.total_hours), 'Total Hours')}
        ${stat(formatINR(attendance.effective_hourly_rate > 0 ? attendance.effective_hourly_rate : employee.current_hourly_rate), 'Per Hour')}
        ${stat(String(attendance.days_absent + attendance.days_leave + attendance.days_week_off), 'Days Off')}
      </div>

      ${timesheet}
      ${unrecordedNote}

      <p style="margin:22px 0 10px;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#047857">Earnings &amp; Deductions</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#111827;color:#fff">
            <th style="padding:8px 12px;text-align:left;font-size:10px;letter-spacing:.4px;text-transform:uppercase">Particulars</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:.4px;text-transform:uppercase">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${earningRow('Basic pay', formatINR(earnings.base_salary), '#111827', true)}
          ${earnings.bonus > 0 ? earningRow('Bonus / incentive', `+ ${formatINR(earnings.bonus)}`, '#059669') : ''}
          ${earnings.deductions > 0 ? earningRow('Deductions', `- ${formatINR(earnings.deductions)}`, '#dc2626') : ''}
        </tbody>
      </table>
      ${reconcileNote}

      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#047857;border-radius:8px;padding:14px 18px;margin-top:14px">
        <span style="font-size:13px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#fff">Net Pay</span>
        <span style="font-size:20px;font-weight:700;color:#fff">${escapeHtml(formatINR(earnings.net_salary))}</span>
      </div>

      <div style="background:#f9fafb;border-radius:8px;padding:10px 14px;margin-top:8px">
        <p style="margin:0;font-size:9px;letter-spacing:.5px;text-transform:uppercase;color:#6b7280">Amount in words</p>
        <p style="margin:3px 0 0;font-size:12px;font-weight:700;line-height:1.5">${escapeHtml(amountInWordsINR(earnings.net_salary))}</p>
      </div>

      ${
        doc.notes
          ? `<div style="margin-top:14px">
               <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#047857">Remarks</p>
               <p style="margin:4px 0 0;font-size:12px;color:#4b5563">${escapeHtml(doc.notes)}</p>
             </div>`
          : ''
      }

      <div style="display:flex;justify-content:space-between;gap:24px;margin-top:34px">
        <div style="width:40%">
          <div style="border-top:1px solid #6b7280;margin-bottom:4px"></div>
          <p style="margin:0;font-size:10px;text-align:center;color:#6b7280">Employee Signature</p>
        </div>
        <div style="width:40%">
          <div style="border-top:1px solid #6b7280;margin-bottom:4px"></div>
          <p style="margin:0;font-size:10px;text-align:center;color:#6b7280">Authorised Signatory</p>
        </div>
      </div>
    </div>

    <div style="border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center">
      <p style="margin:0;font-size:11px;line-height:1.5;color:#6b7280">
        This is a computer-generated payslip issued by ${escapeHtml(salon.name)} and does not require a
        signature to be valid. Generated on ${escapeHtml(formatDateIN(doc.generated_at))}.
      </p>
      <p style="margin:8px 0 0;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#047857">Powered by SnipandGlow</p>
    </div>
  </div>`;
}

interface PayslipDocumentModalProps {
  payrollId: string;
  /** Shown in the toolbar while the document loads. */
  employeeName: string;
  onClose: () => void;
}

export function PayslipDocumentModal({
  payrollId,
  employeeName,
  onClose,
}: PayslipDocumentModalProps) {
  const [doc, setDoc] = useState<PayslipDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState<null | 'download' | 'print'>(null);

  useEffect(() => {
    let active = true;
    getPayslipDocument(payrollId)
      .then((res) => {
        if (!active) return;
        if (res.success) setDoc(res.data);
        else setError(res.error);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[Payslip] load failed:', err);
        if (!active) return;
        setError('Could not load the payslip. Please try again.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [payrollId]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  /** A filename the owner can find again in their downloads folder. */
  const fileName = doc
    ? `Payslip-${doc.employee.name.replace(/[^A-Za-z0-9]+/g, '-')}-${doc.period.month}.pdf`
    : 'Payslip.pdf';

  /** Generate the real PDF blob via @react-pdf/renderer (client-side). */
  async function generateBlob(): Promise<Blob | null> {
    if (!doc) return null;
    const [{ pdf }, { PayslipPDF }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./payslip-pdf'),
    ]);
    return await pdf(<PayslipPDF doc={doc} />).toBlob();
  }

  async function handleDownload() {
    if (!doc || generating) return;
    setGenerating('download');
    try {
      const blob = await generateBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      console.error('[Payslip] PDF download failed:', e);
      setError('Could not generate the PDF. Please try again.');
    } finally {
      setGenerating(null);
    }
  }

  async function handlePrint() {
    if (!doc || generating) return;
    setGenerating('print');
    try {
      const blob = await generateBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      // Open the real PDF in a new tab — the native viewer offers print and save
      // without any browser page headers or footers.
      const win = window.open(url, '_blank');
      if (!win) {
        // Popup blocked — fall back to a direct download.
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      console.error('[Payslip] PDF print failed:', e);
      setError('Could not generate the PDF. Please try again.');
    } finally {
      setGenerating(null);
    }
  }

  const previewHtml = doc ? buildPreviewHTML(doc) : '';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/70 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            Payslip &middot; {doc ? doc.employee.name : employeeName}
          </p>
          {doc ? (
            <p className="truncate text-xs text-white/60">
              {doc.period.label} &middot; {formatDateIN(doc.period.start)} to{' '}
              {formatDateIN(doc.period.end)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={!doc || generating !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            {generating === 'download' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            <span className="hidden sm:inline">Download PDF</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={!doc || generating !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            {generating === 'print' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
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

      {/* Scrollable preview — a close visual match to the downloaded PDF */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="size-7 animate-spin text-white/70" />
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center">
            <p className="text-sm font-medium text-rose-600">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        )}
      </div>
    </div>,
    document.body
  );
}
