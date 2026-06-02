import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { formatISTDate } from '@/lib/datetime';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AdminGstEditor } from './gst-editor';

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
  const [branchesRes, staffRes, servicesRes, customersRes, appointmentsRes, waSettingsRes] = await Promise.all([
    admin.from('branches').select('id, name, address, is_default, is_active').eq('tenant_id', tenantId),
    admin.from('employees').select('id, name, phone, email, role, is_active').eq('tenant_id', tenantId),
    admin.from('services').select('id, name, category, price, duration_minutes, is_active').eq('tenant_id', tenantId),
    admin.from('customers').select('id, name, phone, email, total_visits, total_spent, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    admin.from('appointments').select('id, appointment_date, start_time, status, source, created_at').eq('tenant_id', tenantId).order('appointment_date', { ascending: false }).limit(20),
    (admin.from('tenant_whatsapp_settings' as any).select('*').eq('tenant_id', tenantId).maybeSingle() as any),
  ]);

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
  const customers = customersRes.data ?? [];
  const appointments = appointmentsRes.data ?? [];
  const waSettings = waSettingsRes.data;

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
          <Field label="Plan" value={tenant.plan_tier || 'starter'} />
          <Field label="Status" value={tenant.subscription_status} />
          <Field label="Created" value={formatISTDate(tenant.created_at)} />
          <Field label="Subscription Start" value={formatISTDate(tenant.subscription_start)} />
          <Field label="Subscription End" value={formatISTDate(tenant.subscription_end)} />
        </Grid>
      </Section>

      {/* WhatsApp Settings */}
      <Section title="WhatsApp Settings">
        {waSettings ? (
          <Grid>
            <Field label="Mode" value={waSettings.mode} />
            <Field label="Booking Slug" value={waSettings.booking_slug || '—'} />
          </Grid>
        ) : (
          <p className="text-sm text-muted-foreground">No WhatsApp settings configured</p>
        )}
      </Section>

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
          rows={branches.map((b: any) => [b.name, b.address || '—', b.is_default ? '✓' : '', b.is_active ? '✓' : '✗'])}
        />
      </Section>

      {/* Staff */}
      <Section title={`Staff (${staff.length})`}>
        <SimpleTable
          headers={['Name', 'Phone', 'Email', 'Role', 'Active']}
          rows={staff.map((s: any) => [s.name, s.phone || '—', s.email || '—', s.role, s.is_active ? '✓' : '✗'])}
        />
      </Section>

      {/* Services */}
      <Section title={`Services (${services.length})`}>
        <SimpleTable
          headers={['Name', 'Category', 'Price', 'Active']}
          rows={services.map((s: any) => [s.name, s.category || '—', `₹${s.price}`, s.is_active ? '✓' : '✗'])}
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
          rows={appointments.map((a: any) => [a.appointment_date, a.start_time, a.status, a.source || 'dashboard'])}
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

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
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
