import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * WhatsApp Flow Data Exchange Endpoint
 *
 * This Edge Function handles the 5-screen booking flow for WhatsApp Flows:
 * SELECT_SERVICE → SELECT_STYLIST → SELECT_DATE → SELECT_TIME → CONFIRM
 *
 * Meta sends POST requests for each screen transition. In production, payloads
 * would be encrypted with AES-GCM (see encryption note below). This implementation
 * handles decrypted/plain JSON payloads for simplicity.
 *
 * NOTE: Production deployment requires an AES-GCM encryption/decryption layer.
 * Meta encrypts flow data exchange payloads using the business's RSA public key.
 * The function must decrypt incoming requests and encrypt outgoing responses.
 * See: https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint
 *
 * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 18.2
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- Types ---

interface FlowRequest {
  version: string;
  action: "ping" | "INIT" | "data_exchange";
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
}

interface FlowResponse {
  version: string;
  screen: string;
  data: Record<string, unknown>;
}

interface ServiceRow {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  price: number;
}

interface EmployeeRow {
  id: string;
  name: string;
  specializations: string[] | null;
}

interface BranchRow {
  id: string;
  tenant_id: string;
  operating_hours: Record<string, { open: string; close: string } | null>;
}

interface SlotRow {
  slot_start: string;
  slot_end: string;
}

// --- Helpers ---

/**
 * Resolve tenant_id and branch_id from the flow_token.
 * The flow_token is expected to contain branch context encoded as:
 *   `booking_{branchId}_{timestamp}` or just use a header fallback.
 */
async function resolveTenantBranch(
  supabase: ReturnType<typeof createClient>,
  flowToken: string | undefined,
  req: Request
): Promise<{ tenantId: string; branchId: string } | null> {
  // Try to extract branch_id from flow_token pattern: booking_{branchId}_{timestamp}
  if (flowToken) {
    const parts = flowToken.split("_");
    if (parts.length >= 2 && parts[0] === "booking") {
      // If the second part looks like a UUID, use it as branch_id
      const possibleBranchId = parts[1];
      if (
        possibleBranchId &&
        possibleBranchId.length === 36 &&
        possibleBranchId.includes("-")
      ) {
        const { data: branch } = await supabase
          .from("branches")
          .select("id, tenant_id")
          .eq("id", possibleBranchId)
          .eq("is_active", true)
          .single();

        if (branch) {
          return { tenantId: branch.tenant_id, branchId: branch.id };
        }
      }
    }
  }

  // Fallback: resolve from x-branch-id / x-tenant-id headers
  const branchId = req.headers.get("x-branch-id");
  const tenantId = req.headers.get("x-tenant-id");

  if (branchId && tenantId) {
    return { tenantId, branchId };
  }

  // Last resort: use the first active branch (for single-branch tenants in dev)
  const { data: branch } = await supabase
    .from("branches")
    .select("id, tenant_id")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (branch) {
    return { tenantId: branch.tenant_id, branchId: branch.id };
  }

  return null;
}

/**
 * Format time string (HH:MM:SS or HH:MM) to 12-hour IST display format.
 */
function formatTimeIST(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Get the 3-letter lowercase day abbreviation for a date string.
 */
function getDayAbbreviation(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00+05:30"); // IST
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return days[date.getDay()];
}

/**
 * Format a date string (YYYY-MM-DD) to display format (DD MMM YYYY).
 */
function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00+05:30");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// --- Screen Handlers ---

async function handleSelectService(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  branchId: string,
  version: string
): Promise<FlowResponse> {
  const { data: services, error } = await supabase
    .from("services")
    .select("id, name, category, duration_minutes, price")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch services: ${error.message}`);
  }

  const serviceList = (services as ServiceRow[]).map((s) => ({
    id: s.id,
    title: s.name,
    description: `₹${s.price} • ${s.duration_minutes} mins`,
  }));

  return {
    version,
    screen: "SELECT_SERVICE",
    data: { services: serviceList },
  };
}

async function handleSelectStylist(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  branchId: string,
  _serviceId: string,
  version: string
): Promise<FlowResponse> {
  // Return active employees for the branch
  // In a more advanced implementation, filter by employees who can perform the selected service
  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, name, specializations")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .in("role", ["staff", "manager"]) // stylists are staff or managers
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch employees: ${error.message}`);
  }

  const stylistList = (employees as EmployeeRow[]).map((e) => ({
    id: e.id,
    title: e.name,
  }));

  // Add "Any available stylist" option
  stylistList.push({ id: "any", title: "Any available stylist" });

  return {
    version,
    screen: "SELECT_STYLIST",
    data: { stylists: stylistList },
  };
}

