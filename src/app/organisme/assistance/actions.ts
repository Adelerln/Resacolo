'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyOrganizerSupportRecipients } from '@/lib/contact-form-notifications.server';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

const ALLOWED_CATEGORIES = new Set([
  'technique',
  'catalogue',
  'reservations',
  'facturation',
  'autre'
]);

export async function createOrganizerSupportRequest(formData: FormData) {
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const categoryRaw = String(formData.get('category') ?? '').trim().toLowerCase();
  const category = ALLOWED_CATEGORIES.has(categoryRaw) ? categoryRaw : 'technique';

  const baseList = withOrganizerQuery('/organisme/assistance', organizerId || null);

  if (!organizerId) {
    redirect(`${baseList}?error=${encodeURIComponent('Organisme manquant.')}`);
  }

  const { session, selectedOrganizer } = await requireOrganizerPageAccess({
    requestedOrganizerId: organizerId,
    requiredSection: 'support'
  });

  if (subject.length < 3) {
    redirect(`${baseList}?error=${encodeURIComponent('Indiquez un sujet (3 caractères minimum).')}`);
  }
  if (body.length < 10) {
    redirect(`${baseList}?error=${encodeURIComponent('Décrivez votre besoin (10 caractères minimum).')}`);
  }

  const supabase = getServerSupabaseClient();
  const { data: ticket, error } = await supabase
    .from('organizer_support_requests')
    .insert({
      organizer_id: organizerId,
      created_by_user_id: session.userId,
      subject: subject.slice(0, 200),
      body: body.slice(0, 8000),
      category,
      priority: 'NORMAL',
      status: 'NEW'
    })
    .select('id')
    .single();

  if (error || !ticket) {
    redirect(
      `${baseList}?error=${encodeURIComponent(error?.message ?? 'Impossible de créer la demande.')}`
    );
  }

  await supabase.from('support_request_messages').insert({
    support_request_id: ticket.id,
    author_user_id: session.userId,
    body: body.slice(0, 8000),
    is_internal: false
  });

  try {
    await notifyOrganizerSupportRecipients({
      supabase,
      supportRequestId: ticket.id,
      organizerId,
      organizerName: selectedOrganizer.name,
      subject,
      body,
      category,
      priority: 'NORMAL',
      requesterEmail: session.email
    });
  } catch (notifyError) {
    console.error('[organisme/assistance] notification email skipped', notifyError);
  }

  revalidatePath('/mnemos/support');
  revalidatePath(baseList);
  redirect(`${baseList}?saved=1`);
}
