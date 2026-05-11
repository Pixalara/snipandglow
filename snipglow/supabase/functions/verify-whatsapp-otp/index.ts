import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  try {
    const { phone, code } = await req.json();

    if (!phone || typeof phone !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "OTP code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Query for valid OTP: matching phone + code, not expired, not used
    const { data: otpRecords, error: queryError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phone)
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError) {
      console.error("OTP query error:", queryError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to verify OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpRecords || otpRecords.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired OTP" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otpRecord = otpRecords[0];

    // Mark OTP as used
    const { error: updateError } = await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpRecord.id);

    if (updateError) {
      console.error("Failed to mark OTP as used:", updateError);
    }

    // Look up existing user by phone number
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    let userId: string | undefined;

    if (!listError && existingUsers) {
      const existingUser = existingUsers.users.find(
        (u) => u.phone === phone || u.user_metadata?.phone === phone
      );
      if (existingUser) {
        userId = existingUser.id;
      }
    }

    // If no existing user, create one
    if (!userId) {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        phone,
        phone_confirm: true,
        user_metadata: { phone, login_method: "whatsapp_otp" },
      });

      if (createError) {
        console.error("Failed to create user:", createError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create user account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
    }

    // Generate a session token for the user via admin API.
    // We use generateLink with a synthetic email derived from the phone number
    // to obtain a hashed_token that the frontend can exchange for a session.
    const syntheticEmail = `${phone.replace("+", "")}@phone.snipglow.app`;

    const { data: signInData, error: signInError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: syntheticEmail,
        options: {
          data: { phone, login_method: "whatsapp_otp" },
        },
      });

    if (signInError || !signInData) {
      console.error("Failed to generate auth link:", signInError);
      // Fallback: return user ID so frontend can handle session creation
      return new Response(
        JSON.stringify({
          success: true,
          token: userId,
          message: "OTP verified successfully",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the token from the generated link
    const token = signInData.properties?.hashed_token || userId;

    return new Response(
      JSON.stringify({
        success: true,
        token,
        user_id: userId,
        message: "OTP verified successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
