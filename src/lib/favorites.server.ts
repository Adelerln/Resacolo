import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getSupabaseEnv } from '@/lib/supabase/config';
import type { Database } from '@/types/supabase';

export const favoritePayloadSchema = z.object({
  stay_id: z.string().uuid()
});

function getFavoritesAdminClient() {
  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  return createClient<Database>(url, serviceRoleKey ?? anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function getFavoriteStayIdsForUserId(userId: string) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return [];

  const supabase = getFavoritesAdminClient();
  const { data, error } = await supabase
    .from('favorites')
    .select('stay_id')
    .eq('client_user_id', normalizedUserId);

  if (error) {
    throw new Error(`Impossible de charger les favoris: ${error.message}`);
  }

  return (data ?? []).map((row) => row.stay_id);
}

export async function addFavoriteForUserId(userId: string, payload: unknown) {
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

export async function removeFavoriteForUserId(userId: string, payload: unknown) {
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
