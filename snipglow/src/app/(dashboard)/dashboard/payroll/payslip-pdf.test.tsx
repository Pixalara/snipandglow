import { describe, it, expect } from 'vitest';
import { PayslipPDF } from './payslip-pdf';
import type { PayslipDocument } from './payslip-actions';
import { formatDateIN } from '@/lib/utils';

// =============================================================================
// These tests CALL the component rather than just building JSX for it.
//
// `<PayslipPDF doc={...} />` on its own only creates an element — the function
// body never runs, so an assertion that it "does not throw" can never fail.
// Invoking `PayslipPDF({ doc })` directly executes every conditional, every
// currency format and the words conversion, then we walk the returned tree and
// assert the figures a payslip is legally expected to carry actually appear.
// =============================================================================

/** Flatten a react element tree into the text it will render. */
function collectText(node: unknown): string[] {
  if (node == null || typeof node === 'boolean') return [];
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return collectText(props?.children);
  }
  return [];
}

/** Render to a single searchable string. */
function renderText(doc: PayslipDocument): string {
  return collectText(PayslipPDF({ doc })).join(' ').replace(/\s+/g, ' ');
}

const baseDoc: PayslipDocument = {
  payslip_number: 'PS-202609-A1B2C3',
  generated_at: '2026-10-01T06:30:00.000Z',
  salon: {
    name: 'Snip & Glow',
    legal_name: 'Snip And Glow Salons Pvt Ltd',
    trade_name: 'Snip & Glow',
    address: '123 MG Road, Bengaluru 560001',
    phone: '+91 9876543210',
    email: 'hello@snipandglow.com',
    gst_number: '29ABCDE1234F1Z5',
  },
  employee: {
    name: 'Prasad Pandluri',
    role: 'manager',
    phone: '+91 9123456789',
    email: null,
    code: 'A1B2C3D4',
    current_hourly_rate: 350,
  },
  period: {
    month: '2026-09',
    label: 'September 2026',
    start: '2026-09-01',
    end: '2026-09-30',
    calendar_days: 30,
  },
  attendance: {
    recorded: true,
    days_recorded: 30,
    days_worked: 22,
    days_absent: 1,
    days_leave: 2,
    days_week_off: 5,
    days_unrecorded: 0,
    total_hours: 176,
    total_minutes: 10560,
    effective_hourly_rate: 350,
    amount: 61600,
    rate_bands: [{ hourly_rate: 350, days: 22, hours: 176, amount: 61600 }],
  },
  earnings: {
    base_salary: 61600,
    bonus: 2000,
    deductions: 600,
    net_salary: 63000,
    differs_from_attendance: false,
  },
  payment: { status: 'paid', method: 'bank_transfer', paid_date: '2026-10-01' },
  notes: null,
};

