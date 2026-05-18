import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that don't require authentication
const publicRoutes = new Set(["/", "/login", "/verify-otp", "/verify-phone", "/signup", "/blog", "/privacy", "/terms", "/refund"]);

// Prefixes that are always public
const publicPrefixes = ["/api/auth", "/api/whatsapp", "/blog/"];

// Routes that require authentication (dashboard section)
const protectedPrefixes = ["/dashboard", "/onboarding"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // FAST PATH: Skip auth entirely for public routes (no Supabase client created)
  if (publicRoutes.has(pathname) || publicPrefixes.some(p => pathname.startsWith(p))) {
    return NextResponse.next({ request });
  }

  // Only create Supabase client for protected routes
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  const role = user.user_metadata?.role;

  // Authenticated but no tenant → onboarding
  if (!tenantId && !pathname.startsWith("/onboarding")) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  // Has tenant but on onboarding → redirect to dashboard
  if (tenantId && pathname.startsWith("/onboarding")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Inject tenant context headers for Server Components
  if (tenantId) {
    supabaseResponse.headers.set("x-tenant-id", tenantId);
  }
  if (branchId) {
    supabaseResponse.headers.set("x-branch-id", branchId);
  }
  if (role) {
    supabaseResponse.headers.set("x-user-role", role);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|mp4)$).*)",
  ],
};
