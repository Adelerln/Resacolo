import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { OrganizerCheckoutSettings } from '@/lib/order-workflow';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';

export type OrganizerCheckoutSettingsWithName = OrganizerCheckoutSettings & {
  id: string;
  name: string;
};

export async function readOrganizerCheckoutSettings(organizerId: string) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('organizers')
    .select('id,name,accepts_ancv_paper,accepts_ancv_connect,is_vacaf_approved')
    .eq('id', organizerId)
    .maybeSingle();

  if (error) {
    if (isMissingAnyColumnError(error, ['accepts_ancv_paper', 'accepts_ancv_connect', 'is_vacaf_approved'])) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('organizers')
        .select('id,name')
        .eq('id', organizerId)
        .maybeSingle();

      if (fallbackError) {
        throw new Error(`Impossible de charger les modalités de réservation de l'organisme : ${fallbackError.message}`);
      }
      if (!fallbackData) {
        throw new Error('Organisme introuvable.');
      }

      return {
        id: fallbackData.id,
        name: fallbackData.name,
        accepts_ancv_paper: false,
        accepts_ancv_connect: false,
        is_vacaf_approved: false
      } as OrganizerCheckoutSettingsWithName;
    }
    throw new Error(`Impossible de charger les modalités de réservation de l'organisme : ${error.message}`);
  }

  if (!data) {
    throw new Error('Organisme introuvable.');
  }

  return data as OrganizerCheckoutSettingsWithName;
}
