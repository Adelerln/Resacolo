'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminMutateSection } from '@/lib/auth/require';
import {
  markAdminInboundRequestResolved,
  parseSingleNotificationEmail,
  upsertAdminInboundRequestSettings
} from '@/lib/admin-inbound-requests.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

function redirectWithQuery(path: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  redirect(`${path}?${search.toString()}`);
}

export async function saveAdminInboundRequestSettings(formData: FormData) {
  await requireAdminMutateSection('requests');

  const partnerNotificationEmail = parseSingleNotificationEmail(
    String(formData.get('partner_notification_email') ?? '')
  );
  const organizerNotificationEmail = parseSingleNotificationEmail(
    String(formData.get('organizer_notification_email') ?? '')
  );

  if (!partnerNotificationEmail || !organizerNotificationEmail) {
    redirectWithQuery('/admin/demandes', {
      err: 'Indiquez une adresse e-mail valide pour les partenariats et les organisateurs.'
    });
  }

  try {
    const supabase = getServerSupabaseClient();
    await upsertAdminInboundRequestSettings(supabase, {
      partnerNotificationEmail,
      organizerNotificationEmail
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enregistrement impossible.';
    redirectWithQuery('/admin/demandes', { err: message });
  }

  revalidatePath('/admin/demandes');
  redirectWithQuery('/admin/demandes', { saved: '1' });
}

export async function resolveAdminInboundRequest(formData: FormData) {
  await requireAdminMutateSection('requests');
  const requestId = String(formData.get('request_id') ?? '').trim();
  if (!requestId) {
    redirectWithQuery('/admin/demandes', { err: 'Demande introuvable.' });
  }

  try {
    const supabase = getServerSupabaseClient();
    await markAdminInboundRequestResolved(supabase, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mise à jour impossible.';
    redirectWithQuery('/admin/demandes', { err: message });
  }

  revalidatePath('/admin/demandes');
  redirectWithQuery('/admin/demandes', { resolved: '1' });
}
