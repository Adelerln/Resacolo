import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ memberId: string }> }) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { memberId } = await context.params;
  const formData = await req.formData();
  const nextPassword = String(formData.get('password') ?? '').trim();
  const redirectTo = String(formData.get('redirect_to') ?? '/admin/utilisateurs').trim() || '/admin/utilisateurs';

  if (!nextPassword) {
    return NextResponse.redirect(
      new URL(`${redirectTo}?error=${encodeURIComponent('Mot de passe requis.')}`, req.url),
      303
    );
  }

  if (!isPasswordPolicyValid(nextPassword)) {
    return NextResponse.redirect(
      new URL(`${redirectTo}?error=${encodeURIComponent(PASSWORD_POLICY_MESSAGE)}`, req.url),
      303
    );
  }

  const supabase = getServerSupabaseClient();
  const { data: member } = await supabase
    .from('organizer_members')
    .select('id,user_id')
    .eq('id', memberId)
    .maybeSingle();

  if (!member?.user_id) {
    return NextResponse.redirect(
      new URL(`${redirectTo}?error=${encodeURIComponent('Membre introuvable.')}`, req.url),
      303
    );
  }

  const { error } = await supabase.auth.admin.updateUserById(member.user_id, { password: nextPassword });
  if (error) {
    return NextResponse.redirect(
      new URL(`${redirectTo}?error=${encodeURIComponent(error.message)}`, req.url),
      303
    );
  }

  return NextResponse.redirect(new URL(`${redirectTo}?password_updated=1`, req.url), 303);
}

