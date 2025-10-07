import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __supabaseClient: SupabaseClient | undefined;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabaseClient(): SupabaseClient {
  if (!isConfigured) {
    throw new Error(
      'Supabase n’est pas configuré : définis NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY pour activer le formulaire de contact.'
    );
  }

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
