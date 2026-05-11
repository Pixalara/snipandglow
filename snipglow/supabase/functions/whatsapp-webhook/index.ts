import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// --- Signature Verification ---

async function verifySignature(
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
  const computed =
    "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return computed === signature;
}

// --- Helper: Send WhatsApp Message ---

async function sendWhatsAppMessage(
  phone: string,
  messagePayload: Record<string, unknown>,
  metaToken: string,
  phoneNumberId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        ...messagePayload,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[whatsapp-webhook] Meta API send error:", errorBody);
    return { success: false, error: errorBody };
  }

  const data = await response.json();
  const messageId = data?.messages?.[0]?.id;
  return { success: true, messageId };
}

// --- Helper: Send Interactive Buttons (Main Menu) ---

function buildMainMenuPayload(to: string): Record<string, unknown> {
  return {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: "Welcome to Snip & Glow! ✨" },
      body: {
        text: "How can we help you today? Choose an option below:",
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "book_appointment", title: "Book Appointment" } },
          { type: "reply", reply: { id: "my_appointments", title: "My Appointments" } },
          { type: "reply", reply: { id: "services_prices", title: "Services & Prices" } },
        ],
      },
    },
  };
}

// --- Helper: Send Upcoming Appointments ---

async function sendUpcomingAppointments(
  phone: string,
  tenantId: string,
  branchId: string,
  supabase: ReturnType<typeof createClient>,
  metaToken: string,
  phoneNumberId: string
): Promise<void> {
  // Find customer by phone
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("phone", phone)
    .single();

  if (!customer) {
    await sendWhatsAppMessage(
      phone,
      { to: phone, type: "text", text: { body: "We couldn't find any appointments linked to your number. Please book a new appointment!" } },
      metaToken,
      phoneNumberId
    );
    return;
  }

  // Fetch upcoming appointments
  const today = new Date().toISOString().split("T")[0];
  const { data: appointments } = await supabase
    .from("appointments")
    .select("appointment_date, start_time, services(name), employees(name)")
    .eq("customer_id", customer.id)
    .eq("tenant_id", tenantId)
    .gte("appointment_date", today)
    .in("status", ["booked", "confirmed"])
    .order("appointment_date", { ascending: true })
    .limit(5);

  if (!appointments || appointments.length === 0) {
    await sendWhatsAppMessage(
      phone,
      { to: phone, type: "text", text: { body: "You have no upcoming appointments. Would you like to book one?" } },
      metaToken,
      phoneNumberId
    );
    return;
  }

  let message = `📅 *Your Upcoming Appointments*\n\n`;
  for (const appt of appointments) {
    const serviceName = (appt as any).services?.name || "Service";
    const stylistName = (appt as any).employees?.name || "Stylist";
    message += `• ${appt.appointment_date} at ${appt.start_time}\n  💇 ${serviceName} with ${stylistName}\n\n`;
  }

  await sendWhatsAppMessage(
    phone,
    { to: phone, type: "text", text: { body: message } },
    metaToken,
    phoneNumberId
  );
}

// --- Helper: Send Services & Prices ---

async function sendServicesPrices(
  phone: string,
  tenantId: string,
  branchId: string,
  supabase: ReturnType<typeof createClient>,
  metaToken: string,
  phoneNumberId: string
): Promise<void> {
  const { data: services } = await supabase
    .from("services")
    .select("name, category, duration_minutes, price")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("category", { ascending: true });

  if (!services || services.length === 0) {
    await sendWhatsAppMessage(
      phone,
      { to: phone, type: "text", text: { body: "Our service catalog is being updated. Please check back soon!" } },
      metaToken,
      phoneNumberId
    );
    return;
  }

  // Group by category
  const grouped: Record<string, typeof services> = {};
  for (const svc of services) {
    const cat = svc.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(svc);
  }

  let message = `💅 *Our Services & Prices*\n\n`;
  for (const [category, items] of Object.entries(grouped)) {
    message += `*${category}*\n`;
    for (const item of items) {
      message += `  • ${item.name} — ₹${item.price} (${item.duration_minutes} min)\n`;
    }
    message += `\n`;
  }

  await sendWhatsAppMessage(
    phone,
    { to: phone, type: "text", text: { body: message } },
    metaToken,
    phoneNumberId
  );
}

// --- Helper: Trigger WhatsApp Flow for Booking ---

async function triggerBookingFlow(
  phone: string,
  metaToken: string,
  phoneNumberId: string
): Promise<void> {
  // Send a flow message to initiate the booking WhatsApp Flow
  await sendWhatsAppMessage(
    phone,
    {
      to: phone,
      type: "interactive",
      interactive: {
        type: "flow",
        header: { type: "text", text: "Book an Appointment" },
        body: {
          text: "Tap the button below to book your appointment. Choose your service, stylist, date, and time!",
        },
        footer: { text: "Snip & Glow Salon" },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_action: "navigate",
            flow_token: `booking_${Date.now()}`,
            flow_cta: "Book Now",
            flow_id: Deno.env.get("META_WHATSAPP_FLOW_ID") || "",
            flow_action_payload: {
              screen: "SELECT_SERVICE",
            },
          },
        },
      },
    },
    metaToken,
    phoneNumberId
  );
}

// --- Helper: Log to whatsapp_sessions ---

