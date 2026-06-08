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
      },
    }
  )
}
