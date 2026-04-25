'use server';

import { redirect } from 'next/navigation';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { canonicalizeStaySourceUrl } from '@/lib/stay-source-url-canonical';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type DynamicStayDraftInsertIdBuilder = {
  insert: (values: Record<string, unknown>) => {
    select: (columns: string) => {
      single: () => Promise<{
        data: { id: string } | null;
        error: { code?: string | null; message?: string | null } | null;
      }>;
    };
  };
};

function isMissingCanonicalColumnError(
  error: { code?: string | null; message?: string | null } | null
): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  const message = String(error.message ?? '').toLowerCase();
  return message.includes('source_url_canonical') && message.includes('column');
}

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
  const manualCanonicalSourceUrl = canonicalizeStaySourceUrl(manualSourceUrl);
  const manualInsertPayload = {
    organizer_id: actionOrganizerId,
    source_url: manualSourceUrl,
    status: 'pending',
    raw_payload: {
      manual_entry: true,
      created_via: 'manual-flow',
      created_at: new Date().toISOString()
    }
  };
  const firstInsertAttempt = await supabaseInner
    .from('stay_drafts')
    .insert({
      ...manualInsertPayload,
      source_url_canonical: manualCanonicalSourceUrl
    })
    .select('id')
    .single();
  let insertedDraft = firstInsertAttempt.data;
  let insertError: { code?: string | null; message?: string | null } | null = firstInsertAttempt.error
    ? { code: firstInsertAttempt.error.code, message: firstInsertAttempt.error.message }
    : null;

  if (isMissingCanonicalColumnError(insertError)) {
    const dynamicInsertWithoutCanonical = supabaseInner.from('stay_drafts') as unknown as DynamicStayDraftInsertIdBuilder;
    const retryWithoutCanonicalColumn = await dynamicInsertWithoutCanonical
      .insert(manualInsertPayload)
      .select('id')
      .single();
    insertedDraft = retryWithoutCanonicalColumn.data;
    insertError = retryWithoutCanonicalColumn.error;
  }

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
