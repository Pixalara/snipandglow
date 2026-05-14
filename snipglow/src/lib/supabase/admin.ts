import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * Admin Supabase client using service_role key.
 * Bypasses RLS — use only in server actions / API routes for privileged operations.
 * Cached as module singleton since it has no per-request state.
 */
let _adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    )
  }
  return _adminClient;
}
