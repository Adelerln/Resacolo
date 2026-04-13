'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export async function updateInquiry(formData: FormData) {
  await requireRole('ADMIN');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/mnemos/inquiries');

  const status = String(formData.get('status') ?? '').trim();
  const inquiryType = String(formData.get('inquiry_type') ?? '').trim();
  const assignedTo = String(formData.get('assigned_to_user_id') ?? '').trim();
  const internalNotes = String(formData.get('internal_notes') ?? '');

  const supabase = getServerSupabaseClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };
  if (status) patch.status = status;
  if (inquiryType) patch.inquiry_type = inquiryType;
  patch.assigned_to_user_id = assignedTo || null;
  patch.internal_notes = internalNotes || null;

  const { error } = await supabase.from('inquiries').update(patch).eq('id', id);
  if (error) {
    redirect(`/mnemos/inquiries/${id}?err=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/mnemos/inquiries');
  revalidatePath(`/mnemos/inquiries/${id}`);
  redirect(`/mnemos/inquiries/${id}?saved=1`);
}