async function handleSelectDate(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  branchId: string,
  version: string
): Promise<FlowResponse> {
  // Get branch operating hours to determine closed days
  const { data: branch, error } = await supabase
    .from("branches")
    .select("id, tenant_id, operating_hours")
    .eq("id", branchId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !branch) {
    throw new Error(`Failed to fetch branch: ${error?.message || "not found"}`);
  }

  const operatingHours = (branch as BranchRow).operating_hours || {};

  // Generate next 14 available days (excluding closed days)
  const dates: { id: string; title: string }[] = [];
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  let daysChecked = 0;
  const maxDaysToCheck = 30; // Look ahead up to 30 days to find 14 open days

  while (dates.length < 14 && daysChecked < maxDaysToCheck) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + daysChecked + 1); // Start from tomorrow

    const dateStr = checkDate.toISOString().split("T")[0];
    const dayAbbr = getDayAbbreviation(dateStr);

    // Check if branch is open on this day
    const dayHours = operatingHours[dayAbbr];
    if (dayHours && dayHours.open && dayHours.close) {
      dates.push({
        id: dateStr,
        title: formatDateDisplay(dateStr),
      });
    }

    daysChecked++;
  }

  return {
    version,
    screen: "SELECT_DATE",
    data: { dates },
  };
}

async function handleSelectTime(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  branchId: string,
  data: Record<string, unknown>,
  version: string
): Promise<FlowResponse> {
  const employeeId = data.employee_id as string;
  const date = data.date as string;
  const serviceId = data.service_id as string;

  // Get service duration
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .eq("tenant_id", tenantId)
    .single();

  if (serviceError || !service) {
    throw new Error(
      `Failed to fetch service: ${serviceError?.message || "not found"}`
    );
  }

  const duration = service.duration_minutes;

  // If "any" stylist selected, pick the first available employee
  let resolvedEmployeeId = employeeId;
  if (employeeId === "any") {
    const { data: employees } = await supabase
      .from("employees")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .in("role", ["staff", "manager"])
      .limit(1)
      .single();

    if (employees) {
      resolvedEmployeeId = employees.id;
    } else {
      throw new Error("No available stylists found");
    }
  }

  // Call the get_available_slots RPC function
  const { data: slots, error: slotsError } = await supabase.rpc(
    "get_available_slots",
    {
      p_employee_id: resolvedEmployeeId,
      p_date: date,
      p_duration: duration,
    }
  );

  if (slotsError) {
    throw new Error(`Failed to fetch slots: ${slotsError.message}`);
  }

  const slotList = ((slots as SlotRow[]) || []).map((s) => ({
    id: s.slot_start,
    title: formatTimeIST(s.slot_start),
  }));

  return {
    version,
    screen: "SELECT_TIME",
    data: { slots: slotList },
  };
}

