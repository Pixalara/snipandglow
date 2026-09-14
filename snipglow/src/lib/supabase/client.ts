import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // PKCE flow (recommended for @supabase/ssr): OAuth returns a ?code= that
        // the server callback route exchanges for a session and writes as
        // cookies BEFORE redirecting. This fixes the "first attempt fails,
        // second works" bug that implicit flow caused — implicit stored the
        // session only in localStorage, so the server middleware saw no session
        // cookie on the first redirect to /dashboard and bounced back to login.
        flowType: 'pkce',

        // Single-refresher policy. The middleware refreshes the session on every
        // navigation (getUser() rotates the token and rewrites the cookies). If
        // the browser client ALSO auto-refreshed, both would race to redeem the
        // same one-time refresh token: whichever loses ends up holding a token
        // the server already rotated away, the cookies desync, and the tenant is
        // randomly logged out mid-session. Letting only the server refresh keeps
        // exactly one writer of the auth cookies. This app is server/RSC-centric
        // and gates auth in middleware, so an idle client with an expired access
        // token simply refreshes on its next navigation via the still-valid
        // refresh token — no user-visible logout.
        autoRefreshToken: false,
      },
    }
  )
}
