import { getServerSupabaseClient } from '@/lib/supabase/server';

/** Après confirmation Auth, aligne l'e-mail affiché du profil famille. */
export async function syncClientProfileEmailFromAuthUser(input: {
  userId: string;
  email: string | null | undefined;
}) {
  const email = input.email?.trim().toLowerCase() ?? '';
  if (!input.userId || !email) return;

  const admin = getServerSupabaseClient();
  const { error } = await admin
    .from('client_profiles')
    .update({ parent1_email: email, updated_at: new Date().toISOString() })
    .eq('user_id', input.userId);

  if (error) {
    console.warn('[auth] client_profiles email sync skipped:', error.message);
  }
}
