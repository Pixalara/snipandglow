import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { formatINR, formatDateIN, amountInWordsINR } from '@/lib/utils';
import { formatHours } from '@/lib/attendance';
import type { PayslipDocument } from './payslip-actions';

// =============================================================================
// Payslip PDF — built with @react-pdf/renderer so the download is a real vector
// PDF (single page, no browser print dialog, no page headers or footers).
//
// NOTE: this file intentionally has NO 'use client' directive, for the same
// reason as billing/invoice-pdf.tsx. It is a plain @react-pdf document component
// with no client hooks, so it can be rendered from BOTH the client
// (pdf().toBlob(), for the download button) and the server (renderToBuffer, if
// payslips are ever emailed or sent over WhatsApp). Marking it 'use client'
// would turn it into a client reference the server can only hold as an opaque
// proxy, and server rendering would throw.
// =============================================================================

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  try {
    // Server-side there is no request origin, and on Vercel `public/` is not on
    // the serverless filesystem — it is only served over the CDN. So register an
    // absolute HTTPS url there. In the browser a relative path resolves against
    // the page origin.
    const fontBase =
      typeof window === 'undefined'
        ? (
            process.env.NEXT_PUBLIC_SITE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            'https://www.snipandglow.com'
          ).replace(/\/$/, '')
        : '';
    Font.register({
      family: 'Roboto',
      fonts: [
        { src: `${fontBase}/fonts/Roboto-Regular.ttf`, fontWeight: 'normal' },
        { src: `${fontBase}/fonts/Roboto-Bold.ttf`, fontWeight: 'bold' },
      ],
    });
    // The rupee sign should never be a line-break opportunity.
    Font.registerHyphenationCallback((word) => [word]);
    fontsRegistered = true;
  } catch {
    // If registration fails we fall back to built-in Helvetica.
  }
}

