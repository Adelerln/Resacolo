import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAdminMutateSection } from '@/lib/auth/api';
import {
  parseSingleNotificationEmail,
  readAdminInboundRequestSettings,
  upsertAdminInboundRequestSettings
} from '@/lib/admin-inbound-requests.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const emailSchema = z.string().trim().email().max(180);

function redirectWithError(request: Request, message: string, kind: 'partner' | 'organizer') {
  const param = kind === 'partner' ? 'requestEmailError' : 'organizerRequestEmailError';
  return NextResponse.redirect(
    new URL(`/admin?${param}=${encodeURIComponent(message)}`, request.url),
    303
  );
}

export async function POST(request: Request) {
  const unauthorizedPartners = await requireApiAdminMutateSection(request, 'partners');
  const unauthorizedRequests = await requireApiAdminMutateSection(request, 'requests');
  if (unauthorizedPartners && unauthorizedRequests) {
    return unauthorizedPartners;
  }

  const formData = await request.formData();
  const kindRaw = String(formData.get('kind') ?? 'partner').trim().toLowerCase();
  const kind = kindRaw === 'organizer' ? 'organizer' : 'partner';
  const fieldName =
    kind === 'organizer' ? 'organizer_notification_email' : 'partner_notification_email';
  const parsed = emailSchema.safeParse(formData.get(fieldName));
  if (!parsed.success) {
    return redirectWithError(request, 'Saisissez une adresse e-mail valide.', kind);
  }

  const nextEmail = parseSingleNotificationEmail(parsed.data);
  if (!nextEmail) {
    return redirectWithError(request, 'Saisissez une adresse e-mail valide.', kind);
  }

  try {
    const supabase = getServerSupabaseClient();
    const current = await readAdminInboundRequestSettings(supabase);
    await upsertAdminInboundRequestSettings(supabase, {
      partnerNotificationEmail:
        kind === 'partner' ? nextEmail : current.partnerNotificationEmail,
      organizerNotificationEmail:
        kind === 'organizer' ? nextEmail : current.organizerNotificationEmail
    });
  } catch (error) {
    console.error('[inbound-request-settings] sauvegarde impossible', error);
    return redirectWithError(
      request,
      "Impossible d'enregistrer le destinataire. Vérifiez la migration de la base.",
      kind
    );
  }

  revalidatePath('/admin');
  revalidatePath('/admin/demandes');
  const savedParam = kind === 'partner' ? 'requestEmailSaved' : 'organizerRequestEmailSaved';
  return NextResponse.redirect(new URL(`/admin?${savedParam}=1`, request.url), 303);
}
