'use server';

import { redirect } from 'next/navigation';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export async function startManualDraft(formData: FormData) {
  const requestedOrganizerId = String(formData.get('organizerId') ?? '').trim();
  const { selectedOrganizerId: actionOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: requestedOrganizerId || undefined,
    requiredSection: 'stays'
  });
  const supabaseInner = getServerSupabaseClient();

  if (!actionOrganizerId) {
    redirect('/organisme/sejours?error=Aucun%20organisateur%20disponible.');
  }

  const manualSourceUrl = `https://resacolo.com/creation-manuelle/${crypto.randomUUID()}`;
  const { data: insertedDraft, error: insertError } = await supabaseInner
    .from('stay_drafts')
    .insert({
      organizer_id: actionOrganizerId,
      source_url: manualSourceUrl,
      status: 'pending',
      raw_payload: {
        manual_entry: true,
        created_via: 'manual-flow',
        created_at: new Date().toISOString()
      }
    })
    .select('id')
    .single();

  if (insertError || !insertedDraft) {
    redirect(
      withOrganizerQuery(
        `/organisme/sejours/new/manual?error=${encodeURIComponent(
          insertError?.message ?? 'Impossible de créer le brouillon manuel.'
        )}`,
        actionOrganizerId
      )
    );
  }

  redirect(withOrganizerQuery(`/organisme/sejours/drafts/${insertedDraft.id}`, actionOrganizerId));
}
