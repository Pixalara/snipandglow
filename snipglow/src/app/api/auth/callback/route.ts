import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the authenticated user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check if phone is verified — if not, redirect to phone verification
        const hasPhone = user.user_metadata?.phone || user.phone;
        if (!hasPhone) {
          return NextResponse.redirect(`${origin}/verify-phone`);
        }

        // Check if user has an employee record
        const { data: employee } = await supabase
          .from("employees")
          .select("tenant_id, branch_id, role")
          .eq("auth_user_id", user.id)
          .eq("is_active", true)
          .single();

        if (employee) {
          // Update user metadata with tenant context (JWT custom claims)
          await supabase.auth.updateUser({
            data: {
              tenant_id: employee.tenant_id,
              branch_id: employee.branch_id,
              role: employee.role,
            },
          });
          return NextResponse.redirect(`${origin}${next}`);
        } else {
          // No employee record — redirect to onboarding
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
