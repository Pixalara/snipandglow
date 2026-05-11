import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

// =============================================================================
// Types
// =============================================================================

export interface InvoicePDFProps {
  salonName: string;
  branchAddress: string;
  branchPhone?: string;
  invoiceNumber: string;
  invoiceDate: string; // formatted DD MMM YYYY
  customerName: string;
  customerPhone: string;
  items: {
    serviceName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  paymentMethod: string;
}

// =============================================================================
// Indian Number Formatting
// =============================================================================

/**
 * Format a number with the Indian numbering system and ₹ symbol.
 * Examples: 1500 → "₹1,500", 150000 → "₹1,50,000"
 */
function formatAmountINR(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const isWhole = Number.isInteger(absAmount);

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(absAmount);

  return isNegative ? `-${formatted}` : formatted;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: "column",
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  salonName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  branchAddress: {
    fontSize: 9,
    color: "#555555",
    maxWidth: 200,
  },
  branchPhone: {
    fontSize: 9,
    color: "#555555",
    marginTop: 2,
  },
  invoiceNumber: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  invoiceMeta: {
    fontSize: 9,
    color: "#555555",
    marginBottom: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    marginVertical: 12,
  },
  billTo: {
    marginBottom: 16,
  },
  billToLabel: {
    fontSize: 9,
    color: "#777777",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  customerName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  customerPhone: {
    fontSize: 9,
    color: "#555555",
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#333333",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eeeeee",
  },
  colService: {
    flex: 3,
  },
  colQty: {
    flex: 1,
    textAlign: "center",
  },
  colPrice: {
    flex: 1.5,
    textAlign: "right",
  },
  colTotal: {
    flex: 1.5,
    textAlign: "right",
  },
  summarySection: {
    marginTop: 16,
    alignItems: "flex-end",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
    width: 220,
  },
  summaryLabel: {
    flex: 1,
    textAlign: "right",
    paddingRight: 12,
    fontSize: 9,
    color: "#555555",
  },
  summaryValue: {
    width: 80,
    textAlign: "right",
    fontSize: 9,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#333333",
    width: 220,
  },
  totalLabel: {
    flex: 1,
    textAlign: "right",
    paddingRight: 12,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  totalValue: {
    width: 80,
    textAlign: "right",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    marginTop: 40,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: "#cccccc",
    alignItems: "center",
  },
  footerText: {
    fontSize: 9,
    color: "#777777",
    marginBottom: 4,
    textAlign: "center",
  },
});

// =============================================================================
// Invoice PDF Component
// =============================================================================

export function InvoicePDF(props: InvoicePDFProps) {
  const {
    salonName,
    branchAddress,
    branchPhone,
    invoiceNumber,
    invoiceDate,
    customerName,
    customerPhone,
    items,
    subtotal,
    discountPct,
    discountAmount,
    gstRate,
    gstAmount,
    total,
    paymentMethod,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header: Salon info + Invoice meta */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.salonName}>{salonName}</Text>
            <Text style={styles.branchAddress}>{branchAddress}</Text>
            {branchPhone && (
              <Text style={styles.branchPhone}>Tel: {branchPhone}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>Date: {invoiceDate}</Text>
            <Text style={styles.invoiceMeta}>
              Payment: {paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To */}
        <View style={styles.billTo}>
          <Text style={styles.billToLabel}>Bill To</Text>
          <Text style={styles.customerName}>{customerName}</Text>
          <Text style={styles.customerPhone}>{customerPhone}</Text>
        </View>

        {/* Items Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colService]}>
            Service
          </Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.colPrice]}>Price</Text>
          <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
        </View>

        {/* Items Table Rows */}
        {items.map((item, index) => (
          <View style={styles.tableRow} key={index}>
            <Text style={styles.colService}>{item.serviceName}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>{formatAmountINR(item.unitPrice)}</Text>
            <Text style={styles.colTotal}>{formatAmountINR(item.lineTotal)}</Text>
          </View>
        ))}

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>{formatAmountINR(subtotal)}</Text>
          </View>

          {discountPct > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Membership ({discountPct}%):
              </Text>
              <Text style={styles.summaryValue}>
                -{formatAmountINR(discountAmount)}
              </Text>
            </View>
          )}

          {gstRate > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GST ({gstRate}%):</Text>
              <Text style={styles.summaryValue}>
                +{formatAmountINR(gstAmount)}
              </Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>{formatAmountINR(total)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thank you for visiting {salonName}!
          </Text>
          {branchPhone && (
            <Text style={styles.footerText}>
              Book your next appointment via WhatsApp: {branchPhone}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}

export default InvoicePDF;
