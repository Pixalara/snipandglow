'use client';

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatINR, formatDateIN, formatTimeIST } from '@/lib/utils';
import type { InvoiceDocument } from './actions';

// =============================================================================
// Invoice PDF — built with @react-pdf/renderer so the downloaded file is a real
// vector PDF (single page, no browser print dialog, no headers/footers).
// Mirrors the on-screen preview: white sheet, black body, red accents,
// brand-gradient header (approximated with solid brand tones), dark item header.
// Works identically on web, mobile and tablet.
// =============================================================================

// react-pdf renders ₹ inconsistently across platforms; use "Rs." for safety.
function rs(amount: number): string {
  return formatINR(amount).replace(/₹\s?/g, 'Rs. ');
}

const BRAND = '#a21caf'; // fuchsia/violet brand tone (solid; gradients not supported)
const PINK = '#db2777';
const RED = '#e11d48';
const DARK = '#111827';
const BLACK = '#000000';
const GREY = '#525252';

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: BLACK,
    backgroundColor: '#ffffff',
  },
  sheet: {
    borderRadius: 10,
    overflow: 'hidden',
    border: '1pt solid #eaeaea',
  },
  // Header
  header: {
    backgroundColor: BRAND,
    paddingVertical: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  salonName: { color: '#ffffff', fontSize: 18, fontFamily: 'Helvetica-Bold' },
  salonMeta: { color: '#f3e8ff', fontSize: 8, marginTop: 2 },
  invoiceTitle: { color: '#ffffff', fontSize: 22, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  invoiceNo: { color: '#f3e8ff', fontSize: 9, marginTop: 3, textAlign: 'right' },
  // Meta row
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottom: '1pt solid #f0f0f0',
  },
  metaBlock: { flexGrow: 1, flexBasis: 0 },
  metaLabel: { color: RED, fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { color: BLACK, fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  metaSub: { color: GREY, fontSize: 8.5, marginTop: 1 },
  // Items table
  body: { paddingVertical: 18, paddingHorizontal: 24 },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: DARK,
    borderRadius: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  th: { color: '#ffffff', fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottom: '1pt solid #f2f2f2',
  },
  colService: { flexGrow: 3, flexBasis: 0 },
  colQty: { flexGrow: 1, flexBasis: 0, textAlign: 'center' },
  colRate: { flexGrow: 1.4, flexBasis: 0, textAlign: 'right' },
  colAmount: { flexGrow: 1.4, flexBasis: 0, textAlign: 'right' },
  tdName: { color: BLACK, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  td: { color: GREY, fontSize: 10 },
  tdAmount: { color: BLACK, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  // Totals
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
  totals: { width: '48%' },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLabel: { color: GREY, fontSize: 10 },
  totalValue: { color: BLACK, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  discountLabel: { color: RED, fontSize: 10 },
  discountValue: { color: RED, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginVertical: 6 },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: PINK,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  grandTotalText: { color: '#ffffff', fontSize: 13, fontFamily: 'Helvetica-Bold' },
  // Footer
  footer: {
    borderTop: '1pt solid #f0f0f0',
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  footerThanks: { color: BLACK, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  footerNote: { color: GREY, fontSize: 8.5, marginTop: 3 },
  footerBrand: { color: RED, fontSize: 7, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1.5 },
});

export function InvoicePDF({ doc }: { doc: InvoiceDocument }) {
  const date = new Date(doc.created_at);
  const statusColor =
    doc.payment_status === 'paid' ? '#059669'
      : doc.payment_status === 'partial' ? '#d97706'
        : '#dc2626';

  return (
    <Document title={`Invoice ${doc.invoice_number}`} author={doc.salon.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.salonName}>{doc.salon.name}</Text>
              {doc.salon.address ? <Text style={styles.salonMeta}>{doc.salon.address}</Text> : null}
              {doc.salon.phone ? <Text style={styles.salonMeta}>Phone: {doc.salon.phone}</Text> : null}
              {doc.salon.email ? <Text style={styles.salonMeta}>Email: {doc.salon.email}</Text> : null}
              {doc.salon.gst_number ? <Text style={styles.salonMeta}>GSTIN: {doc.salon.gst_number}</Text> : null}
            </View>
            <View>
              <Text style={styles.invoiceTitle}>INVOICE</Text>
              <Text style={styles.invoiceNo}>{doc.invoice_number}</Text>
            </View>
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Billed To</Text>
              <Text style={styles.metaValue}>{doc.customer.name}</Text>
              {doc.customer.phone ? <Text style={styles.metaSub}>{doc.customer.phone}</Text> : null}
              {doc.customer.email ? <Text style={styles.metaSub}>{doc.customer.email}</Text> : null}
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Date Issued</Text>
              <Text style={styles.metaValue}>{formatDateIN(date)}</Text>
              <Text style={styles.metaSub}>{formatTimeIST(date)}</Text>
            </View>
            <View style={[styles.metaBlock, { alignItems: 'flex-end' }]}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text style={[styles.metaValue, { color: statusColor, textTransform: 'uppercase' }]}>
                {doc.payment_status}
              </Text>
              <Text style={[styles.metaSub, { textTransform: 'uppercase' }]}>via {doc.payment_method}</Text>
            </View>
          </View>

          {/* Items */}
          <View style={styles.body}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colService]}>Service</Text>
              <Text style={[styles.th, styles.colQty]}>Qty</Text>
              <Text style={[styles.th, styles.colRate]}>Rate</Text>
              <Text style={[styles.th, styles.colAmount]}>Amount</Text>
            </View>

            {doc.items.map((it, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={[styles.tdName, styles.colService]}>{it.service_name}</Text>
                <Text style={[styles.td, styles.colQty]}>{it.quantity}</Text>
                <Text style={[styles.td, styles.colRate]}>{rs(it.unit_price)}</Text>
                <Text style={[styles.tdAmount, styles.colAmount]}>{rs(it.line_total)}</Text>
              </View>
            ))}

            {/* Totals */}
            <View style={styles.totalsWrap}>
              <View style={styles.totals}>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>{rs(doc.subtotal)}</Text>
                </View>
                {doc.discount_amount > 0 ? (
                  <View style={styles.totalLine}>
                    <Text style={styles.discountLabel}>
                      Discount{doc.discount_pct > 0 ? ` (${doc.discount_pct}%)` : ''}
                    </Text>
                    <Text style={styles.discountValue}>- {rs(doc.discount_amount)}</Text>
                  </View>
                ) : null}
                {doc.gst_amount > 0 ? (
                  <View style={styles.totalLine}>
                    <Text style={styles.totalLabel}>GST{doc.gst_rate > 0 ? ` (${doc.gst_rate}%)` : ''}</Text>
                    <Text style={styles.totalValue}>{rs(doc.gst_amount)}</Text>
                  </View>
                ) : null}
                <View style={styles.divider} />
                <View style={styles.grandTotal}>
                  <Text style={styles.grandTotalText}>Total</Text>
                  <Text style={styles.grandTotalText}>{rs(doc.total)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerThanks}>Thank you for choosing {doc.salon.name}!</Text>
            <Text style={styles.footerNote}>This is a computer-generated invoice and does not require a signature.</Text>
            <Text style={styles.footerBrand}>Powered by SnipandGlow</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
