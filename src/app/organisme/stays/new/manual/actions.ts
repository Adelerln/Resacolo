'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export async function startManualDraft(formData: FormData) {
  const requestedOrganizerId = String(formData.get('organizerId') ?? '').trim();
  const sessionInner = await requireRole('ORGANISATEUR');
  const supabaseInner = getServerSupabaseClient();
  const { selectedOrganizerId: actionOrganizerId } = await resolveOrganizerSelection(
    requestedOrganizerId || undefined,
    sessionInner.tenantId ?? null
  );

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
