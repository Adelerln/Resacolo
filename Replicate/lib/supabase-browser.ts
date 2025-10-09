'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralised factory to create a Supabase client on the client side.
 * Auth helpers automatically keep cookies in sync for us.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  return createClientComponentClient();
}
