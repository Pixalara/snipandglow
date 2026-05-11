import { describe, it, expect } from "vitest";
import React from "react";
import { InvoicePDF, type InvoicePDFProps } from "./invoice-pdf";

const sampleProps: InvoicePDFProps = {
  salonName: "Snip & Glow",
  branchAddress: "123 MG Road, Bengaluru 560001",
  branchPhone: "+91 9876543210",
  invoiceNumber: "INV-MGB-0001",
  invoiceDate: "10 May 2026",
  customerName: "Priya Sharma",
  customerPhone: "+91 9123456789",
  items: [
    { serviceName: "Haircut", quantity: 1, unitPrice: 300, lineTotal: 300 },
    { serviceName: "Hair Color", quantity: 1, unitPrice: 800, lineTotal: 800 },
  ],
  subtotal: 1100,
  discountPct: 10,
  discountAmount: 110,
  gstRate: 18,
  gstAmount: 178,
  total: 1068,
  paymentMethod: "cash",
};

describe("InvoicePDF", () => {
  it("renders without throwing", () => {
    expect(() => <InvoicePDF {...sampleProps} />).not.toThrow();
  });

  it("returns a valid React element", () => {
    const element = <InvoicePDF {...sampleProps} />;
    expect(element).toBeDefined();
    expect(element.type).toBe(InvoicePDF);
  });

  it("accepts props without branchPhone", () => {
    const propsWithoutPhone: InvoicePDFProps = {
      ...sampleProps,
      branchPhone: undefined,
    };
    expect(() => <InvoicePDF {...propsWithoutPhone} />).not.toThrow();
  });

  it("accepts props with zero discount", () => {
    const propsNoDiscount: InvoicePDFProps = {
      ...sampleProps,
      discountPct: 0,
      discountAmount: 0,
    };
    expect(() => <InvoicePDF {...propsNoDiscount} />).not.toThrow();
  });

  it("accepts props with zero GST", () => {
    const propsNoGst: InvoicePDFProps = {
      ...sampleProps,
      gstRate: 0,
      gstAmount: 0,
    };
    expect(() => <InvoicePDF {...propsNoGst} />).not.toThrow();
  });

  it("accepts empty items array", () => {
    const propsEmpty: InvoicePDFProps = {
      ...sampleProps,
      items: [],
      subtotal: 0,
      discountAmount: 0,
      gstAmount: 0,
      total: 0,
    };
    expect(() => <InvoicePDF {...propsEmpty} />).not.toThrow();
  });

  it("handles various payment methods", () => {
    for (const method of ["cash", "upi", "card"]) {
      const props: InvoicePDFProps = { ...sampleProps, paymentMethod: method };
      expect(() => <InvoicePDF {...props} />).not.toThrow();
    }
  });
});
