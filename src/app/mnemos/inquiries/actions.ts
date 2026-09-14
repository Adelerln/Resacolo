'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import {
  INQUIRY_SOURCE_MNEMOS,
  INQUIRY_SOURCE_MNEMOS_TRANSFER,
  isInquiryStatusValue,
  isInquiryTypeValue
} from '@/lib/inquiry-options';
import { scheduleOrganizerInquiryTransferNotify } from '@/lib/inquiry-transfer-notifications.server';
import { notifyOrganizerOfInquiryTransfer } from '@/lib/inquiry-transfer-notifications.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export async function updateInquiry(formData: FormData) {
  await requireRole('MNEMOS');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/mnemos/inquiries');

  const status = String(formData.get('status') ?? '').trim();
  const inquiryType = String(formData.get('inquiry_type') ?? '').trim();
  const assignedRaw = String(formData.get('assigned_to_user_id') ?? '').trim();
  const transferOrganizerId = String(formData.get('transfer_organizer_id') ?? '').trim();

  if (status && !isInquiryStatusValue(status)) {
    redirect(`/mnemos/inquiries/${id}?err=${encodeURIComponent('Statut invalide.')}`);
  }
  if (inquiryType && !isInquiryTypeValue(inquiryType)) {
    redirect(`/mnemos/inquiries/${id}?err=${encodeURIComponent('Type invalide.')}`);
  }

  const supabase = getServerSupabaseClient();
  const { data: previous } = await supabase
    .from('inquiries')
    .select('id, organizer_id, source, email, first_name, last_name, phone, subject, message')
    .eq('id', id)
    .maybeSingle();

  if (!previous) {
    redirect(`/mnemos/inquiries/${id}?err=${encodeURIComponent('Demande introuvable.')}`);
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };
  if (status) patch.status = status;
  if (inquiryType) patch.inquiry_type = inquiryType;

  if (transferOrganizerId) {
    patch.organizer_id = transferOrganizerId;
    patch.assigned_to_user_id = null;
    patch.source = INQUIRY_SOURCE_MNEMOS_TRANSFER;
    if (!status || status === 'NEW') {
      patch.status = 'IN_PROGRESS';
    }
  } else if (assignedRaw) {
    patch.assigned_to_user_id = assignedRaw;
    patch.organizer_id = null;
    patch.source = INQUIRY_SOURCE_MNEMOS;
  }

  const { error } = await supabase.from('inquiries').update(patch).eq('id', id);
  if (error) {
    redirect(`/mnemos/inquiries/${id}?err=${encodeURIComponent(error.message)}`);
  }

  const shouldNotifyTransfer =
    Boolean(transferOrganizerId) &&
    (previous.organizer_id !== transferOrganizerId || previous.source !== INQUIRY_SOURCE_MNEMOS_TRANSFER);

  if (shouldNotifyTransfer) {
    const contactName = [previous.first_name, previous.last_name].filter(Boolean).join(' ').trim();
    scheduleOrganizerInquiryTransferNotify({
      inquiryId: id,
      organizerId: transferOrganizerId,
      contactName,
      contactEmail: previous.email,
      contactPhone: previous.phone,
      subject: previous.subject,
      message: previous.message,
      getSupabase: getServerSupabaseClient
    });
  const isNewTransfer =
    Boolean(transferOrganizerId) && previous.organizer_id !== transferOrganizerId;

  if (isNewTransfer) {
    const contactName = [previous.first_name, previous.last_name].filter(Boolean).join(' ').trim();
    try {
      await notifyOrganizerOfInquiryTransfer({
        supabase,
        inquiryId: id,
        organizerId: transferOrganizerId,
        contactName,
        contactEmail: previous.email,
        contactPhone: previous.phone,
        subject: previous.subject,
        message: previous.message
      });
    } catch (notifyError) {
      console.error('[mnemos/inquiries] transfer email skipped', notifyError);
    }
  }

  revalidatePath('/mnemos/inquiries');
  revalidatePath(`/mnemos/inquiries/${id}`);
  if (transferOrganizerId) {
    revalidatePath('/organisme/demandes');
    revalidatePath(`/organisme/demandes/${id}`);
  }

  const savedUrl = new URL(`/mnemos/inquiries/${id}`, 'http://local');
  savedUrl.searchParams.set('saved', '1');
  if (shouldNotifyTransfer) savedUrl.searchParams.set('notify', 'mail-queued');
  redirect(`${savedUrl.pathname}?${savedUrl.searchParams.toString()}`);
}
