import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';

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
          <Link href="/admin/tenants" className="text-xs text-slate-500 hover:text-slate-300">← Back to Tenants</Link>
          <h1 className="text-2xl font-bold text-white mt-1">{tenant.name}</h1>
          <p className="text-sm text-slate-400">{tenant.tenant_code} · {tenant.subscription_status}</p>
        </div>
        <Link
          href={`/admin/force-delete?tenant=${tenantId}`}
          className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-800 rounded-lg hover:bg-red-900/20 transition-colors"
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
          <Field label="Created" value={new Date(tenant.created_at).toLocaleDateString('en-IN')} />
          <Field label="Subscription Start" value={tenant.subscription_start ? new Date(tenant.subscription_start).toLocaleDateString('en-IN') : '—'} />
          <Field label="Subscription End" value={tenant.subscription_end ? new Date(tenant.subscription_end).toLocaleDateString('en-IN') : '—'} />
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
          <p className="text-sm text-slate-500">No WhatsApp settings configured</p>
        )}
      </Section>

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
          rows={customers.map((c: any) => [c.name, c.phone, String(c.total_visits || 0), `₹${c.total_spent || 0}`, new Date(c.created_at).toLocaleDateString('en-IN')])}
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
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
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-white font-medium mt-0.5">{value}</p>
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No data</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {headers.map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-800/20">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-slate-300">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
