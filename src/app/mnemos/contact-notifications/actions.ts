'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import {
  parseContactNotificationEmailsFromText,
  upsertContactFormNotificationEmails
} from '@/lib/contact-form-notifications.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export async function saveContactFormNotificationSettings(formData: FormData) {
  await requireRole('MNEMOS');
  const raw = String(formData.get('emails') ?? '');
  const emails = parseContactNotificationEmailsFromText(raw);

  if (emails.length === 0) {
    redirect(
      `/mnemos/contact-notifications?err=${encodeURIComponent('Ajoutez au moins une adresse e-mail valide.')}`
    );
  }

  try {
    const supabase = getServerSupabaseClient();
    await upsertContactFormNotificationEmails(supabase, emails);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enregistrement impossible.';
    redirect(`/mnemos/contact-notifications?err=${encodeURIComponent(message)}`);
  }

  revalidatePath('/mnemos/contact-notifications');
  redirect(`/mnemos/contact-notifications?saved=1`);
}
