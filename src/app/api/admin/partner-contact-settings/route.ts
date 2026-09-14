import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAdminMutateSection } from '@/lib/auth/api';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const emailSchema = z.string().trim().email().max(180);

function redirectWithError(request: Request, message: string) {
  return NextResponse.redirect(
    new URL(`/admin?requestEmailError=${encodeURIComponent(message)}`, request.url),
    303
  );
}

export async function POST(request: Request) {
  const unauthorized = await requireApiAdminMutateSection(request, 'partners');
  if (unauthorized) return unauthorized;

  const formData = await request.formData();
  const parsed = emailSchema.safeParse(formData.get('partner_request_email'));
  if (!parsed.success) {
    return redirectWithError(request, 'Saisissez une adresse e-mail valide.');
  }

  const { error } = await getServerSupabaseClient().from('partner_contact_settings').upsert(
    {
      id: 'default',
      partner_request_email: parsed.data.toLowerCase(),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('[partner-contact-settings] sauvegarde impossible', error);
    return redirectWithError(request, "Impossible d'enregistrer le destinataire. Vérifiez la migration de la base.");
  }

  revalidatePath('/admin');
  return NextResponse.redirect(new URL('/admin?requestEmailSaved=1', request.url), 303);
}
