import { NextResponse } from 'next/server';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await context.params;
  const formData = await req.formData();
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const nextPassword = String(formData.get('password') ?? '').trim();

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

  if (!nextPassword) {
    return NextResponse.json({ error: 'Mot de passe requis.' }, { status: 400 });
  }
  if (!isPasswordPolicyValid(nextPassword)) {
    return NextResponse.json({ error: PASSWORD_POLICY_MESSAGE }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  const { data: member } = await supabase
    .from('organizer_members')
    .select('id,organizer_id,user_id')
    .eq('id', memberId)
    .maybeSingle();
  if (!member || member.organizer_id !== organizerId || !member.user_id) {
    return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
  }

  const { error } = await supabase.auth.admin.updateUserById(member.user_id, { password: nextPassword });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

