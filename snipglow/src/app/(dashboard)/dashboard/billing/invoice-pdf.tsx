import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { formatINR, formatDateIN, formatTimeIST } from '@/lib/utils';
import type { InvoiceDocument } from './actions';

// =============================================================================
// Invoice PDF — built with @react-pdf/renderer so the downloaded file is a real
// vector PDF (single page, no browser print dialog, no headers/footers).
//
// NOTE: this file intentionally has NO 'use client' directive. It is a plain
// @react-pdf document component (no React client hooks), so it can be imported
// and rendered from BOTH the server (renderToBuffer, for the WhatsApp invoice
// PDF) and the client (pdf().toBlob(), for the in-app download button). Marking
// it 'use client' turns it into a client reference that the server can only
// receive as an opaque proxy — which made server-side renderToBuffer throw
// ("Attempted to call InvoicePDF() from the server").
// =============================================================================

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  try {
    // Server-side (renderToBuffer in Node) has no request origin, and on Vercel
    // the `public/` folder is NOT on the serverless function's filesystem — it's
    // only served via the CDN. So we register an ABSOLUTE HTTPS url that
    // react-pdf fetches from the deployed site. In the browser, a relative path
    // resolves against the page origin.
    const fontBase =
      typeof window === 'undefined'
        ? (process.env.NEXT_PUBLIC_SITE_URL ||
           process.env.NEXT_PUBLIC_APP_URL ||
           'https://www.snipandglow.com').replace(/\/$/, '')
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
    fontFamily: 'Roboto',
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
  salonName: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  salonMeta: { color: '#f3e8ff', fontSize: 8, marginTop: 2 },
  invoiceTitle: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', textAlign: 'right' },
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
  metaLabel: { color: RED, fontSize: 7, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { color: BLACK, fontSize: 11, fontWeight: 'bold', marginTop: 3 },
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
  th: { color: '#ffffff', fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' },
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
  tdName: { color: BLACK, fontSize: 10, fontWeight: 'bold' },
  td: { color: GREY, fontSize: 10 },
  tdAmount: { color: BLACK, fontSize: 10, fontWeight: 'bold' },
  // Totals
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
  totals: { width: '48%' },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLabel: { color: GREY, fontSize: 10 },
  totalValue: { color: BLACK, fontSize: 10, fontWeight: 'bold' },
  discountLabel: { color: RED, fontSize: 10 },
  discountValue: { color: RED, fontSize: 10, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginVertical: 6 },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: PINK,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  grandTotalText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
  // Footer
  footer: {
    borderTop: '1pt solid #f0f0f0',
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  footerThanks: { color: BLACK, fontSize: 10, fontWeight: 'bold' },
  footerNote: { color: GREY, fontSize: 8.5, marginTop: 3 },
  footerBrand: { color: RED, fontSize: 7, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1.5 },
});

export function InvoicePDF({ doc }: { doc: InvoiceDocument }) {
  ensureFonts();
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
              <Text style={styles.salonName}>{doc.salon.trade_name || doc.salon.name}</Text>
              {doc.salon.legal_name ? <Text style={styles.salonMeta}>{doc.salon.legal_name}</Text> : null}
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
              <Text style={[styles.th, styles.colService]}>Service / Product</Text>
              <Text style={[styles.th, styles.colQty]}>Qty</Text>
              <Text style={[styles.th, styles.colRate]}>Rate</Text>
              <Text style={[styles.th, styles.colAmount]}>Amount</Text>
            </View>

            {doc.items.map((it, i) => (
              <View style={styles.tableRow} key={i}>
                <View style={styles.colService}>
                  <Text style={styles.tdName}>{it.service_name}</Text>
                  {it.discount_amount > 0 ? (
                    <Text style={{ fontSize: 7, color: '#16a34a', marginTop: 1 }}>
                      {it.discount_pct}% off (- {formatINR(it.discount_amount)})
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.td, styles.colQty]}>{it.quantity}</Text>
                <Text style={[styles.td, styles.colRate]}>{formatINR(it.unit_price)}</Text>
                <Text style={[styles.tdAmount, styles.colAmount]}>{formatINR(it.line_total)}</Text>
              </View>
            ))}

            {/* Totals */}
            <View style={styles.totalsWrap}>
              <View style={styles.totals}>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>{formatINR(doc.subtotal)}</Text>
                </View>
                {doc.discount_amount > 0 ? (
                  <View style={styles.totalLine}>
                    <Text style={styles.discountLabel}>
                      Discount
                    </Text>
                    <Text style={styles.discountValue}>- {formatINR(doc.discount_amount)}</Text>
                  </View>
                ) : null}
                {doc.gst_amount > 0 ? (
                  <View style={styles.totalLine}>
                    <Text style={styles.totalLabel}>GST{doc.gst_rate > 0 ? ` (${doc.gst_rate}%)` : ''}</Text>
                    <Text style={styles.totalValue}>{formatINR(doc.gst_amount)}</Text>
                  </View>
                ) : null}
                <View style={styles.divider} />
                <View style={styles.grandTotal}>
                  <Text style={styles.grandTotalText}>Total</Text>
                  <Text style={styles.grandTotalText}>{formatINR(doc.total)}</Text>
                </View>

                {/* Wallet breakdown (service bill paid partly/fully from wallet) */}
                {doc.invoice_type !== 'wallet_recharge' && (doc.wallet_amount ?? 0) > 0 ? (
                  <View style={{ marginTop: 6 }}>
                    <View style={styles.totalLine}>
                      <Text style={styles.discountLabel}>Wallet Used</Text>
                      <Text style={styles.discountValue}>- {formatINR(doc.wallet_amount ?? 0)}</Text>
                    </View>
                    <View style={styles.totalLine}>
                      <Text style={styles.totalLabel}>Paid ({doc.payment_method})</Text>
                      <Text style={styles.totalValue}>
                        {formatINR(Math.max(0, (doc.total ?? 0) - (doc.wallet_amount ?? 0)))}
                      </Text>
                    </View>
                    {doc.wallet_balance_after != null ? (
                      <View style={styles.totalLine}>
                        <Text style={styles.totalLabel}>Wallet Balance</Text>
                        <Text style={styles.totalValue}>{formatINR(doc.wallet_balance_after)}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Wallet recharge: show the resulting balance */}
                {doc.invoice_type === 'wallet_recharge' && doc.wallet_balance_after != null ? (
                  <View style={{ marginTop: 6 }}>
                    <View style={styles.totalLine}>
                      <Text style={styles.totalLabel}>New Wallet Balance</Text>
                      <Text style={styles.totalValue}>{formatINR(doc.wallet_balance_after)}</Text>
                    </View>
                  </View>
                ) : null}
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
