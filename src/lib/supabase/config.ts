type SupabaseEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/**
 * Public URL + anon key only; returns null if either is missing.
 * IMPORTANT: NEXT_PUBLIC_* must be read with static property access so Next.js
 * can inline them into the browser bundle (dynamic process.env[name] is empty client-side).
 */
export function getOptionalPublicSupabaseEnv(): Pick<SupabaseEnv, 'url' | 'anonKey'> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getSupabaseEnv(): SupabaseEnv {
  const publicEnv = getOptionalPublicSupabaseEnv();
  if (!publicEnv) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  return { ...publicEnv, serviceRoleKey };
}
