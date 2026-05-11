import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Validate Razorpay webhook signature using HMAC-SHA256.
 */
async function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === signature;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") || "";

  // Validate signature
  if (webhookSecret && signature) {
    const isValid = await verifyRazorpaySignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error("[razorpay-webhook] Invalid signature");
      // Return 200 to prevent retries
      return new Response(JSON.stringify({ status: "invalid_signature" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const payload = JSON.parse(rawBody);
    const event = payload?.event as string;
    const subscription = payload?.payload?.subscription?.entity;

    if (!subscription) {
      console.warn("[razorpay-webhook] No subscription entity in payload");
      return new Response(JSON.stringify({ status: "no_entity" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const razorpaySubscriptionId = subscription.id as string;
    const currentStart = subscription.current_start
      ? new Date(subscription.current_start * 1000).toISOString()
      : null;
    const currentEnd = subscription.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : null;

    // Find tenant by razorpay_subscription_id
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("razorpay_subscription_id", razorpaySubscriptionId)
      .single();

    if (tenantError || !tenant) {
      console.error(
        "[razorpay-webhook] Tenant not found for subscription:",
        razorpaySubscriptionId
      );
      return new Response(JSON.stringify({ status: "tenant_not_found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle events
    switch (event) {
      case "subscription.activated":
      case "subscription.charged": {
        const updateData: Record<string, unknown> = {
          subscription_status: "active",
        };
        if (currentStart) updateData.subscription_start = currentStart;
        if (currentEnd) updateData.subscription_end = currentEnd;

        await supabase.from("tenants").update(updateData).eq("id", tenant.id);
        console.log(`[razorpay-webhook] Tenant ${tenant.id} activated/charged`);
        break;
      }

      case "subscription.cancelled": {
        await supabase
          .from("tenants")
          .update({ subscription_status: "cancelled" })
          .eq("id", tenant.id);
        console.log(`[razorpay-webhook] Tenant ${tenant.id} cancelled`);
        break;
      }

      default:
        console.log(`[razorpay-webhook] Unhandled event: ${event}`);
    }
  } catch (err) {
    console.error("[razorpay-webhook] Error processing webhook:", err);
  }

  // Always return 200
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