async function logSession(
  supabase: ReturnType<typeof createClient>,
  params: {
    tenantId: string;
    branchId: string;
    messageId?: string;
    phone: string;
    direction: "inbound" | "outbound";
    status: string;
    errorDetails?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("whatsapp_sessions").insert({
    tenant_id: params.tenantId,
    branch_id: params.branchId,
    message_id: params.messageId || null,
    phone: params.phone,
    direction: params.direction,
    status: params.status,
    error_details: params.errorDetails || null,
    metadata: params.metadata || null,
  });

  if (error) {
    console.error("[whatsapp-webhook] Failed to log session:", error);
  }
}

// --- Helper: Resolve tenant/branch from phone number ---

async function resolveTenantBranch(
  supabase: ReturnType<typeof createClient>,
  businessPhone: string
): Promise<{ tenantId: string; branchId: string } | null> {
  const { data: branch } = await supabase
    .from("branches")
    .select("id, tenant_id")
    .eq("phone", businessPhone)
    .eq("is_active", true)
    .single();

  if (!branch) return null;
  return { tenantId: branch.tenant_id, branchId: branch.id };
}

// --- Booking Keywords ---

const BOOKING_KEYWORDS = ["book", "appointment", "slot", "hi", "hello", "hey"];

function containsBookingKeyword(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return BOOKING_KEYWORDS.some((kw) => lower.includes(kw));
}

// --- Main Handler ---

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // --- GET: Meta Webhook Verification ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && token === verifyToken) {
      console.log("[whatsapp-webhook] Webhook verified successfully");
      return new Response(challenge || "", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return new Response("Forbidden", {
      status: 403,
      headers: corsHeaders,
    });
  }

  // --- POST: Incoming Messages ---
  if (req.method === "POST") {
    const rawBody = await req.text();

    // Validate X-Hub-Signature-256
    const signature = req.headers.get("x-hub-signature-256") || "";
    const appSecret = Deno.env.get("META_APP_SECRET") || "";

    if (signature && appSecret) {
      const isValid = await verifySignature(rawBody, signature, appSecret);
      if (!isValid) {
        console.error("[whatsapp-webhook] Invalid signature");
        // Still return 200 to prevent retries
        return new Response("", {
          status: 200,
          headers: corsHeaders,
        });
      }
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const metaToken = Deno.env.get("META_WHATSAPP_TOKEN")!;
    const phoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID")!;

    try {
      const payload = JSON.parse(rawBody);

      // Meta webhook payload structure:
      // { object: "whatsapp_business_account", entry: [{ id, changes: [{ value: { ... } }] }] }
      const entries = payload?.entry || [];

      for (const entry of entries) {
        const changes = entry?.changes || [];

        for (const change of changes) {
          const value = change?.value;
          if (!value) continue;

          const businessPhoneNumberId = value?.metadata?.phone_number_id;
          const businessPhoneNumber = value?.metadata?.display_phone_number;

          // Resolve tenant/branch from the business phone number
          const context = await resolveTenantBranch(supabase, businessPhoneNumber);
          if (!context) {
            console.warn(
              `[whatsapp-webhook] No branch found for phone: ${businessPhoneNumber}`
            );
            continue;
          }

          const { tenantId, branchId } = context;

          // --- Handle Status Updates ---
          const statuses = value?.statuses || [];
          for (const status of statuses) {
            const statusValue = status?.status; // sent, delivered, read, failed
            const messageId = status?.id;
            const recipientPhone = status?.recipient_id;

            await logSession(supabase, {
              tenantId,
              branchId,
              messageId,
              phone: recipientPhone || "",
              direction: "outbound",
              status: statusValue,
              errorDetails:
                statusValue === "failed"
                  ? JSON.stringify(status?.errors || [])
                  : undefined,
              metadata: { raw_status: status },
            });
          }

          // --- Handle Incoming Messages ---
          const messages = value?.messages || [];
          for (const message of messages) {
            const senderPhone = message?.from;
            const messageId = message?.id;
            const messageType = message?.type;

            // Log inbound message
            await logSession(supabase, {
              tenantId,
              branchId,
              messageId,
              phone: senderPhone,
              direction: "inbound",
              status: "received",
              metadata: { type: messageType, message },
            });

            // --- Route by message type ---

            if (messageType === "text") {
              const textBody = message?.text?.body || "";

              if (containsBookingKeyword(textBody)) {
                // Send main menu with interactive buttons
                await sendWhatsAppMessage(
                  senderPhone,
                  buildMainMenuPayload(senderPhone),
                  metaToken,
                  phoneNumberId
                );
              }
            } else if (messageType === "interactive") {
              const interactiveType = message?.interactive?.type;

              if (interactiveType === "button_reply") {
                const buttonId =
                  message?.interactive?.button_reply?.id || "";

                switch (buttonId) {
                  case "book_appointment":
                    await triggerBookingFlow(
                      senderPhone,
                      metaToken,
                      phoneNumberId
                    );
                    break;

                  case "my_appointments":
                    await sendUpcomingAppointments(
                      senderPhone,
                      tenantId,
                      branchId,
                      supabase,
                      metaToken,
                      phoneNumberId
                    );
                    break;

                  case "services_prices":
                    await sendServicesPrices(
                      senderPhone,
                      tenantId,
                      branchId,
                      supabase,
                      metaToken,
                      phoneNumberId
                    );
                    break;

                  default:
                    console.log(
                      `[whatsapp-webhook] Unknown button reply: ${buttonId}`
                    );
                }
              }
            }
            // Other message types (image, location, etc.) are logged but not processed
          }
        }
      }
    } catch (err) {
      console.error("[whatsapp-webhook] Error processing webhook:", err);
    }

    // Always return 200 to prevent Meta retries
    return new Response("", {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Unsupported method
  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders,
  });
});
