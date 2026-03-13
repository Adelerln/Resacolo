import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getSupabaseEnv } from './config';

declare global {
  // eslint-disable-next-line no-var
  var __supabaseBrowserClient: SupabaseClient<Database> | undefined;
}

export function getBrowserSupabaseClient(): SupabaseClient<Database> {
  if (globalThis.__supabaseBrowserClient) {
    return globalThis.__supabaseBrowserClient;
  }

  const { url, anonKey } = getSupabaseEnv();
  const client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false }
  });

  globalThis.__supabaseBrowserClient = client;
  return client;
}
