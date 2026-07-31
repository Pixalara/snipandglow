import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { formatISTDate } from '@/lib/datetime';
import { formatINR } from '@/lib/utils';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AdminGstEditor } from './gst-editor';
import { AdminWhatsAppActivator } from './whatsapp-activator';
import { AdminPlanEditor } from './plan-editor';
import { PricingEditor } from './pricing-editor';
import { PaymentHistoryTable, type PaymentRow } from '../../payment-history-table';
import { toAdminWhatsAppView } from '@/lib/whatsapp/redaction';
import {
  planLabel,
  getBillingCycle,
  billingCycleLabel,
  planPricing,
  getCustomPricing,
} from '@/lib/subscription';

// =============================================================================
// Admin — Tenant Detail Page
// =============================================================================

export default async function AdminTenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const { id } = await params;
  const tenantId = id;

  // Fetch tenant
  const { data: tenant } = await (admin.from('tenants' as any).select('*').eq('id', tenantId).single() as any);
  if (!tenant) notFound();

  // Fetch related data in parallel
  const [branchesRes, staffRes, servicesRes, productsRes, customersRes, appointmentsRes, waSettingsRes, setupReqRes, invoicesRes] = await Promise.all([
    admin.from('branches').select('id, name, address, is_default, is_active').eq('tenant_id', tenantId),
    admin.from('employees').select('id, name, phone, email, role, is_active').eq('tenant_id', tenantId),
    admin.from('services').select('id, name, category, price, duration_minutes, is_active').eq('tenant_id', tenantId),
    (admin.from('products' as any).select('id, name, category, brand, selling_price, stock_quantity, unit, is_active').eq('tenant_id', tenantId).order('name', { ascending: true }) as any),
    admin.from('customers').select('id, name, phone, email, total_visits, total_spent, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    admin.from('appointments').select('id, appointment_date, start_time, status, source, created_at').eq('tenant_id', tenantId).order('appointment_date', { ascending: false }).limit(20),
    (admin.from('tenant_whatsapp_settings' as any).select('*').eq('tenant_id', tenantId).maybeSingle() as any),
    (admin.from('whatsapp_setup_requests' as any).select('contact_phone, contact_name, notes, status, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle() as any),
    (admin as any).from('invoices').select('total, created_at').eq('tenant_id', tenantId).neq('invoice_type', 'wallet_recharge'),
  ]);

  // Subscription payment history for this salon.
  const { data: paymentsRes } = await (admin
    .from('payment_orders' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100) as any);
  const payments = (paymentsRes ?? []) as PaymentRow[];
  const paidTotal = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0) / 100;

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'view_tenant_detail',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: { tenant_name: tenant.name },
  });

  const branches = branchesRes.data ?? [];
  const staff = staffRes.data ?? [];
  const services = servicesRes.data ?? [];
  const products = productsRes.data ?? [];
  const customers = customersRes.data ?? [];
  const appointments = appointmentsRes.data ?? [];

  // Owner login email lives on the owner's employee record (created at onboarding).
  const ownerEmail = ((staff.find((s: any) => s.role === 'owner')?.email as string) || '').trim() || '—';

  // ─── Invoice / billing statistics (all dates in IST) ─────────────────────
  const invoiceList = (invoicesRes.data ?? []) as Array<{ total: number | null; created_at: string | null }>;
  const istToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const monthStart = istToday.slice(0, 7) + '-01';
  const istDateOf = (ts: string | null) =>
    ts ? new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';

  let totalInvoiced = 0;
  let todayCount = 0;
  let todayAmount = 0;
  let monthCount = 0;
  let monthAmount = 0;
  for (const inv of invoiceList) {
    const amt = inv.total ?? 0;
    totalInvoiced += amt;
    const d = istDateOf(inv.created_at);
    if (d === istToday) {
      todayCount += 1;
      todayAmount += amt;
    }
    if (d >= monthStart) {
      monthCount += 1;
      monthAmount += amt;
    }
  }
  const totalInvoices = invoiceList.length;

  const waView = toAdminWhatsAppView(waSettingsRes.data);
  const setupReqData = (setupReqRes?.data as {
    contact_phone: string;
    contact_name: string | null;
    notes: string | null;
    status: string;
    created_at: string;
  } | null) ?? null;
  const setupRequest = setupReqData
    ? {
        contactPhone: setupReqData.contact_phone,
        contactName: setupReqData.contact_name,
        notes: setupReqData.notes,
        status: setupReqData.status,
        createdAt: setupReqData.created_at,
      }
    : null;

  // WhatsApp booking link — mirrors exactly what the tenant sees in their
  // dashboard Settings (derived from tenant_code + salon name).
  const bookingShortCode = String(tenant.tenant_code ?? '').replace('-', '').toUpperCase();
  const bookingMessage = `Hi! I'd like to book an appointment at ${String(tenant.name ?? '').trim()} [${bookingShortCode}]`;
  const bookingWaUrl = `https://wa.me/919448895147?text=${encodeURIComponent(bookingMessage)}`;
  const bookingLandingUrl = bookingShortCode
    ? `https://www.snipandglow.com/book/${bookingShortCode.toLowerCase()}`
    : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/tenants" className="text-xs text-muted-foreground hover:text-foreground">← Back to Tenants</Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">{tenant.tenant_code} · {tenant.subscription_status}</p>
        </div>
        <Link
          href={`/admin/force-delete?tenant=${tenantId}`}
          className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-500/40 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          Force Delete
        </Link>
      </div>

      {/* Profile */}
      <Section title="Profile">
        <Grid>
          <Field label="Owner" value={tenant.owner_name || '—'} />
          <Field label="Phone" value={tenant.phone || '—'} />
          <Field label="Email" value={ownerEmail} />
          <Field label="Plan" value={planLabel(tenant.plan_tier)} />
          <Field label="Billing Cycle" value={billingCycleLabel(getBillingCycle(tenant.settings))} />
          <Field label="Status" value={tenant.subscription_status} />
          <Field label="Created" value={formatISTDate(tenant.created_at)} />
          <Field label="Subscription Start" value={formatISTDate(tenant.subscription_start)} />
          <Field label="Subscription End" value={formatISTDate(tenant.subscription_end)} />
        </Grid>
      </Section>

      {/* Billing Overview — invoices generated & amount invoiced by this tenant */}
      <Section title="Billing Overview">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Total Invoices" value={String(totalInvoices)} accent="text-violet-600 dark:text-violet-400" />
          <StatTile label="Total Amount Invoiced" value={formatINR(totalInvoiced)} accent="text-violet-600 dark:text-violet-400" />
          <StatTile label="This Month" value={formatINR(monthAmount)} sub={`${monthCount} invoice${monthCount !== 1 ? 's' : ''}`} accent="text-blue-600 dark:text-blue-400" />
          <StatTile label="Today" value={formatINR(todayAmount)} sub={`${todayCount} invoice${todayCount !== 1 ? 's' : ''}`} accent="text-emerald-600 dark:text-emerald-400" />
          <StatTile label="Avg / Invoice" value={formatINR(totalInvoices > 0 ? Math.round(totalInvoiced / totalInvoices) : 0)} accent="text-amber-600 dark:text-amber-400" />
        </div>
      </Section>

      {/* WhatsApp Booking Link — what the tenant shares with customers */}
      <Section title="WhatsApp Booking Link">
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Booking Code</p>
            <p className="font-mono font-semibold text-foreground">{bookingShortCode || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">WhatsApp Booking Link (what the tenant shares)</p>
            <a
              href={bookingWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-emerald-600 hover:underline break-all select-all"
            >
              {bookingWaUrl}
            </a>
          </div>
          {bookingLandingUrl && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Public Booking Page</p>
              <a
                href={bookingLandingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-emerald-600 hover:underline break-all select-all"
              >
                {bookingLandingUrl}
              </a>
            </div>
          )}
        </div>
      </Section>

      {/* Subscription plan — admin can change the tenant's plan tier */}
      <AdminPlanEditor
        tenantId={tenantId}
        currentPlan={tenant.plan_tier || 'starter'}
        currentBillingCycle={getBillingCycle(tenant.settings)}
        subscriptionStatus={tenant.subscription_status}
        subscriptionEnd={tenant.subscription_end ?? null}
      />

      {/* Payment Settings — negotiated rate for this salon */}
      <PricingEditor
        tenantId={tenantId}
        planName={planLabel(tenant.plan_tier)}
        listMonthly={planPricing(tenant.plan_tier).monthly}
        listYearlyPerMonth={planPricing(tenant.plan_tier).yearlyPerMonth}
        customMonthly={getCustomPricing(tenant.settings).monthly}
        customYearlyPerMonth={getCustomPricing(tenant.settings).yearlyPerMonth}
        billingCycle={getBillingCycle(tenant.settings)}
      />

      {/* Payment history for this salon */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-muted/30 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Payment History</h2>
          <span className="text-xs text-muted-foreground">
            {payments.filter((p) => p.status === 'paid').length} paid · ₹{paidTotal.toLocaleString('en-IN')} collected
          </span>
        </div>
        <PaymentHistoryTable rows={payments} emptyText="No subscription payments from this salon yet" />
      </div>

      {/* WhatsApp Settings — redaction-safe; never renders any access token */}
      <Section title="WhatsApp Settings">
        {waView ? (
          <Grid>
            <Field label="Mode" value={waView.mode} />
            <Field label="Onboarding Status" value={waView.onboardingStatus} />
            <Field label="Display Phone Number" value={waView.displayPhoneNumber || '—'} />
            <Field label="Webhook Status" value={waView.webhookStatus || '—'} />
            <Field label="Booking Slug" value={waView.bookingSlug || '—'} />
            <Field label="Onboarding Error" value={waView.onboardingError || '—'} />
            <Field label="Last Updated" value={waView.onboardingUpdatedAt ? formatISTDate(waView.onboardingUpdatedAt) : '—'} />
          </Grid>
        ) : (
          <p className="text-sm text-muted-foreground">Dedicated WhatsApp not configured</p>
        )}
      </Section>

      {/* Manual WhatsApp activation — interim flow while Embedded Signup is pending */}
      <AdminWhatsAppActivator
        tenantId={tenantId}
        onboardingStatus={waView?.onboardingStatus ?? null}
        setupRequest={setupRequest}
      />

      {/* GST Details — admin can edit even when locked for the tenant */}
      <AdminGstEditor
        tenantId={tenantId}
        gstNumber={((tenant.settings as any)?.gst_number as string) ?? ''}
        gstRate={((tenant.settings as any)?.gst_rate as number) ?? 5}
        legalName={((tenant.settings as any)?.legal_name as string) ?? ''}
        tradeName={((tenant.settings as any)?.trade_name as string) ?? ''}
        locked={((tenant.settings as any)?.gst_locked as boolean) ?? false}
      />

      {/* Branches */}
      <Section title={`Branches (${branches.length})`}>
        <SimpleTable
          headers={['Name', 'Address', 'Default', 'Active']}
          rows={branches.map((b: any) => [b.name, b.address || '—', b.is_default ? 'Default' : '—', activeCell(b.is_active)])}
        />
      </Section>

      {/* Staff */}
      <Section title={`Staff (${staff.length})`}>
        <SimpleTable
          headers={['Name', 'Phone', 'Email', 'Role', 'Active']}
          rows={staff.map((s: any) => [s.name, s.phone || '—', s.email || '—', roleCell(s.role), activeCell(s.is_active)])}
        />
      </Section>

      {/* Services */}
      <Section title={`Services (${services.length})`}>
        <SimpleTable
          headers={['Name', 'Category', 'Price', 'Active']}
          rows={services.map((s: any) => [s.name, s.category || '—', `₹${s.price}`, activeCell(s.is_active)])}
        />
      </Section>

      {/* Products (inventory) */}
      <Section title={`Products (${products.length})`}>
        <SimpleTable
          headers={['Name', 'Category / Brand', 'Stock', 'Selling Price', 'Active']}
          rows={products.map((p: any) => [
            p.name,
            [p.category, p.brand].filter(Boolean).join(' · ') || '—',
            `${p.stock_quantity ?? 0} ${p.unit || ''}`.trim(),
            `₹${p.selling_price ?? 0}`,
            activeCell(p.is_active),
          ])}
        />
      </Section>

      {/* Customers */}
      <Section title={`Customers (${customers.length})`}>
        <SimpleTable
          headers={['Name', 'Phone', 'Visits', 'Spent', 'Joined']}
          rows={customers.map((c: any) => [c.name, c.phone, String(c.total_visits || 0), `₹${c.total_spent || 0}`, formatISTDate(c.created_at)])}
        />
      </Section>

      {/* Recent Appointments */}
      <Section title={`Recent Appointments (${appointments.length})`}>
        <SimpleTable
          headers={['Date', 'Time', 'Status', 'Source']}
          rows={appointments.map((a: any) => [a.appointment_date, a.start_time, apptStatusCell(a.status), a.source || 'dashboard'])}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{children}</div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium mt-0.5">{value}</p>
    </div>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3.5">
      <p className={`text-lg font-bold leading-tight ${accent}`}>{value}</p>
      <p className="text-xs font-medium text-foreground/80 mt-1">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-accent/40">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-foreground/80">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render an active/inactive value as a colored status pill. */
function activeCell(isActive: boolean): React.ReactNode {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      <span className={`size-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

/** Render an appointment status as a colored pill. */
function apptStatusCell(status: string): React.ReactNode {
  const tints: Record<string, string> = {
    booked: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tints[status] ?? tints.completed}`}>
      {status}
    </span>
  );
}

/** Render a role value as a subtle capitalized pill. */
function roleCell(role: string): React.ReactNode {
  const tints: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    staff: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tints[role] ?? tints.staff}`}>
      {role}
    </span>
  );
}
