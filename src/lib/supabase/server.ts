import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getSupabaseEnv } from './config';

declare global {
  // eslint-disable-next-line no-var
  var __supabaseServerClient: SupabaseClient<Database> | undefined;
}

export function getServerSupabaseClient(): SupabaseClient<Database> {
  if (globalThis.__supabaseServerClient) {
    return globalThis.__supabaseServerClient;
  }

  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  const client = createClient<Database>(url, serviceRoleKey ?? anonKey, {
    auth: { persistSession: false }
  });

  globalThis.__supabaseServerClient = client;
  return client;
}
