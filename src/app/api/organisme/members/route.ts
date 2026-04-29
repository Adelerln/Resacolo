import { NextResponse } from 'next/server';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { isOrganizerAccessRole } from '@/lib/organizer-access';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

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
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.context.accessRole !== 'OWNER') {
    return NextResponse.json({ error: 'Seul un propriétaire peut gérer les utilisateurs.' }, { status: 403 });
  }

  if (!organizerId || !email || !firstName || !lastName) {
    return NextResponse.json({ error: 'Tous les champs sont requis.' }, { status: 400 });
  }
  if (!isOrganizerAccessRole(role)) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  let userId: string | null = null;

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }
  const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    userId = existingUser.id;
  } else {
    if (!tempPassword) {
      return NextResponse.json({ error: 'Mot de passe temporaire requis pour créer le compte.' }, { status: 400 });
    }
    if (!isPasswordPolicyValid(tempPassword)) {
      return NextResponse.json({ error: PASSWORD_POLICY_MESSAGE }, { status: 400 });
    }
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true
    });
    if (userError || !userData?.user?.id) {
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
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