// Solid fills only — react-pdf does not support gradients.
// Green to match the Payroll module's own accent, rather than the invoice
// fuchsia, so the two documents are not mistaken for each other.
const BRAND = '#047857';
const BRAND_SOFT = '#d1fae5';
const DARK = '#111827';
const BLACK = '#000000';
const GREY = '#525252';
const LIGHT = '#f9fafb';
const LINE = '#e5e7eb';
const RED = '#dc2626';

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    fontSize: 10,
    fontFamily: 'Roboto',
    color: BLACK,
    backgroundColor: '#ffffff',
  },
  sheet: { borderRadius: 10, overflow: 'hidden', border: '1pt solid #eaeaea' },

  // Header
  header: {
    backgroundColor: BRAND,
    paddingVertical: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  salonName: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  salonMeta: { color: BRAND_SOFT, fontSize: 8, marginTop: 2 },
  docTitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', textAlign: 'right' },
  docPeriod: { color: '#ffffff', fontSize: 10, marginTop: 3, textAlign: 'right' },
  docNo: { color: BRAND_SOFT, fontSize: 8, marginTop: 2, textAlign: 'right' },

  // Employee / period meta
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottom: `1pt solid ${LINE}`,
  },
  metaBlock: { flexGrow: 1, flexBasis: 0, paddingRight: 10 },
  metaLabel: {
    color: BRAND,
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: { color: BLACK, fontSize: 11, fontWeight: 'bold', marginTop: 3 },
  metaSub: { color: GREY, fontSize: 8.5, marginTop: 1 },

  body: { paddingVertical: 16, paddingHorizontal: 24 },

  sectionLabel: {
    color: BRAND,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 7,
  },

  // Attendance stat strip
  statStrip: { flexDirection: 'row', marginBottom: 16 },
  statBox: {
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: LIGHT,
    borderRadius: 5,
    border: `1pt solid ${LINE}`,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginRight: 6,
  },
  statBoxLast: { marginRight: 0 },
  statValue: { color: DARK, fontSize: 13, fontWeight: 'bold' },
  statLabel: { color: GREY, fontSize: 7, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Tables
  tableHead: {
    flexDirection: 'row',
    backgroundColor: DARK,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  th: { color: '#ffffff', fontSize: 7.5, fontWeight: 'bold', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderBottom: `1pt solid #f2f2f2`,
  },
  td: { color: GREY, fontSize: 9.5 },
  tdStrong: { color: BLACK, fontSize: 9.5, fontWeight: 'bold' },

  // Rate band columns
  colDesc: { flexGrow: 2.6, flexBasis: 0 },
  colDays: { flexGrow: 1, flexBasis: 0, textAlign: 'center' },
  colHours: { flexGrow: 1.3, flexBasis: 0, textAlign: 'right' },
  colRate: { flexGrow: 1.2, flexBasis: 0, textAlign: 'right' },
  colAmount: { flexGrow: 1.4, flexBasis: 0, textAlign: 'right' },

  // Earnings columns
  colItem: { flexGrow: 3, flexBasis: 0 },
  colValue: { flexGrow: 1.4, flexBasis: 0, textAlign: 'right' },

  noteBox: {
    backgroundColor: '#fffbeb',
    border: '1pt solid #fde68a',
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  noteText: { color: '#92400e', fontSize: 8, lineHeight: 1.4 },

  emptyBox: {
    backgroundColor: LIGHT,
    border: `1pt solid ${LINE}`,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  emptyText: { color: GREY, fontSize: 8.5 },

  // Net pay
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BRAND,
    borderRadius: 5,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  netLabel: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  netValue: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  wordsBox: {
    backgroundColor: LIGHT,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginTop: 7,
  },
  wordsLabel: { color: GREY, fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.4 },
  wordsValue: { color: BLACK, fontSize: 9, fontWeight: 'bold', marginTop: 2, lineHeight: 1.4 },

  // Signature
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 },
  signBlock: { width: '40%' },
  signLine: { borderTop: `1pt solid ${GREY}`, marginBottom: 3 },
  signLabel: { color: GREY, fontSize: 7.5, textAlign: 'center' },

  // Footer
  footer: {
    borderTop: `1pt solid ${LINE}`,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  footerNote: { color: GREY, fontSize: 8, textAlign: 'center', lineHeight: 1.4 },
  footerBrand: {
    color: BRAND,
    fontSize: 7,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});

export function PayslipPDF({ doc }: { doc: PayslipDocument }) {
  ensureFonts();

  const paid = doc.payment.status === 'paid';
  const statusColor = paid ? '#059669' : '#d97706';
  const { attendance, earnings, period } = doc;

  return (
    <Document
      title={`Payslip ${doc.payslip_number} — ${doc.employee.name}`}
      author={doc.salon.name}
      subject={`Salary slip for ${period.label}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.sheet}>
          {/* ── Header ─────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.salonName}>{doc.salon.trade_name || doc.salon.name}</Text>
              {doc.salon.legal_name ? (
                <Text style={styles.salonMeta}>{doc.salon.legal_name}</Text>
              ) : null}
              {doc.salon.address ? <Text style={styles.salonMeta}>{doc.salon.address}</Text> : null}
              {doc.salon.phone ? (
                <Text style={styles.salonMeta}>Phone: {doc.salon.phone}</Text>
              ) : null}
              {doc.salon.email ? (
                <Text style={styles.salonMeta}>Email: {doc.salon.email}</Text>
              ) : null}
              {doc.salon.gst_number ? (
                <Text style={styles.salonMeta}>GSTIN: {doc.salon.gst_number}</Text>
              ) : null}
            </View>
            <View>
              <Text style={styles.docTitle}>PAYSLIP</Text>
              <Text style={styles.docPeriod}>{period.label}</Text>
              <Text style={styles.docNo}>{doc.payslip_number}</Text>
            </View>
          </View>

          {/* ── Employee / period / status ──────────────────────────────── */}
          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Employee</Text>
              <Text style={styles.metaValue}>{doc.employee.name}</Text>
              <Text style={[styles.metaSub, { textTransform: 'capitalize' }]}>
                {doc.employee.role}
              </Text>
              {doc.employee.phone ? (
                <Text style={styles.metaSub}>{doc.employee.phone}</Text>
              ) : null}
              <Text style={styles.metaSub}>ID: {doc.employee.code}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Pay Period</Text>
              <Text style={styles.metaValue}>{period.label}</Text>
              {/* Stated explicitly so there is no doubt the month is counted
                  from the 1st to the last day. */}
              <Text style={styles.metaSub}>
                {formatDateIN(period.start)} to {formatDateIN(period.end)}
              </Text>
              <Text style={styles.metaSub}>{period.calendar_days} calendar days</Text>
            </View>
            <View style={[styles.metaBlock, { alignItems: 'flex-end', paddingRight: 0 }]}>
              <Text style={styles.metaLabel}>Payment</Text>
              <Text style={[styles.metaValue, { color: statusColor, textTransform: 'uppercase' }]}>
                {paid ? 'Paid' : 'Pending'}
              </Text>
              {doc.payment.method ? (
                <Text style={[styles.metaSub, { textTransform: 'capitalize' }]}>
                  via {doc.payment.method.replace(/_/g, ' ')}
                </Text>
              ) : null}
              {doc.payment.paid_date ? (
                <Text style={styles.metaSub}>{formatDateIN(doc.payment.paid_date)}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.body}>
            {/* ── Attendance summary ───────────────────────────────────── */}
            <Text style={styles.sectionLabel}>Attendance Summary</Text>

            <View style={styles.statStrip}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{attendance.days_worked}</Text>
                <Text style={styles.statLabel}>Days Worked</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatHours(attendance.total_hours)}</Text>
                <Text style={styles.statLabel}>Total Hours</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {formatINR(
                    attendance.effective_hourly_rate > 0
                      ? attendance.effective_hourly_rate
                      : doc.employee.current_hourly_rate
                  )}
                </Text>
                <Text style={styles.statLabel}>Per Hour</Text>
              </View>
              <View style={[styles.statBox, styles.statBoxLast]}>
                <Text style={styles.statValue}>
                  {attendance.days_absent + attendance.days_leave + attendance.days_week_off}
                </Text>
                <Text style={styles.statLabel}>Days Off</Text>
              </View>
            </View>

            {/* ── Hours worked, broken out by rate ─────────────────────── */}
            {attendance.rate_bands.length > 0 ? (
              <>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, styles.colDesc]}>Description</Text>
                  <Text style={[styles.th, styles.colDays]}>Days</Text>
                  <Text style={[styles.th, styles.colHours]}>Hours</Text>
                  <Text style={[styles.th, styles.colRate]}>Rate / Hr</Text>
                  <Text style={[styles.th, styles.colAmount]}>Amount</Text>
                </View>

                {attendance.rate_bands.map((band, i) => (
                  <View style={styles.tableRow} key={i}>
                    <Text style={[styles.tdStrong, styles.colDesc]}>
                      Hours worked{' '}
                      {attendance.rate_bands.length > 1 ? `at ${formatINR(band.hourly_rate)}/hr` : ''}
                    </Text>
                    <Text style={[styles.td, styles.colDays]}>{band.days}</Text>
                    <Text style={[styles.td, styles.colHours]}>{band.hours.toFixed(2)}</Text>
                    <Text style={[styles.td, styles.colRate]}>{formatINR(band.hourly_rate)}</Text>
                    <Text style={[styles.tdStrong, styles.colAmount]}>{formatINR(band.amount)}</Text>
                  </View>
                ))}

                <View style={[styles.tableRow, { borderBottom: 'none', backgroundColor: LIGHT }]}>
                  <Text style={[styles.tdStrong, styles.colDesc]}>Timesheet total</Text>
                  <Text style={[styles.tdStrong, styles.colDays]}>{attendance.days_worked}</Text>
                  <Text style={[styles.tdStrong, styles.colHours]}>
                    {attendance.total_hours.toFixed(2)}
                  </Text>
                  <Text style={[styles.td, styles.colRate]}>—</Text>
                  <Text style={[styles.tdStrong, styles.colAmount]}>
                    {formatINR(attendance.amount)}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  No attendance was recorded for this period. The salary below was entered manually.
                </Text>
              </View>
            )}

            {/* Attendance days that were never filled in either way. Worth
                surfacing: it usually means the month is incomplete. */}
            {attendance.recorded && attendance.days_unrecorded > 0 ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>
                  {attendance.days_unrecorded} of {period.calendar_days} days in this period have no
                  attendance entry. Hours and the amount above cover only the {
                    attendance.days_recorded
                  }{' '}
                  recorded days.
                </Text>
              </View>
            ) : null}

            {/* ── Earnings and deductions ──────────────────────────────── */}
            <Text style={[styles.sectionLabel, { marginTop: 18 }]}>Earnings &amp; Deductions</Text>

            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colItem]}>Particulars</Text>
              <Text style={[styles.th, styles.colValue]}>Amount</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tdStrong, styles.colItem]}>Basic pay</Text>
              <Text style={[styles.tdStrong, styles.colValue]}>
                {formatINR(earnings.base_salary)}
              </Text>
            </View>

            {earnings.bonus > 0 ? (
              <View style={styles.tableRow}>
                <Text style={[styles.td, styles.colItem]}>Bonus / incentive</Text>
                <Text style={[styles.tdStrong, styles.colValue, { color: '#059669' }]}>
                  + {formatINR(earnings.bonus)}
                </Text>
              </View>
            ) : null}

            {earnings.deductions > 0 ? (
              <View style={styles.tableRow}>
                <Text style={[styles.td, styles.colItem]}>Deductions</Text>
                <Text style={[styles.tdStrong, styles.colValue, { color: RED }]}>
                  - {formatINR(earnings.deductions)}
                </Text>
              </View>
            ) : null}

            {/* Reconciliation. Without this, a basic pay that disagrees with the
                timesheet above reads as an arithmetic error to the recipient. */}
            {earnings.differs_from_attendance ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>
                  Basic pay of {formatINR(earnings.base_salary)} was set separately and differs from
                  the timesheet total of {formatINR(attendance.amount)}
                  {earnings.base_salary > attendance.amount
                    ? ' — the difference is an agreed addition.'
                    : ' — the difference is an agreed adjustment.'}
                </Text>
              </View>
            ) : null}

            {/* ── Net pay ──────────────────────────────────────────────── */}
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net Pay</Text>
              <Text style={styles.netValue}>{formatINR(earnings.net_salary)}</Text>
            </View>

            <View style={styles.wordsBox}>
              <Text style={styles.wordsLabel}>Amount in words</Text>
              <Text style={styles.wordsValue}>{amountInWordsINR(earnings.net_salary)}</Text>
            </View>

            {doc.notes ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.metaLabel}>Remarks</Text>
                <Text style={[styles.td, { marginTop: 3 }]}>{doc.notes}</Text>
              </View>
            ) : null}

            {/* ── Signatures ───────────────────────────────────────────── */}
            <View style={styles.signRow}>
              <View style={styles.signBlock}>
                <View style={styles.signLine} />
                <Text style={styles.signLabel}>Employee Signature</Text>
              </View>
              <View style={styles.signBlock}>
                <View style={styles.signLine} />
                <Text style={styles.signLabel}>Authorised Signatory</Text>
              </View>
            </View>
          </View>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              This is a computer-generated payslip issued by {doc.salon.name} and does not require a
              signature to be valid. Generated on {formatDateIN(doc.generated_at)}.
            </Text>
            <Text style={styles.footerBrand}>Powered by SnipandGlow</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
