import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { nextSignupStep } from "@/lib/auth/signup-state";

// Routes that don't require authentication
const publicRoutes = new Set(["/", "/login", "/verify-otp", "/verify-phone", "/signup", "/blog", "/privacy", "/terms", "/refund", "/auth/confirm"]);

// Prefixes that are always public
const publicPrefixes = ["/api/auth", "/api/whatsapp", "/api/cron", "/blog/", "/cal/", "/book/"];

// Admin-area public paths (login, forbidden)
const adminPublicPaths = new Set(["/admin/login", "/admin/forbidden"]);

// Routes that require authentication (dashboard section)
const protectedPrefixes = ["/dashboard", "/onboarding", "/admin"];

/**
 * Build a redirect that carries over any auth cookies Supabase refreshed onto
 * `source`. Calling `getUser()` can rotate the access/refresh tokens and write
 * the new pair onto `supabaseResponse` via setAll. A bare
 * `NextResponse.redirect()` starts from a clean response and therefore DROPS
 * those Set-Cookie headers — the browser keeps the now-stale (rotated-away)
 * tokens, the very next request fails auth, and the tenant is silently logged
 * out. Copying the cookies onto the redirect preserves the refreshed session so
 * navigation only ever ends at /login when the user is genuinely signed out.
 */
function redirectWithCookies(url: URL, source: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get('host') || '';

  // ─── Subdomain routing: admin.snipandglow.com → /admin/* ───
  // If the request comes to admin subdomain and path doesn't start with /admin, rewrite it
  const isAdminSubdomain = host.startsWith('admin.');
  if (isAdminSubdomain && !pathname.startsWith('/admin') && !pathname.startsWith('/api/') && !pathname.startsWith('/_next/')) {
    // Only rewrite non-admin paths (e.g., "/" → "/admin", "/tenants" → "/admin/tenants")
    const url = request.nextUrl.clone();
    url.pathname = '/admin' + (pathname === '/' ? '' : pathname);
    return NextResponse.rewrite(url);
  }

  // FAST PATH: Skip auth entirely for public routes (no Supabase client created)
  if ((publicRoutes.has(pathname) || publicPrefixes.some(p => pathname.startsWith(p))) && !pathname.startsWith('/admin')) {
    return NextResponse.next({ request });
  }

  // Admin public pages (login, forbidden) — no auth required to view, but need supabase for login
  if (adminPublicPaths.has(pathname)) {
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
    // Admin paths redirect to admin login
    if (pathname.startsWith('/admin')) {
      url.pathname = '/admin/login';
    } else {
      url.pathname = '/login';
    }
    return redirectWithCookies(url, supabaseResponse);
  }

  // Skip tenant checks for admin paths — admin users don't need tenant_id
  if (pathname.startsWith('/admin')) {
    return supabaseResponse;
  }

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  const role = user.user_metadata?.role;

  // ─── Signup completeness gate ─────────────────────────────────────────────
  //
  // Every new salon must clear BOTH Google (a real, contactable email) and
  // WhatsApp OTP before it can create a tenant. `nextSignupStep` is the shared
  // rule, also used by the OAuth callback, /auth/confirm and /verify-phone, so
  // there is exactly one definition of "signup finished".
  //
  // Accounts that ALREADY have a tenant return '/dashboard' from the helper and
  // so fall through untouched — existing owners and owner-created staff are never
  // re-verified, which would otherwise lock paying customers out.
  const step = nextSignupStep(user);

  if (step !== "/dashboard" && !pathname.startsWith(step)) {
    const url = request.nextUrl.clone();
    url.pathname = step;
    url.search = "";
    return redirectWithCookies(url, supabaseResponse);
  }

  // Has tenant but on onboarding → redirect to dashboard
  if (tenantId && pathname.startsWith("/onboarding")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return redirectWithCookies(url, supabaseResponse);
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
