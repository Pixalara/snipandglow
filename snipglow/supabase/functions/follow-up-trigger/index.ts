import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * follow-up-trigger Edge Function
 *
 * Triggered by pg_cron daily at 10:00 AM IST.
 * Queries customers whose last_visit_at is older than 30 days and who haven't
 * received a follow-up message in the last 30 days.
 * Sends a WhatsApp follow-up message to encourage repeat visits.
 *
 * Requirements: 9.2, 18.6
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

  const metaToken = Deno.env.get("META_WHATSAPP_TOKEN")!;
  const phoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID")!;

  let sent = 0;
  let failed = 0;

  try {
    // Calculate the cutoff date: 30 days ago in IST
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const cutoffISO = thirtyDaysAgo.toISOString();

    console.log(
      `[follow-up-trigger] Querying customers with last_visit_at before: ${cutoffISO}`
    );

    // Query customers whose last visit was more than 30 days ago
    const { data: customers, error: queryError } = await supabase
      .from("customers")
      .select(
        `
        id,
        tenant_id,
        branch_id,
        name,
        phone,
        last_visit_at,
        branches (id, name),
        tenants:tenant_id (id, name)
      `
      )
      .lt("last_visit_at", cutoffISO)
      .not("last_visit_at", "is", null)
      .not("phone", "is", null);

    if (queryError) {
      console.error(
        "[follow-up-trigger] Query error:",
        queryError.message
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: `Database query failed: ${queryError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!customers || customers.length === 0) {
      console.log("[follow-up-trigger] No inactive customers found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0, message: "No inactive customers found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[follow-up-trigger] Found ${customers.length} inactive customers`
    );

    // Filter out customers who already received a follow-up in the last 30 days
    const recentFollowupCutoff = thirtyDaysAgo.toISOString();

    const { data: recentFollowups, error: followupError } = await supabase
      .from("whatsapp_sessions")
      .select("phone")
      .eq("template_name", "customer_followup")
      .eq("direction", "outbound")
      .in("status", ["sent", "delivered", "read"])
      .gte("created_at", recentFollowupCutoff);

    if (followupError) {
      console.warn(
        "[follow-up-trigger] Error checking recent follow-ups:",
        followupError.message
      );
      // Continue anyway — better to send a duplicate than miss a follow-up
    }

    // Build a set of phones that already received a follow-up recently
    const recentlyContactedPhones = new Set(
      (recentFollowups || []).map((r) => r.phone)
    );

    // Filter customers who haven't been contacted recently
    const eligibleCustomers = customers.filter(
      (c) => !recentlyContactedPhones.has(c.phone)
    );

    console.log(
      `[follow-up-trigger] ${eligibleCustomers.length} customers eligible after filtering recent follow-ups`
    );

    if (eligibleCustomers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          failed: 0,
          message: "All inactive customers already received recent follow-ups",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each eligible customer
    for (const customer of eligibleCustomers) {
      const branch = customer.branches as unknown as { id: string; name: string } | null;
      const tenant = customer.tenants as unknown as { id: string; name: string } | null;

      // Skip if missing required data
      if (!customer.phone || !customer.name) {
        console.warn(
          `[follow-up-trigger] Skipping customer ${customer.id}: missing phone or name`
        );
        failed++;
        continue;
      }

      // Use tenant name as salon name, fallback to branch name
      const salonName = tenant?.name || branch?.name || "our salon";

      try {
        // Send WhatsApp template: customer_followup
        // Parameters:
        //   {{1}}: customer name
        //   {{2}}: salon name
        const metaResponse = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${metaToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: customer.phone,
              type: "template",
              template: {
                name: "customer_followup",
                language: { code: "en" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: customer.name },
                      { type: "text", text: salonName },
                    ],
                  },
                ],
              },
            }),
          }
        );

        let messageId: string | null = null;

        if (!metaResponse.ok) {
          const errorBody = await metaResponse.text();
          console.error(
            `[follow-up-trigger] Failed to send follow-up to customer ${customer.id}:`,
            errorBody
          );

          // Log failure to whatsapp_sessions
          await supabase.from("whatsapp_sessions").insert({
            tenant_id: customer.tenant_id,
            branch_id: customer.branch_id,
            message_id: null,
            phone: customer.phone,
            template_name: "customer_followup",
            direction: "outbound",
            status: "failed",
            error_details: errorBody,
            metadata: {
              customer_id: customer.id,
              last_visit_at: customer.last_visit_at,
            },
          });

          failed++;
          continue;
        }

        // Parse response for message ID
        const metaResult = await metaResponse.json();
        messageId = metaResult?.messages?.[0]?.id || null;

        // Log success to whatsapp_sessions
        await supabase.from("whatsapp_sessions").insert({
          tenant_id: customer.tenant_id,
          branch_id: customer.branch_id,
          message_id: messageId,
          phone: customer.phone,
          template_name: "customer_followup",
          direction: "outbound",
          status: "sent",
          error_details: null,
          metadata: {
            customer_id: customer.id,
            last_visit_at: customer.last_visit_at,
            salon_name: salonName,
          },
        });

        sent++;
        console.log(
          `[follow-up-trigger] Sent follow-up to customer ${customer.id} (${customer.phone})`
        );
      } catch (err) {
        console.error(
          `[follow-up-trigger] Error processing customer ${customer.id}:`,
          err
        );

        // Log error to whatsapp_sessions
        await supabase.from("whatsapp_sessions").insert({
          tenant_id: customer.tenant_id,
          branch_id: customer.branch_id,
          message_id: null,
          phone: customer.phone,
          template_name: "customer_followup",
          direction: "outbound",
          status: "failed",
          error_details: err instanceof Error ? err.message : String(err),
          metadata: {
            customer_id: customer.id,
          },
        });

        failed++;
      }
    }

    console.log(
      `[follow-up-trigger] Complete. Sent: ${sent}, Failed: ${failed}`
    );

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[follow-up-trigger] Unexpected error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        sent,
        failed,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
