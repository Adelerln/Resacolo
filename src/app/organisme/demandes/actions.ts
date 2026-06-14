'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  canOrganizerMarkInquiryResolved,
  isMnemosTransferredInquiry,
  isOrganizerSettableInquiryStatus,
  ORGANIZER_INQUIRY_STATUS_VALUE
} from '@/lib/inquiry-options';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export async function updateOrganizerInquiry(formData: FormData) {
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const inquiryId = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  const base = withOrganizerQuery(`/organisme/demandes/${inquiryId}`, organizerId || null);

  if (!organizerId || !inquiryId) {
    redirect(withOrganizerQuery('/organisme/demandes?error=Demande%20introuvable.', organizerId || null));
  }

  await requireOrganizerPageAccess({
    requestedOrganizerId: organizerId,
    requiredSection: 'inquiries'
  });

  if (!isOrganizerSettableInquiryStatus(status)) {
    redirect(`${base}&error=${encodeURIComponent('Seul le statut « Résolu » peut être défini par l’organisme.')}`);
  }

  const supabase = getServerSupabaseClient();
  const { data: inquiry } = await supabase
    .from('inquiries')
    .select('id, organizer_id, source, status')
    .eq('id', inquiryId)
    .maybeSingle();

  if (!inquiry || inquiry.organizer_id !== organizerId || !isMnemosTransferredInquiry(inquiry.source)) {
    redirect(`${base}&error=${encodeURIComponent('Demande introuvable ou non transférée par Mnemos.')}`);
  }

  if (!canOrganizerMarkInquiryResolved(inquiry.status)) {
    redirect(`${base}&error=${encodeURIComponent('Cette demande est déjà résolue ou clôturée.')}`);
  }

  const { error } = await supabase
    .from('inquiries')
    .update({
      status: ORGANIZER_INQUIRY_STATUS_VALUE,
      updated_at: new Date().toISOString()
    })
    .eq('id', inquiryId)
    .eq('organizer_id', organizerId);

  if (error) {
    redirect(`${base}&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(withOrganizerQuery('/organisme/demandes', organizerId));
  revalidatePath(base.split('&')[0] ?? `/organisme/demandes/${inquiryId}`);
  redirect(`${base}&saved=1`);
}