async function handleConfirm(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  branchId: string,
  data: Record<string, unknown>,
  flowToken: string | undefined,
  version: string
): Promise<FlowResponse> {
  const serviceId = data.service_id as string;
  const employeeId = data.employee_id as string;
  const date = data.date as string;
  const timeSlot = data.time_slot as string;
  const customerPhone = data.customer_phone as string | undefined;

  // Get service details for confirmation message
  const { data: service } = await supabase
    .from("services")
    .select("name, duration_minutes, price")
    .eq("id", serviceId)
    .single();

  if (!service) {
    throw new Error("Service not found");
  }

  // Resolve employee (handle "any" case)
  let resolvedEmployeeId = employeeId;
  let stylistName = "Any available stylist";

  if (employeeId === "any") {
    const { data: employees } = await supabase
      .from("employees")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .in("role", ["staff", "manager"])
      .limit(1)
      .single();

    if (employees) {
      resolvedEmployeeId = employees.id;
      stylistName = employees.name;
    } else {
      throw new Error("No available stylists found");
    }
  } else {
    const { data: employee } = await supabase
      .from("employees")
      .select("name")
      .eq("id", employeeId)
      .single();

    if (employee) {
      stylistName = employee.name;
    }
  }

  // Calculate end_time from start_time + duration
  const [hours, minutes] = timeSlot.split(":").map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + service.duration_minutes;
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  const endTime = `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;

  // Find or create customer by phone (if phone provided)
  let customerId: string | null = null;
  if (customerPhone) {
    const formattedPhone = customerPhone.startsWith("+91")
      ? customerPhone
      : `+91${customerPhone.replace(/^0+/, "")}`;

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("phone", formattedPhone)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Create a new customer record
      const { data: newCustomer } = await supabase
        .from("customers")
        .insert({
          tenant_id: tenantId,
          branch_id: branchId,
          name: "WhatsApp Customer",
          phone: formattedPhone,
        })
        .select("id")
        .single();

      if (newCustomer) {
        customerId = newCustomer.id;
      }
    }
  }

  if (!customerId) {
    throw new Error("Could not resolve customer for appointment");
  }

  // Create the appointment
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      customer_id: customerId,
      service_id: serviceId,
      employee_id: resolvedEmployeeId,
      appointment_date: date,
      start_time: timeSlot,
      end_time: endTime,
      status: "booked",
      source: "whatsapp_flow",
      whatsapp_flow_ref: flowToken || null,
    })
    .select("id")
    .single();

  if (appointmentError) {
    throw new Error(
      `Failed to create appointment: ${appointmentError.message}`
    );
  }

  // Build confirmation message
  const confirmationMessage =
    `✅ Appointment confirmed!\n` +
    `📅 ${formatDateDisplay(date)}\n` +
    `⏰ ${formatTimeIST(timeSlot)}\n` +
    `💇 ${service.name}\n` +
    `👤 ${stylistName}`;

  return {
    version,
    screen: "SUCCESS",
    data: {
      message: confirmationMessage,
      appointment_id: appointment?.id,
    },
  };
}

// --- Main Data Exchange Router ---

async function handleDataExchange(
  supabase: ReturnType<typeof createClient>,
  request: FlowRequest,
  tenantId: string,
  branchId: string
): Promise<FlowResponse> {
  const screen = request.screen || "";
  const data = request.data || {};
  const version = request.version;

  switch (screen) {
    case "SELECT_SERVICE":
      return await handleSelectService(supabase, tenantId, branchId, version);

    case "SELECT_STYLIST":
      return await handleSelectStylist(
        supabase,
        tenantId,
        branchId,
        data.service_id as string,
        version
      );

    case "SELECT_DATE":
      return await handleSelectDate(supabase, tenantId, branchId, version);

    case "SELECT_TIME":
      return await handleSelectTime(
        supabase,
        tenantId,
        branchId,
        data,
        version
      );

    case "CONFIRM":
      return await handleConfirm(
        supabase,
        tenantId,
        branchId,
        data,
        request.flow_token,
        version
      );

    default:
      throw new Error(`Unknown screen: ${screen}`);
  }
}

// --- Main Handler ---

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  // Initialize Supabase client with service role key (bypasses RLS)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const rawBody = await req.text();

    // NOTE: In production, the incoming payload would be AES-GCM encrypted.
    // You would decrypt it here using the business's RSA private key:
    //   1. Parse { encrypted_aes_key, encrypted_flow_data, initial_vector }
    //   2. Decrypt AES key with RSA-OAEP private key
    //   3. Decrypt flow_data with AES-128-GCM using the decrypted AES key + IV
    // For development/testing, we accept plain JSON payloads.
    const request: FlowRequest = JSON.parse(rawBody);

    // --- Handle ping action (health check) ---
    if (request.action === "ping") {
      return new Response(
        JSON.stringify({ data: { status: "active" } }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- Resolve tenant/branch context ---
    const context = await resolveTenantBranch(
      supabase,
      request.flow_token,
      req
    );

    if (!context) {
      console.error(
        "[whatsapp-flow-endpoint] Could not resolve tenant/branch"
      );
      return new Response(
        JSON.stringify({
          version: request.version,
          screen: "SUCCESS",
          data: {
            message:
              "❌ Sorry, we couldn't process your request. Please try again or call the salon directly.",
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { tenantId, branchId } = context;

    // --- Handle INIT action ---
    if (request.action === "INIT") {
      // Return the first screen data
      const response = await handleSelectService(
        supabase,
        tenantId,
        branchId,
        request.version
      );
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Handle data_exchange action ---
    if (request.action === "data_exchange") {
      const response = await handleDataExchange(
        supabase,
        request,
        tenantId,
        branchId
      );

      // NOTE: In production, the response would be AES-GCM encrypted before sending.
      // You would encrypt it using the same AES key and a new IV.
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unknown action
    return new Response(
      JSON.stringify({
        version: request.version,
        screen: "SUCCESS",
        data: { message: "Unknown action" },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // On any error: return a fallback error response
    console.error("[whatsapp-flow-endpoint] Error:", error);

    return new Response(
      JSON.stringify({
        version: "3.0",
        screen: "SUCCESS",
        data: {
          message:
            "❌ Sorry, something went wrong while processing your booking. Please try again or call the salon directly.",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
