import { createClient } from '@supabase/supabase-js';

function resolveEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function createSupabaseAdminClient() {
  const supabaseUrl = resolveEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey =
    resolveEnv('SUPABASE_SERVICE_ROLE_KEY') ?? resolveEnv('SUPABASE_SERVICE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL ou clé de service manquante dans la configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}
