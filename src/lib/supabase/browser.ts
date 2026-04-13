import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getOptionalPublicSupabaseEnv } from './config';

declare global {
  // eslint-disable-next-line no-var
  var __supabaseBrowserClient: SupabaseClient<Database> | undefined;
}

const browserAuthOptions = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true
} as const;

/** Same as {@link getBrowserSupabaseClient} but returns null when public env vars are missing (no throw). */
export function tryGetBrowserSupabaseClient(): SupabaseClient<Database> | null {
  if (globalThis.__supabaseBrowserClient) {
    return globalThis.__supabaseBrowserClient;
  }

  const publicEnv = getOptionalPublicSupabaseEnv();
  if (!publicEnv) return null;

  const client = createClient<Database>(publicEnv.url, publicEnv.anonKey, {
    auth: browserAuthOptions
  });

  globalThis.__supabaseBrowserClient = client;
  return client;
}

export function getBrowserSupabaseClient(): SupabaseClient<Database> {
  const client = tryGetBrowserSupabaseClient();
  if (!client) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return client;
}
