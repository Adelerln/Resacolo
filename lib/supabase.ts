import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __supabaseClient: SupabaseClient | undefined;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes. Vérifie ton fichier .env.local.'
  );
}

export function getSupabaseClient(): SupabaseClient {
  if (globalThis.__supabaseClient) {
    return globalThis.__supabaseClient;
  }

  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: false
    }
  });

  globalThis.__supabaseClient = client;
  return client;
}
