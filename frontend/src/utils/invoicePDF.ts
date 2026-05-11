// PingFlow — Invoice PDF Generator
// Generates a print-ready invoice in a new window using vanilla HTML/CSS
// No external PDF library needed — uses browser's window.print()

import type { Payment, BillingSettings } from '@/types';
import { formatINR, formatDateIN, formatPeriod } from '@/utils/billing.utils';

/**
 * Generate and open a printable invoice for a payment
 * @param gymName - Override for gym name (use actual gym name, not billing settings)
 */
export function generateInvoice(payment: Payment, settings: BillingSettings, gymName?: string, logoUrl?: string): void {
  const effectiveSettings = gymName ? { ...settings, gymName } : settings;
  const invoiceHTML = buildInvoiceHTML(payment, effectiveSettings, logoUrl);
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) {
    alert('Please allow popups to generate invoices.');
    return;
  }
  printWindow.document.write(invoiceHTML);
  printWindow.document.close();
}

function buildInvoiceHTML(payment: Payment, settings: BillingSettings, logoUrl?: string): string {
  const gstNote = settings.gstin
    ? `<div style="font-size:11px;color:#64748B;margin-top:2px;">GSTIN: ${settings.gstin}</div>`
    : '';

  const hsnRow = settings.hsnCode
    ? `<tr>
        <td style="padding:6px 0;color:#64748B;font-size:12px;">HSN Code</td>
        <td style="padding:6px 0;text-align:right;color:#111827;font-size:12px;">${settings.hsnCode}</td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${payment.invoiceNumber} — ${settings.gymName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', sans-serif;
      background: #FFFFFF;
      color: #111827;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    @media print {
      html, body {
        padding: 0;
        margin: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body { padding: 32px; }
      .no-print { display: none !important; }
      /* Setting margin to 0 removes browser header/footer (date, URL, page number) */
      @page {
        size: A4;
        margin: 0;
      }
    }

    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 2px solid #E5E7EB;
      margin-bottom: 24px;
    }

    .gym-name {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: #111827;
    }

    .invoice-title {
      font-family: 'Outfit', sans-serif;
      font-size: 28px;
      font-weight: 700;
      color: #E11D48;
      text-align: right;
    }

    .section-title {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: #94A3B8;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }

    .info-block p {
      font-size: 13px;
      color: #374151;
      line-height: 1.6;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }

    .items-table thead th {
      background: #F8FAFC;
      padding: 10px 14px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #E5E7EB;
    }

    .items-table thead th:last-child {
      text-align: right;
    }

    .items-table tbody td {
      padding: 12px 14px;
      font-size: 13px;
      color: #111827;
      border-bottom: 1px solid #F3F4F6;
    }

    .items-table tbody td:last-child {
      text-align: right;
      font-weight: 600;
    }

    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 32px;
    }

    .totals-table {
      width: 280px;
    }

    .totals-table td {
      padding: 6px 0;
      font-size: 13px;
    }

    .totals-table .total-row td {
      padding-top: 10px;
      border-top: 2px solid #111827;
      font-size: 16px;
      font-weight: 700;
    }

    .footer {
      border-top: 1px solid #E5E7EB;
      padding-top: 20px;
      text-align: center;
      color: #94A3B8;
      font-size: 11px;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .print-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #E11D48;
      color: white;
      border: none;
      padding: 12px 28px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 4px 12px rgba(225,29,72,0.3);
    }
  </style>
</head>
<body>
  <div class="invoice-header">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" alt="${settings.gymName}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;margin-bottom:8px;" />` : ''}
      <div class="gym-name">${settings.gymName}</div>
      <div style="font-size:12px;color:#64748B;margin-top:4px;max-width:260px;line-height:1.5;">
        ${settings.gymAddress || ''}<br/>
        ${settings.gymPhone || ''}
      </div>
      ${gstNote}
    </div>
    <div style="text-align:right;">
      <div class="invoice-title">INVOICE</div>
      <div style="font-size:13px;color:#374151;margin-top:6px;">
        <strong>${payment.invoiceNumber}</strong>
      </div>
      <div style="font-size:12px;color:#64748B;margin-top:2px;">
        Date: ${formatDateIN(payment.invoiceDate)}
      </div>
      <div style="margin-top:8px;">
        <span class="status-badge" style="background:${payment.status === 'paid' ? 'rgba(0,208,132,0.12)' : payment.status === 'partial' ? 'rgba(59,130,246,0.12)' : payment.status === 'overdue' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'};color:${payment.status === 'paid' ? '#00D084' : payment.status === 'partial' ? '#3B82F6' : payment.status === 'overdue' ? '#EF4444' : '#F59E0B'};">
          ${payment.status.toUpperCase()}
        </span>
      </div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <div class="section-title">Bill To</div>
      <p><strong>${payment.memberName}</strong></p>
      <p>${payment.memberPhone}</p>
    </div>
    <div class="info-block" style="text-align:right;">
      <div class="section-title">Membership Period</div>
      <p>${formatPeriod(payment.membershipStartDate, payment.membershipEndDate)}</p>
      <p style="font-size:12px;color:#64748B;margin-top:2px;">Due: ${formatDateIN(payment.dueDate)}</p>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div style="font-weight:600;">${payment.planName}</div>
          <div style="font-size:11px;color:#64748B;margin-top:2px;">${payment.planDurationDays} days membership</div>
        </td>
        <td>${formatINR(payment.subtotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals-section">
    <table class="totals-table">
      <tr>
        <td style="color:#64748B;">Subtotal</td>
        <td style="text-align:right;font-weight:500;">${formatINR(payment.subtotal)}</td>
      </tr>
      ${hsnRow}
      <tr>
        <td style="color:#64748B;">GST (${payment.gstRate}%)</td>
        <td style="text-align:right;font-weight:500;">${formatINR(payment.gstAmount)}</td>
      </tr>
      <tr class="total-row">
        <td>Total</td>
        <td style="text-align:right;">${formatINR(payment.totalAmount)}</td>
      </tr>
      <tr>
        <td style="color:#64748B;">Paid</td>
        <td style="text-align:right;font-weight:500;color:#00D084;">${formatINR(payment.paidAmount)}</td>
      </tr>
      ${payment.balanceDue > 0 ? `
      <tr>
        <td style="color:#EF4444;font-weight:600;">Balance Due</td>
        <td style="text-align:right;font-weight:700;color:#EF4444;">${formatINR(payment.balanceDue)}</td>
      </tr>` : ''}
    </table>
  </div>

  ${payment.notes ? `
  <div style="margin-bottom:24px;">
    <div class="section-title">Notes</div>
    <p style="font-size:12px;color:#374151;line-height:1.6;">${payment.notes}</p>
  </div>` : ''}

  ${payment.paymentMode === 'upi' && payment.upiTransactionId ? `
  <div style="margin-bottom:24px;">
    <div class="section-title">Payment Details</div>
    <p style="font-size:12px;color:#374151;">UPI Transaction ID: ${payment.upiTransactionId}</p>
  </div>` : ''}

  <div class="footer">
    <p>Thank you for choosing ${settings.gymName}!</p>
    <p style="margin-top:4px;">This is a computer-generated invoice.</p>
  </div>

  <button class="print-btn no-print" onclick="window.print()">🖨️ Print Invoice</button>
</body>
</html>`;
}
