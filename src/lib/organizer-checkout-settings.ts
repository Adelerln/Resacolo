import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { OrganizerCheckoutSettings } from '@/lib/order-workflow';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';

export type OrganizerCheckoutSettingsWithName = OrganizerCheckoutSettings & {
  id: string;
  name: string;
  contact_email: string | null;
};

export async function readOrganizerCheckoutSettings(organizerId: string) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('organizers')
    .select(
      'id,name,contact_email,accepts_ancv_paper,accepts_ancv_connect,is_vacaf_approved,ancv_paper_mailing_address'
    )
    .eq('id', organizerId)
    .maybeSingle();

  if (error) {
    if (
      isMissingAnyColumnError(error, [
        'accepts_ancv_paper',
        'accepts_ancv_connect',
        'is_vacaf_approved',
        'ancv_paper_mailing_address',
        'contact_email'
      ])
    ) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('organizers')
        .select('id,name,contact_email,accepts_ancv_paper,accepts_ancv_connect,is_vacaf_approved')
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
        contact_email: (fallbackData as { contact_email?: string | null }).contact_email ?? null,
        accepts_ancv_paper:
          (fallbackData as { accepts_ancv_paper?: boolean }).accepts_ancv_paper ?? false,
        accepts_ancv_connect:
          (fallbackData as { accepts_ancv_connect?: boolean }).accepts_ancv_connect ?? false,
        is_vacaf_approved:
          (fallbackData as { is_vacaf_approved?: boolean }).is_vacaf_approved ?? false,
        ancv_paper_mailing_address: null
      } as OrganizerCheckoutSettingsWithName;
    }
    throw new Error(`Impossible de charger les modalités de réservation de l'organisme : ${error.message}`);
  }

  if (!data) {
    throw new Error('Organisme introuvable.');
  }

  return data as OrganizerCheckoutSettingsWithName;
}
