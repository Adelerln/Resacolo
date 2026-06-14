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

  const supabase = getServerSupabaseClient();
  const { error } = await supabase.from('inquiries').update(patch).eq('id', id);
  if (error) {
    redirect(`/mnemos/inquiries/${id}?err=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/mnemos/inquiries');
  revalidatePath(`/mnemos/inquiries/${id}`);
  if (transferOrganizerId) {
    revalidatePath('/organisme/demandes');
    revalidatePath(`/organisme/demandes/${id}`);
  }
  redirect(`/mnemos/inquiries/${id}?saved=1`);
}
