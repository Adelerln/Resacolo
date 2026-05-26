import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function isMnemosRole(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .includes('MNEMOS');
}

function redirectUrl(req: Request, path: string, search: Record<string, string | null>) {
  const url = new URL(path, req.url);
  for (const [key, value] of Object.entries(search)) {
    if (value == null || value.length === 0) continue;
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request, context: { params: Promise<{ userId: string }> }) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { userId } = await context.params;
  const formData = await req.formData();
  const nextPassword = String(formData.get('password') ?? '').trim();
  const redirectToRaw = String(formData.get('redirect_to') ?? '').trim();
  const redirectTo = redirectToRaw.startsWith('/admin/utilisateurs')
    ? redirectToRaw
    : `/admin/utilisateurs?editUserId=${encodeURIComponent(userId)}`;

  if (!nextPassword) {
    return redirectUrl(req, redirectTo, { error: 'Mot de passe requis.' });
  }

  if (!isPasswordPolicyValid(nextPassword)) {
    return redirectUrl(req, redirectTo, { error: PASSWORD_POLICY_MESSAGE });
  }

  const supabase = getServerSupabaseClient();
  const { data: staffRows } = await supabase.from('staff_users').select('user_id,role').eq('user_id', userId);
  const staffRow = staffRows?.[0] ?? null;

  if (!staffRow) {
    return redirectUrl(req, '/admin/utilisateurs', { error: 'Utilisateur back-office introuvable.' });
  }

  if (isMnemosRole(staffRow.role)) {
    return redirectUrl(req, '/admin/utilisateurs', {
      error: 'Les comptes Mnemos ne se gèrent pas depuis cette page.'
    });
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, { password: nextPassword });
  if (error) {
    return redirectUrl(req, redirectTo, { error: error.message });
  }

  return redirectUrl(req, '/admin/utilisateurs', { password_updated: '1' });
}
