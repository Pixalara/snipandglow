// =============================================================================
// RETIRED — verify-whatsapp-otp
//
// This function is intentionally disabled. It returns 410 Gone.
//
// WHY IT HAD TO GO
// ----------------
// It minted a full Supabase session from a phone number and an OTP alone:
//
//   supabase.auth.admin.createUser({ phone, phone_confirm: true, ... })
//
// with NO email whatsoever — then handed back a magic-link token against a
// fabricated `<digits>@phone.snipglow.app` address. Any caller holding the anon
// key could reach it over HTTPS and end up with a signed-in account carrying no
// contactable email and no Google identity.
//
// Signup is now Google-first precisely so that every salon has a real, verified
// email for invoices, receipts, renewal notices and password recovery, with the
// WhatsApp number added on top (see src/lib/auth/signup-state.ts). This function
// bypassed both halves of that, so leaving it live would have made the new
// requirement unenforceable no matter what the Next.js layer did.
//
// It was also already dead code: nothing in `src/` ever invoked it. The live OTP
// flow is `POST /api/auth/send-otp` + `POST /api/auth/verify-otp` for sign-in, and
// `POST /api/auth/attach-phone` for adding a verified number during signup.
//
// It additionally read `otp_codes.used`, a column the Next.js routes do not use
// (they hard-delete consumed rows), so its single-use check was already unsound.
//
// DO NOT just delete this file: removing it locally does NOT remove the deployed
// function. This stub must be DEPLOYED to replace the live one:
//
//   supabase functions deploy verify-whatsapp-otp
//
// Once that is done it can be removed entirely with:
//
//   supabase functions delete verify-whatsapp-otp
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.warn(
    "[verify-whatsapp-otp] RETIRED endpoint was called — this is a signup-bypass attempt or a stale client.",
    { method: req.method, ua: req.headers.get("user-agent") ?? "unknown" }
  );

  return new Response(
    JSON.stringify({
      success: false,
      error: "GONE",
      message:
        "This endpoint has been retired. Sign-in uses /api/auth/verify-otp; adding a verified number during signup uses /api/auth/attach-phone.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
