import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireApiAdmin } from '@/lib/auth/api';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { normalizePartnerOffer } from '@/lib/partner-offers';
import { getServerSupabaseClient } from '@/lib/supabase/server';

function isCollectivityContactsTableMissingError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? '');
  return error?.code === 'PGRST205' || message.includes("Could not find the table 'public.collectivity_contacts'");
}

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const formData = await req.formData();
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const offerMode = normalizePartnerOffer(String(formData.get('offer_mode') ?? 'IDENTITE'));
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const userEmail = String(formData.get('user_email') ?? '').trim().toLowerCase();
  const tempPassword = String(formData.get('temp_password') ?? '').trim();

  if (!name || !code || !firstName || !lastName || !userEmail || !tempPassword) {
    return NextResponse.redirect(
      new URL('/admin/partenaires/nouveau?error=Tous%20les%20champs%20sont%20requis', req.url),
      303
    );
  }

  if (!isPasswordPolicyValid(tempPassword)) {
    return NextResponse.redirect(
      new URL(`/admin/partenaires/nouveau?error=${encodeURIComponent(PASSWORD_POLICY_MESSAGE)}`, req.url),
      303
    );
  }

  const supabase = getServerSupabaseClient();
  const { data: existingCollectivity } = await supabase
    .from('collectivities')
    .select('id')
    .eq('code', code)
    .maybeSingle();

  if (existingCollectivity) {
    return NextResponse.redirect(
      new URL('/admin/partenaires/nouveau?error=Ce%20code%20de%20rattachement%20existe%20d%C3%A9j%C3%A0', req.url),
      303
    );
  }

  const primaryContactName = `${firstName} ${lastName}`.trim();

  const { data: collectivity, error: collectivityError } = await supabase
    .from('collectivities')
    .insert({
      name,
      code,
      offer_mode: offerMode,
      contact_name: primaryContactName || null,
      contact_email: userEmail,
      contact_phone: null
    })
    .select('id')
    .single();

  if (collectivityError || !collectivity) {
    return NextResponse.redirect(
      new URL(
        `/admin/partenaires/nouveau?error=${encodeURIComponent(
          collectivityError?.message ?? 'Impossible de créer le partenaire'
        )}`,
        req.url
      ),
      303
    );
  }

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: userEmail,
    password: tempPassword,
    email_confirm: true
  });

  if (userError || !userData?.user) {
    await supabase.from('collectivities').delete().eq('id', collectivity.id);
    return NextResponse.redirect(
      new URL(
        `/admin/partenaires/nouveau?error=${encodeURIComponent(
          userError?.message ?? "Impossible de créer l'utilisateur"
        )}`,
        req.url
      ),
      303
    );
  }

  const { error: memberError } = await supabase.from('collectivity_members').insert({
    collectivity_id: collectivity.id,
    user_id: userData.user.id,
    role: 'PARTNER_ADMIN'
  });

  if (memberError) {
    await supabase.auth.admin.deleteUser(userData.user.id);
    await supabase.from('collectivities').delete().eq('id', collectivity.id);
    return NextResponse.redirect(
      new URL(
        `/admin/partenaires/nouveau?error=${encodeURIComponent(
          memberError.message ?? "Impossible de lier l'utilisateur au partenaire"
        )}`,
        req.url
      ),
      303
    );
  }

  const { error: contactError } = await supabase.from('collectivity_contacts').insert({
    collectivity_id: collectivity.id,
    full_name: primaryContactName || name,
    email: userEmail,
    phone: null,
    role_label: 'Contact principal',
    is_primary: true
  });

  if (contactError && !isCollectivityContactsTableMissingError(contactError)) {
    await supabase
      .from('collectivity_members')
      .delete()
      .eq('collectivity_id', collectivity.id)
      .eq('user_id', userData.user.id);
    await supabase.auth.admin.deleteUser(userData.user.id);
    await supabase.from('collectivities').delete().eq('id', collectivity.id);
    return NextResponse.redirect(
      new URL(
        `/admin/partenaires/nouveau?error=${encodeURIComponent(contactError.message)}`,
        req.url
      ),
      303
    );
  }

  revalidatePath('/admin/partenaires');
  revalidatePath('/admin/partenaires/nouveau');

  return NextResponse.redirect(new URL('/admin/partenaires', req.url), 303);
}
