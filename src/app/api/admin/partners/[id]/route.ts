import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireApiAdminMutateSection } from '@/lib/auth/api';
import { normalizePartnerOffer } from '@/lib/partner-offers';
import { getServerSupabaseClient } from '@/lib/supabase/server';

function isCollectivityContactsTableMissingError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? '');
  return error?.code === 'PGRST205' || message.includes("Could not find the table 'public.collectivity_contacts'");
}

async function syncPrimaryCollectivityContact(input: {
  collectivityId: string;
  fallbackName: string;
  email: string;
}) {
  const supabase = getServerSupabaseClient();
  const { data: primaryContact, error } = await supabase
    .from('collectivity_contacts')
    .select('id,full_name')
    .eq('collectivity_id', input.collectivityId)
    .eq('is_primary', true)
    .maybeSingle();

  if (error) {
    if (isCollectivityContactsTableMissingError(error)) return;
    throw new Error(error.message);
  }

  if (primaryContact) {
    const { error: updateError } = await supabase
      .from('collectivity_contacts')
      .update({
        email: input.email,
        full_name: primaryContact.full_name?.trim() || input.fallbackName,
        updated_at: new Date().toISOString()
      })
      .eq('id', primaryContact.id);

    if (updateError) throw new Error(updateError.message);
    return;
  }

  const { error: insertError } = await supabase.from('collectivity_contacts').insert({
    collectivity_id: input.collectivityId,
    full_name: input.fallbackName,
    role_label: 'Contact principal',
    email: input.email,
    phone: null,
    is_primary: true
  });

  if (insertError && !isCollectivityContactsTableMissingError(insertError)) {
    throw new Error(insertError.message);
  }
}

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiAdminMutateSection(req, 'partners');
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const formData = await req.formData();
  const intent = String(formData.get('_intent') ?? '').trim();
  const supabase = getServerSupabaseClient();
  const redirectUrl = (search: Record<string, string | null>) => {
    const url = new URL(`/admin/partenaires/${id}`, req.url);
    for (const [key, value] of Object.entries(search)) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, 303);
  };

  if (intent === 'general') {
    const name = String(formData.get('name') ?? '').trim();
    const code = String(formData.get('code') ?? '').trim().toUpperCase();
    const offerMode = normalizePartnerOffer(String(formData.get('offer_mode') ?? 'IDENTITE'));
    const contactEmail = String(formData.get('contact_email') ?? '').trim().toLowerCase();

    if (!name || !code || !contactEmail) {
      return redirectUrl({ error: 'Nom, code, offre et email principal sont requis' });
    }

    const { data: collectivity } = await supabase
      .from('collectivities')
      .select('id,name,contact_name')
      .eq('id', id)
      .maybeSingle();
    if (!collectivity) {
      return NextResponse.redirect(new URL('/admin/partenaires', req.url), 303);
    }

    const { data: existingCode } = await supabase
      .from('collectivities')
      .select('id')
      .eq('code', code)
      .neq('id', id)
      .maybeSingle();

    if (existingCode) {
      return redirectUrl({ error: 'Ce code de rattachement existe déjà' });
    }

    const { error } = await supabase
      .from('collectivities')
      .update({
        name,
        code,
        offer_mode: offerMode,
        contact_email: contactEmail,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      return redirectUrl({ error: error.message });
    }

    try {
      await syncPrimaryCollectivityContact({
        collectivityId: id,
        fallbackName: collectivity.contact_name?.trim() || name,
        email: contactEmail
      });
    } catch (contactError) {
      return redirectUrl({
        error:
          contactError instanceof Error
            ? contactError.message
            : 'Impossible de synchroniser le contact principal'
      });
    }

    revalidatePath('/admin/partenaires');
    revalidatePath(`/admin/partenaires/${id}`);
    revalidatePath('/partenaire/fiche');
    return redirectUrl({ success: 'general-saved' });
  }

  return redirectUrl({ error: 'Action inconnue' });
}
