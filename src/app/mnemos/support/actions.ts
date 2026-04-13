'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export async function updateSupportTicket(formData: FormData) {
  await requireRole('ADMIN');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/mnemos/support');

  const status = String(formData.get('status') ?? '').trim();
  const priority = String(formData.get('priority') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const assignedTo = String(formData.get('assigned_to_user_id') ?? '').trim();

  const supabase = getServerSupabaseClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (status) {
    patch.status = status;
    if (status === 'RESOLVED' || status === 'CLOSED') {
      patch.resolved_at = now;
    }
  }
  if (priority) patch.priority = priority;
  if (category !== undefined) patch.category = category || null;
  if (subject !== undefined) patch.subject = subject || null;
  patch.assigned_to_user_id = assignedTo || null;

  const { error } = await supabase.from('organizer_support_requests').update(patch).eq('id', id);
  if (error) {
    redirect(`/mnemos/support/${id}?err=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/mnemos/support');
  revalidatePath(`/mnemos/support/${id}`);
  redirect(`/mnemos/support/${id}?saved=1`);
}

export async function addSupportMessage(formData: FormData) {
  const session = await requireRole('ADMIN');
  const id = String(formData.get('id') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const isInternal = String(formData.get('is_internal') ?? '') === '1';

  if (!id) {
    redirect('/mnemos/support');
  }
  if (!body) {
    redirect(`/mnemos/support/${id}?err=${encodeURIComponent('Message vide.')}`);
  }

  const supabase = getServerSupabaseClient();
  const { error } = await supabase.from('support_request_messages').insert({
    support_request_id: id,
    author_user_id: session.userId,
    body,
    is_internal: isInternal
  });
  if (error) {
    redirect(`/mnemos/support/${id}?err=${encodeURIComponent(error.message)}`);
  }
  await supabase.from('organizer_support_requests').update({ updated_at: new Date().toISOString() }).eq('id', id);
  revalidatePath(`/mnemos/support/${id}`);
  redirect(`/mnemos/support/${id}?saved=1`);
}
