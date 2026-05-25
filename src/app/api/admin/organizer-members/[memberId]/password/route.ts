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
  const redirectUrl = (path: string, search: Record<string, string | null>) => {
    const url = new URL(path, req.url);
    for (const [key, value] of Object.entries(search)) {
      if (value == null || value.length === 0) continue;
      url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, 303);
  };

  if (!nextPassword) {
    return redirectUrl(redirectTo, { error: 'Mot de passe requis.' });
  }

  if (!isPasswordPolicyValid(nextPassword)) {
    return redirectUrl(redirectTo, { error: PASSWORD_POLICY_MESSAGE });
  }

  const supabase = getServerSupabaseClient();
  const { data: member } = await supabase
    .from('organizer_members')
    .select('id,user_id')
    .eq('id', memberId)
    .maybeSingle();

  if (!member?.user_id) {
    return redirectUrl(redirectTo, { error: 'Membre introuvable.' });
  }

  const { error } = await supabase.auth.admin.updateUserById(member.user_id, { password: nextPassword });
  if (error) {
    return redirectUrl(redirectTo, { error: error.message });
  }

  return redirectUrl(redirectTo, { password_updated: '1' });
}
