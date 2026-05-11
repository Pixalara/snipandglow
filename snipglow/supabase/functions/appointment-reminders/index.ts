import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * appointment-reminders Edge Function
 *
 * Triggered by pg_cron daily at 8:00 AM IST.
 * Queries appointments for the NEXT DAY (tomorrow) where status is 'booked' or 'confirmed',
 * and sends a WhatsApp reminder to each customer with appointment details.
 *
 * Requirements: 9.1, 18.5
 */

/**
 * Format time string (HH:MM:SS or HH:MM) to 12-hour IST format (e.g., "10:30 AM")
 */
function formatTime12h(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Format date string (YYYY-MM-DD) to "DD MMM YYYY" format
 */
function formatDateIN(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00+05:30");
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

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
    // Calculate tomorrow's date in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istNow = new Date(now.getTime() + istOffset);
    const tomorrow = new Date(istNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

    console.log(
      `[appointment-reminders] Querying appointments for: ${tomorrowStr}`
    );

    // Query appointments for tomorrow with status 'booked' or 'confirmed'
    const { data: appointments, error: queryError } = await supabase
      .from("appointments")
      .select(
        `
        id,
        tenant_id,
        branch_id,
        appointment_date,
        start_time,
        end_time,
        status,
        customer_id,
        service_id,
        employee_id,
        customers (id, name, phone),
        services (id, name),
        employees (id, name),
        branches (id, name)
      `
      )
      .eq("appointment_date", tomorrowStr)
      .in("status", ["booked", "confirmed"]);

    if (queryError) {
      console.error(
        "[appointment-reminders] Query error:",
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

    if (!appointments || appointments.length === 0) {
      console.log("[appointment-reminders] No appointments found for tomorrow");
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0, message: "No appointments for tomorrow" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[appointment-reminders] Found ${appointments.length} appointments to remind`
    );

    // Process each appointment
    for (const appointment of appointments) {
      const customer = appointment.customers as unknown as { id: string; name: string; phone: string } | null;
      const service = appointment.services as unknown as { id: string; name: string } | null;
      const employee = appointment.employees as unknown as { id: string; name: string } | null;
      const branch = appointment.branches as unknown as { id: string; name: string } | null;

      // Skip if missing required data
      if (!customer?.phone || !customer?.name || !service?.name || !employee?.name || !branch?.name) {
        console.warn(
          `[appointment-reminders] Skipping appointment ${appointment.id}: missing data`
        );
        failed++;
        continue;
      }

      try {
        const formattedTime = formatTime12h(appointment.start_time);
        const serviceAndTime = `${service.name} at ${formattedTime}`;

        // Send WhatsApp template: appointment_reminder
        // Parameters:
        //   {{1}}: customer name
        //   {{2}}: service name + " at " + formatted time
        //   {{3}}: formatted time
        //   {{4}}: stylist name
        //   {{5}}: branch name
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
                name: "appointment_reminder",
                language: { code: "en" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: customer.name },
                      { type: "text", text: serviceAndTime },
                      { type: "text", text: formattedTime },
                      { type: "text", text: employee.name },
                      { type: "text", text: branch.name },
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
            `[appointment-reminders] Failed to send reminder for appointment ${appointment.id}:`,
            errorBody
          );

          // Log failure to whatsapp_sessions
          await supabase.from("whatsapp_sessions").insert({
            tenant_id: appointment.tenant_id,
            branch_id: appointment.branch_id,
            message_id: null,
            phone: customer.phone,
            template_name: "appointment_reminder",
            direction: "outbound",
            status: "failed",
            error_details: errorBody,
            metadata: {
              appointment_id: appointment.id,
              appointment_date: appointment.appointment_date,
              start_time: appointment.start_time,
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
          tenant_id: appointment.tenant_id,
          branch_id: appointment.branch_id,
          message_id: messageId,
          phone: customer.phone,
          template_name: "appointment_reminder",
          direction: "outbound",
          status: "sent",
          error_details: null,
          metadata: {
            appointment_id: appointment.id,
            appointment_date: appointment.appointment_date,
            start_time: appointment.start_time,
            service_name: service.name,
            employee_name: employee.name,
          },
        });

        sent++;
        console.log(
          `[appointment-reminders] Sent reminder for appointment ${appointment.id} to ${customer.phone}`
        );
      } catch (err) {
        console.error(
          `[appointment-reminders] Error processing appointment ${appointment.id}:`,
          err
        );

        // Log error to whatsapp_sessions
        await supabase.from("whatsapp_sessions").insert({
          tenant_id: appointment.tenant_id,
          branch_id: appointment.branch_id,
          message_id: null,
          phone: customer.phone,
          template_name: "appointment_reminder",
          direction: "outbound",
          status: "failed",
          error_details: err instanceof Error ? err.message : String(err),
          metadata: {
            appointment_id: appointment.id,
          },
        });

        failed++;
      }
    }

    console.log(
      `[appointment-reminders] Complete. Sent: ${sent}, Failed: ${failed}`
    );

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[appointment-reminders] Unexpected error:", err);
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
