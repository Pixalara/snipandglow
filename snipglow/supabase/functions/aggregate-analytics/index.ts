import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * aggregate-analytics Edge Function
 *
 * Triggered by pg_cron nightly at 2:00 AM IST.
 * Computes daily analytics snapshots per branch:
 *   - revenue: SUM(invoices.total) for yesterday
 *   - appointment_count: COUNT(non-cancelled appointments) for yesterday
 *   - new_customers: COUNT(customers created) on yesterday
 *   - retention_rate: (customers with 2+ visits in last 30 days / total active customers) * 100
 *   - active_memberships: COUNT(customer_memberships where status='active')
 *   - top_services: Top 5 services by revenue for yesterday
 *
 * UPSERTs into analytics_snapshots table (unique on tenant_id, branch_id, snapshot_date).
 *
 * Requirements: 10.5, 18.8
 */

/**
 * Validate the authorization header against CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY
 */
function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (cronSecret && token === cronSecret) return true;
  if (serviceRoleKey && token === serviceRoleKey) return true;

  return false;
}

/**
 * Get yesterday's date string in IST (YYYY-MM-DD)
 */
function getYesterdayIST(): string {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const yesterday = new Date(istNow);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate authorization
  if (!isAuthorized(req)) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Initialize Supabase client with service role key (bypasses RLS)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  let branchesProcessed = 0;

  try {
    const snapshotDate = getYesterdayIST();
    console.log(`[aggregate-analytics] Computing snapshots for: ${snapshotDate}`);

    // Fetch all active tenants
    const { data: tenants, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .in("subscription_status", ["trial", "active"]);

    if (tenantError) {
      console.error("[aggregate-analytics] Failed to fetch tenants:", tenantError.message);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch tenants: ${tenantError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tenants || tenants.length === 0) {
      console.log("[aggregate-analytics] No active tenants found");
      return new Response(
        JSON.stringify({ success: true, branches_processed: 0, message: "No active tenants" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each tenant
    for (const tenant of tenants) {
      // Fetch active branches for this tenant
      const { data: branches, error: branchError } = await supabase
        .from("branches")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);

      if (branchError || !branches) {
        console.warn(`[aggregate-analytics] Failed to fetch branches for tenant ${tenant.id}:`, branchError?.message);
        continue;
      }

      // Process each branch
      for (const branch of branches) {
        try {
          // 1. Revenue: SUM(invoices.total) for snapshot_date
          const { data: revenueData } = await supabase
            .from("invoices")
            .select("total")
            .eq("branch_id", branch.id)
            .gte("created_at", `${snapshotDate}T00:00:00+05:30`)
            .lt("created_at", `${snapshotDate}T23:59:59.999+05:30`);

          const revenue = (revenueData ?? []).reduce(
            (sum: number, inv: { total: number }) => sum + (inv.total || 0),
            0
          );

          // 2. Appointment count: non-cancelled appointments for snapshot_date
          const { count: appointmentCount } = await supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("branch_id", branch.id)
            .eq("appointment_date", snapshotDate)
            .neq("status", "cancelled");

          // 3. New customers: created on snapshot_date
          const { count: newCustomers } = await supabase
            .from("customers")
            .select("id", { count: "exact", head: true })
            .eq("branch_id", branch.id)
            .gte("created_at", `${snapshotDate}T00:00:00+05:30`)
            .lt("created_at", `${snapshotDate}T23:59:59.999+05:30`);

          // 4. Retention rate: customers with 2+ visits in last 30 days / total active customers
          const thirtyDaysAgo = new Date(snapshotDate);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

          // Total active customers (visited in last 90 days)
          const ninetyDaysAgo = new Date(snapshotDate);
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0];

          const { count: totalActiveCustomers } = await supabase
            .from("customers")
            .select("id", { count: "exact", head: true })
            .eq("branch_id", branch.id)
            .gte("last_visit_at", `${ninetyDaysAgoStr}T00:00:00+05:30`);

          // Repeat visitors (2+ completed appointments in last 30 days)
          const { data: repeatVisitorData } = await supabase
            .from("appointments")
            .select("customer_id")
            .eq("branch_id", branch.id)
            .eq("status", "completed")
            .gte("appointment_date", thirtyDaysAgoStr)
            .lte("appointment_date", snapshotDate);

          // Count customers with 2+ visits
          const visitCounts: Record<string, number> = {};
          for (const row of repeatVisitorData ?? []) {
            visitCounts[row.customer_id] = (visitCounts[row.customer_id] || 0) + 1;
          }
          const repeatVisitors = Object.values(visitCounts).filter((c) => c >= 2).length;

          const retentionRate =
            (totalActiveCustomers ?? 0) === 0
              ? 0
              : Math.round((repeatVisitors / (totalActiveCustomers ?? 1)) * 10000) / 100;

          // 5. Active memberships count
          const { count: activeMemberships } = await supabase
            .from("customer_memberships")
            .select("id", { count: "exact", head: true })
            .eq("branch_id", branch.id)
            .eq("status", "active");

          // 6. Top 5 services by revenue for snapshot_date
          // Get invoices for the date, then their items
          const { data: dateInvoices } = await supabase
            .from("invoices")
            .select("id")
            .eq("branch_id", branch.id)
            .gte("created_at", `${snapshotDate}T00:00:00+05:30`)
            .lt("created_at", `${snapshotDate}T23:59:59.999+05:30`);

          const invoiceIds = (dateInvoices ?? []).map((inv: { id: string }) => inv.id);

          let topServices: { name: string; category: string; total_revenue: number; times_booked: number }[] = [];

          if (invoiceIds.length > 0) {
            const { data: items } = await supabase
              .from("invoice_items")
              .select("service_id, service_name, line_total")
              .in("invoice_id", invoiceIds);

            // Aggregate by service
            const serviceMap: Record<string, { name: string; total_revenue: number; times_booked: number }> = {};
            for (const item of items ?? []) {
              if (!serviceMap[item.service_id]) {
                serviceMap[item.service_id] = {
                  name: item.service_name,
                  total_revenue: 0,
                  times_booked: 0,
                };
              }
              serviceMap[item.service_id].total_revenue += item.line_total || 0;
              serviceMap[item.service_id].times_booked += 1;
            }

            // Get service categories
            const serviceIds = Object.keys(serviceMap);
            let categoryMap: Record<string, string> = {};
            if (serviceIds.length > 0) {
              const { data: services } = await supabase
                .from("services")
                .select("id, category")
                .in("id", serviceIds);

              for (const svc of services ?? []) {
                categoryMap[svc.id] = svc.category;
              }
            }

            // Sort by revenue and take top 5
            topServices = Object.entries(serviceMap)
              .map(([id, data]) => ({
                name: data.name,
                category: categoryMap[id] || "Other",
                total_revenue: data.total_revenue,
                times_booked: data.times_booked,
              }))
              .sort((a, b) => b.total_revenue - a.total_revenue)
              .slice(0, 5);
          }

          // UPSERT into analytics_snapshots
          const { error: upsertError } = await supabase
            .from("analytics_snapshots")
            .upsert(
              {
                tenant_id: tenant.id,
                branch_id: branch.id,
                snapshot_date: snapshotDate,
                revenue,
                appointment_count: appointmentCount ?? 0,
                new_customers: newCustomers ?? 0,
                retention_rate: retentionRate,
                active_memberships: activeMemberships ?? 0,
                top_services: topServices,
              },
              { onConflict: "tenant_id,branch_id,snapshot_date" }
            );

          if (upsertError) {
            console.error(
              `[aggregate-analytics] Upsert failed for branch ${branch.id}:`,
              upsertError.message
            );
            continue;
          }

          branchesProcessed++;
          console.log(
            `[aggregate-analytics] Snapshot saved for branch ${branch.id}: revenue=${revenue}, appointments=${appointmentCount ?? 0}, new_customers=${newCustomers ?? 0}, retention=${retentionRate}%`
          );
        } catch (branchErr) {
          console.error(
            `[aggregate-analytics] Error processing branch ${branch.id}:`,
            branchErr
          );
        }
      }
    }

    console.log(
      `[aggregate-analytics] Complete. Branches processed: ${branchesProcessed}`
    );

    return new Response(
      JSON.stringify({ success: true, branches_processed: branchesProcessed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[aggregate-analytics] Unexpected error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        branches_processed: branchesProcessed,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
