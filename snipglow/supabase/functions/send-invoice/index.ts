import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InvoiceItem {
  id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

interface InvoiceData {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string;
  invoice_number: string;
  subtotal: number;
  discount_amount: number;
  discount_pct: number;
  gst_amount: number;
  gst_rate: number;
  total: number;
  payment_method: string;
  payment_status: string;
  delivery_status: string;
  created_at: string;
}

interface CustomerData {
  id: string;
  name: string;
  phone: string;
}

interface BranchData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

interface TenantData {
  id: string;
  name: string;
}

/**
 * Format amount in INR using Indian numbering system (e.g., 1,50,000)
 */
function formatINR(amount: number): string {
  const formatted = amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `₹${formatted}`;
}

/**
 * Generate a plain-text invoice receipt for WhatsApp delivery.
 * Since @react-pdf/renderer doesn't work in Deno, we use a text-based approach
 * and send via WhatsApp template message with invoice details.
 */
function generateInvoiceText(
  invoice: InvoiceData,
  items: InvoiceItem[],
  customer: CustomerData,
  branch: BranchData,
  tenant: TenantData
): string {
  const date = new Date(invoice.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  let text = `📄 INVOICE ${invoice.invoice_number}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `${tenant.name} - ${branch.name}\n`;
  if (branch.address) text += `${branch.address}\n`;
  text += `Date: ${date}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `Customer: ${customer.name}\n\n`;
  text += `Services:\n`;

  for (const item of items) {
    text += `• ${item.service_name} x${item.quantity} — ${formatINR(item.line_total)}\n`;
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Subtotal: ${formatINR(invoice.subtotal)}\n`;

  if (invoice.discount_amount > 0) {
    text += `Discount (${invoice.discount_pct}%): -${formatINR(invoice.discount_amount)}\n`;
  }

  if (invoice.gst_amount > 0) {
    text += `GST (${invoice.gst_rate}%): +${formatINR(invoice.gst_amount)}\n`;
  }

  text += `Total: ${formatINR(invoice.total)}\n`;
  text += `Payment: ${invoice.payment_method.toUpperCase()}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Thank you for visiting! 💇`;

  return text;
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

  // Initialize Supabase client with service role key (bypasses RLS)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  let invoiceId: string | undefined;

  try {
    const body = await req.json();
    invoiceId = body.invoice_id;

    if (!invoiceId || typeof invoiceId !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "invoice_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch invoice items
    const { data: items, error: itemsError } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId);

    if (itemsError || !items) {
      throw new Error(`Failed to fetch invoice items: ${itemsError?.message}`);
    }

    // 3. Fetch customer data
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("id", invoice.customer_id)
      .single();

    if (customerError || !customer) {
      throw new Error(`Failed to fetch customer: ${customerError?.message}`);
    }

    // 4. Fetch branch data
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id, name, address, phone")
      .eq("id", invoice.branch_id)
      .single();

    if (branchError || !branch) {
      throw new Error(`Failed to fetch branch: ${branchError?.message}`);
    }

    // 5. Fetch tenant data
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", invoice.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Failed to fetch tenant: ${tenantError?.message}`);
    }

    // 6. Generate text-based invoice content
    const invoiceText = generateInvoiceText(
      invoice as InvoiceData,
      items as InvoiceItem[],
      customer as CustomerData,
      branch as BranchData,
      tenant as TenantData
    );

    // 7. Upload invoice text as a file to Supabase Storage for reference
    const storagePath = `invoices/${invoice.tenant_id}/${invoice.branch_id}/${invoice.invoice_number}.txt`;
    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(storagePath, new Blob([invoiceText], { type: "text/plain" }), {
        contentType: "text/plain",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      // Non-fatal: continue with WhatsApp delivery even if storage fails
    }

    // 8. Update invoice pdf_storage_path
    await supabase
      .from("invoices")
      .update({ pdf_storage_path: storagePath })
      .eq("id", invoiceId);

    // 9. Send WhatsApp template message with invoice details
    const metaToken = Deno.env.get("META_WHATSAPP_TOKEN")!;
    const phoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID")!;

    // Use the invoice_message template:
    // Body: "Hi {{1}}, thank you for visiting {{2}}! 🙏\n\nYour invoice #{{3}} for ₹{{4}} is ready. Your digital bill is attached.\n\nHope to see you again soon! 💇"
    // Parameters: [customer_name, salon_name, invoice_number, total_amount]
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
            name: "invoice_message",
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: customer.name },
                  { type: "text", text: tenant.name },
                  { type: "text", text: invoice.invoice_number },
                  { type: "text", text: formatINR(invoice.total) },
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
      console.error("Meta API error:", errorBody);

      // Update delivery_status to 'failed'
      await supabase
        .from("invoices")
        .update({ delivery_status: "failed" })
        .eq("id", invoiceId);

      // Log failure to whatsapp_sessions
      await supabase.from("whatsapp_sessions").insert({
        tenant_id: invoice.tenant_id,
        branch_id: invoice.branch_id,
        message_id: null,
        phone: customer.phone,
        template_name: "invoice_message",
        direction: "outbound",
        status: "failed",
        error_details: errorBody,
        metadata: {
          invoice_id: invoiceId,
          invoice_number: invoice.invoice_number,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send invoice via WhatsApp",
          delivery_status: "failed",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse Meta API response to get message ID
    const metaResult = await metaResponse.json();
    messageId = metaResult?.messages?.[0]?.id || null;

    // 10. Update delivery_status to 'sent'
    await supabase
      .from("invoices")
      .update({ delivery_status: "sent" })
      .eq("id", invoiceId);

    // 11. Create whatsapp_sessions record for tracking
    await supabase.from("whatsapp_sessions").insert({
      tenant_id: invoice.tenant_id,
      branch_id: invoice.branch_id,
      message_id: messageId,
      phone: customer.phone,
      template_name: "invoice_message",
      direction: "outbound",
      status: "sent",
      error_details: null,
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        storage_path: storagePath,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        delivery_status: "sent",
        message_id: messageId,
        storage_path: storagePath,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in send-invoice:", err);

    // On failure: set delivery_status to 'failed' and log error
    if (invoiceId) {
      try {
        await supabase
          .from("invoices")
          .update({ delivery_status: "failed" })
          .eq("id", invoiceId);

        // Attempt to get invoice data for session logging
        const { data: invoice } = await supabase
          .from("invoices")
          .select("tenant_id, branch_id, customer_id, invoice_number")
          .eq("id", invoiceId)
          .single();

        if (invoice) {
          const { data: customer } = await supabase
            .from("customers")
            .select("phone")
            .eq("id", invoice.customer_id)
            .single();

          await supabase.from("whatsapp_sessions").insert({
            tenant_id: invoice.tenant_id,
            branch_id: invoice.branch_id,
            message_id: null,
            phone: customer?.phone || "unknown",
            template_name: "invoice_message",
            direction: "outbound",
            status: "failed",
            error_details: err instanceof Error ? err.message : String(err),
            metadata: {
              invoice_id: invoiceId,
              invoice_number: invoice.invoice_number,
            },
          });
        }
      } catch (logErr) {
        console.error("Failed to log error to whatsapp_sessions:", logErr);
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