describe('PayslipPDF', () => {
  it('executes without throwing when invoked', () => {
    expect(() => PayslipPDF({ doc: baseDoc })).not.toThrow();
  });

  it('states the three figures the payslip is built around', () => {
    const text = renderText(baseDoc);
    // Work days.
    expect(text).toContain('Days Worked');
    expect(text).toContain('22');
    // Total working hours.
    expect(text).toContain('Total Hours');
    expect(text).toContain('176.00');
    // Per-hour rate.
    expect(text).toContain('Per Hour');
    expect(text).toContain('350');
  });

  it('spells out the pay period as the 1st to the month end', () => {
    const text = renderText(baseDoc);
    expect(text).toContain('September 2026');
    expect(text).toContain(formatDateIN('2026-09-01'));
    expect(text).toContain(formatDateIN('2026-09-30'));
    expect(text).toContain('30 calendar days');
  });

  it('shows the earnings breakdown and the net figure in words', () => {
    const text = renderText(baseDoc);
    expect(text).toContain('Basic pay');
    expect(text).toContain('Bonus / incentive');
    expect(text).toContain('Deductions');
    expect(text).toContain('Net Pay');
    expect(text).toContain('Amount in words');
    expect(text).toContain('Rupees Sixty Three Thousand Only');
  });

  it('carries the salon and employee identity', () => {
    const text = renderText(baseDoc);
    expect(text).toContain('PAYSLIP');
    expect(text).toContain('Snip & Glow');
    expect(text).toContain('Snip And Glow Salons Pvt Ltd');
    expect(text).toContain('29ABCDE1234F1Z5');
    expect(text).toContain('Prasad Pandluri');
    expect(text).toContain('A1B2C3D4');
    expect(text).toContain('PS-202609-A1B2C3');
  });

  it('hides the bonus and deduction lines when they are zero', () => {
    const text = renderText({
      ...baseDoc,
      earnings: { ...baseDoc.earnings, bonus: 0, deductions: 0, net_salary: 61600 },
    });
    expect(text).not.toContain('Bonus / incentive');
    // "Deductions" must not appear as a line item. The section heading says
    // "Earnings & Deductions", so check the standalone label is gone.
    expect(text).toContain('Earnings & Deductions');
    expect(text.match(/Deductions/g)).toHaveLength(1);
  });

  it('breaks hours out per rate when a raise landed mid-month', () => {
    const text = renderText({
      ...baseDoc,
      attendance: {
        ...baseDoc.attendance,
        effective_hourly_rate: 375,
        amount: 66000,
        rate_bands: [
          { hourly_rate: 400, days: 10, hours: 80, amount: 32000 },
          { hourly_rate: 350, days: 12, hours: 96, amount: 33600 },
        ],
      },
    });
    // Each band names its own rate, so neither is hidden behind an average.
    expect(text).toContain('at ₹400/hr');
    expect(text).toContain('at ₹350/hr');
    expect(text).toContain('80.00');
    expect(text).toContain('96.00');
  });

  it('explains itself when no attendance was recorded', () => {
    const text = renderText({
      ...baseDoc,
      attendance: {
        ...baseDoc.attendance,
        recorded: false,
        days_recorded: 0,
        days_worked: 0,
        days_absent: 0,
        days_leave: 0,
        days_week_off: 0,
        days_unrecorded: 30,
        total_hours: 0,
        total_minutes: 0,
        effective_hourly_rate: 0,
        amount: 0,
        rate_bands: [],
      },
    });
    expect(text).toContain('No attendance was recorded for this period');
    // Falls back to the employee's current rate so the box is never blank.
    expect(text).toContain('350');
  });

  it('flags a month that is only partly filled in', () => {
    const text = renderText({
      ...baseDoc,
      attendance: { ...baseDoc.attendance, days_recorded: 18, days_unrecorded: 12 },
    });
    expect(text).toContain('12 of 30 days in this period have no attendance entry');
  });

  it('reconciles a basic pay that disagrees with the timesheet', () => {
    const higher = renderText({
      ...baseDoc,
      earnings: { ...baseDoc.earnings, base_salary: 70000, differs_from_attendance: true },
    });
    expect(higher).toContain('differs from');
    expect(higher).toContain('agreed addition');

    const lower = renderText({
      ...baseDoc,
      earnings: { ...baseDoc.earnings, base_salary: 50000, differs_from_attendance: true },
    });
    expect(lower).toContain('agreed adjustment');
  });

  it('renders a pending record without a payment date', () => {
    const text = renderText({
      ...baseDoc,
      payment: { status: 'pending', method: null, paid_date: null },
    });
    // Rendered uppercase via textTransform, so the underlying text is 'Pending'.
    expect(text).toContain('Pending');
    expect(text).not.toContain('via');
  });

  it('survives a salon with no optional details at all', () => {
    const text = renderText({
      ...baseDoc,
      salon: {
        name: 'Salon',
        legal_name: null,
        trade_name: null,
        address: null,
        phone: null,
        email: null,
        gst_number: null,
      },
      employee: { ...baseDoc.employee, phone: null, email: null },
      notes: null,
    });
    expect(text).toContain('Salon');
    expect(text).toContain('PAYSLIP');
    expect(text).not.toContain('GSTIN');
  });

  it('prints a negative net rather than hiding it', () => {
    // Deductions exceeding earnings is unusual but must not silently render as
    // a positive number on a document someone is handed.
    const text = renderText({
      ...baseDoc,
      earnings: {
        ...baseDoc.earnings,
        base_salary: 1000,
        bonus: 0,
        deductions: 1500,
        net_salary: -500,
        differs_from_attendance: true,
      },
    });
    expect(text).toContain('Minus Rupees Five Hundred Only');
  });

  it('includes remarks when present', () => {
    const text = renderText({ ...baseDoc, notes: 'From attendance: 22 days, 176h' });
    expect(text).toContain('Remarks');
    expect(text).toContain('From attendance: 22 days, 176h');
  });
});
