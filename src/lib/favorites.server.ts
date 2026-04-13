import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getSupabaseEnv } from '@/lib/supabase/config';
import type { Database } from '@/types/supabase';

const favoritePayloadSchema = z.object({
  stay_id: z.string().uuid()
});

function getRequestToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getAuthenticatedUserId(request: Request) {
  const token = getRequestToken(request);
  if (!token) return null;

  const { url, anonKey } = getSupabaseEnv();
  const authClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

  const {
    data: { user },
    error
  } = await authClient.auth.getUser();

  if (error || !user) return null;
  return user.id;
}

function getFavoritesAdminClient() {
  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  return createClient<Database>(url, serviceRoleKey ?? anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function getFavorites(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return { error: 'UNAUTHORIZED' as const, stayIds: [] };
  }

  const supabase = getFavoritesAdminClient();
  const { data, error } = await supabase
    .from('favorites')
    .select('stay_id')
    .eq('client_user_id', userId);

  if (error) {
    return { error: error.message, stayIds: [] };
  }

  return {
    error: null,
    stayIds: (data ?? []).map((row) => row.stay_id)
  };
}

export async function addFavorite(request: Request, payload: unknown) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return { error: 'UNAUTHORIZED' as const };
  }

  const parsedPayload = favoritePayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return { error: 'INVALID_STAY_ID' as const };
  }

  const supabase = getFavoritesAdminClient();
  const { error } = await supabase.from('favorites').upsert(
    {
      client_user_id: userId,
      stay_id: parsedPayload.data.stay_id
    },
    {
      onConflict: 'client_user_id,stay_id',
      ignoreDuplicates: true
    }
  );

  return { error: error?.message ?? null };
}

export async function removeFavorite(request: Request, payload: unknown) {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return { error: 'UNAUTHORIZED' as const };
  }

  const parsedPayload = favoritePayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return { error: 'INVALID_STAY_ID' as const };
  }

  const supabase = getFavoritesAdminClient();
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('client_user_id', userId)
    .eq('stay_id', parsedPayload.data.stay_id);

  return { error: error?.message ?? null };
}
