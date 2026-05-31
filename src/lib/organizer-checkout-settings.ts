import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { OrganizerCheckoutSettings } from '@/lib/order-workflow';

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
    throw new Error(`Impossible de charger les modalités de réservation de l'organisme : ${error.message}`);
  }

  if (!data) {
    throw new Error('Organisme introuvable.');
  }

  return data as OrganizerCheckoutSettingsWithName;
}
