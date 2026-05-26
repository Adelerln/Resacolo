import { NextResponse } from 'next/server';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { isOrganizerAccessRole } from '@/lib/organizer-access';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function wantsJson(req: Request) {
  return (req.headers.get('accept') ?? '').includes('application/json');
}

function redirectToUsers(req: Request, organizerId: string, search: Record<string, string>) {
  const url = new URL('/organisme/utilisateurs', req.url);
  if (organizerId) {
    url.searchParams.set('organizerId', organizerId);
  }
  for (const [key, value] of Object.entries(search)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const tempPassword = String(formData.get('temp_password') ?? '').trim();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const role = String(formData.get('role') ?? 'EDITOR').trim();

  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: organizerId,
    requiredSection: 'users'
  });
  if (!access.ok) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: access.error });
    }
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.context.accessRole !== 'OWNER') {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: 'Seul un propriétaire peut gérer les utilisateurs.' });
    }
    return NextResponse.json({ error: 'Seul un propriétaire peut gérer les utilisateurs.' }, { status: 403 });
  }

  if (!organizerId || !email || !firstName || !lastName) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: 'Tous les champs sont requis.' });
    }
    return NextResponse.json({ error: 'Tous les champs sont requis.' }, { status: 400 });
  }
  if (!isOrganizerAccessRole(role)) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: 'Rôle invalide.' });
    }
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  let userId: string | null = null;

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: listError.message });
    }
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }
  const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    userId = existingUser.id;
  } else {
    if (!tempPassword) {
      if (!wantsJson(req)) {
        return redirectToUsers(req, organizerId, { error: 'Mot de passe temporaire requis pour créer le compte.' });
      }
      return NextResponse.json({ error: 'Mot de passe temporaire requis pour créer le compte.' }, { status: 400 });
    }
    if (!isPasswordPolicyValid(tempPassword)) {
      if (!wantsJson(req)) {
        return redirectToUsers(req, organizerId, { error: PASSWORD_POLICY_MESSAGE });
      }
      return NextResponse.json({ error: PASSWORD_POLICY_MESSAGE }, { status: 400 });
    }
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true
    });
    if (userError || !userData?.user?.id) {
      if (!wantsJson(req)) {
        return redirectToUsers(req, organizerId, { error: userError?.message ?? "Impossible de créer l'utilisateur." });
      }
      return NextResponse.json({ error: userError?.message ?? "Impossible de créer l'utilisateur." }, { status: 400 });
    }
    userId = userData.user.id;
  }

  const { error: memberError } = await supabase.from('organizer_members').insert({
    organizer_id: organizerId,
    user_id: userId,
    role,
    first_name: firstName,
    last_name: lastName
  });
  if (memberError) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: memberError.message });
    }
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  if (!wantsJson(req)) {
    return redirectToUsers(req, organizerId, { success: 'Utilisateur ajouté.' });
  }
  return NextResponse.json({ ok: true });
}
