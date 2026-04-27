import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';
import { getOptionalPublicSupabaseEnv } from './config';

type BrowserSupabaseClient = ReturnType<typeof createPagesBrowserClient<Database>>;

declare global {
  var __supabaseBrowserClient: BrowserSupabaseClient | undefined;
}

/** Same as {@link getBrowserSupabaseClient} but returns null when public env vars are missing (no throw). */
export function tryGetBrowserSupabaseClient(): BrowserSupabaseClient | null {
  if (globalThis.__supabaseBrowserClient) {
    return globalThis.__supabaseBrowserClient;
  }

  const publicEnv = getOptionalPublicSupabaseEnv();
  if (!publicEnv) return null;

  const client = createPagesBrowserClient<Database>({
    supabaseUrl: publicEnv.url,
    supabaseKey: publicEnv.anonKey
  });

  globalThis.__supabaseBrowserClient = client;
  return client;
}

export function getBrowserSupabaseClient(): BrowserSupabaseClient {
  const client = tryGetBrowserSupabaseClient();
  if (!client) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return client;
}
