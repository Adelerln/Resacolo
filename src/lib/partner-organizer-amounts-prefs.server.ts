import 'server-only';

import {
  parsePartnerOrganizerAmountsPrefs,
  type PartnerOrganizerAmountsPrefs
} from '@/lib/partner-organizer-amounts-prefs';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export async function readPartnerOrganizerAmountsPrefs(collectivityId: string) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('collectivities')
    .select('organizer_amounts_prefs')
    .eq('id', collectivityId)
    .maybeSingle();

  if (error && isMissingAnyColumnError(error, ['organizer_amounts_prefs'])) {
    return parsePartnerOrganizerAmountsPrefs(null);
  }
  if (error) {
    throw new Error(`Impossible de charger les préférences montants : ${error.message}`);
  }

  return parsePartnerOrganizerAmountsPrefs(
    (data as { organizer_amounts_prefs?: unknown } | null)?.organizer_amounts_prefs
  );
}

export async function writePartnerOrganizerAmountsPrefs(
  collectivityId: string,
  prefs: PartnerOrganizerAmountsPrefs
) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('collectivities')
    .update({
      organizer_amounts_prefs: prefs as unknown as Json,
      updated_at: new Date().toISOString()
    })
    .eq('id', collectivityId);

  if (error && isMissingAnyColumnError(error, ['organizer_amounts_prefs'])) {
    throw new Error(
      'La colonne de préférences n’est pas encore déployée. Appliquez la migration organizer_amounts_prefs.'
    );
  }
  if (error) {
    throw new Error(`Impossible d’enregistrer les préférences montants : ${error.message}`);
  }
}
