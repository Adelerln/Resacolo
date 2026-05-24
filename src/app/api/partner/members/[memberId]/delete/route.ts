import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/api';
import { canAccessPartnerSection, getPartnerAccessRoleFromSession } from '@/lib/partner-access';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ memberId: string }> }) {
  const { unauthorized, session } = await requireApiAuth();
  if (unauthorized || !session) return unauthorized;
  if (
    session.role !== 'PARTENAIRE' ||
    !session.tenantId ||
    !canAccessPartnerSection(getPartnerAccessRoleFromSession(session), 'partner-profile')
  ) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { memberId } = await context.params;
  const formData = await req.formData();
  const redirectToRaw = String(formData.get('redirect_to') ?? '').trim();
  const redirectTo = redirectToRaw.startsWith('/partenaire/fiche') ? redirectToRaw : '/partenaire/fiche';
  const collectivityId = session.tenantId;

  const redirectUrl = (path: string, search: Record<string, string | null>) => {
    const url = new URL(path, req.url);
    for (const [key, value] of Object.entries(search)) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, 303);
  };

  const supabase = getServerSupabaseClient();
  const { data: member } = await supabase
    .from('collectivity_members')
    .select('id,collectivity_id,user_id')
    .eq('id', memberId)
    .eq('collectivity_id', collectivityId)
    .maybeSingle();

  if (!member) {
    return redirectUrl(redirectTo, { error: 'Utilisateur introuvable' });
  }
  if (member.user_id === session.userId) {
    return redirectUrl(redirectTo, { error: 'Vous ne pouvez pas supprimer votre propre accès.' });
  }

  const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
  const memberEmail = userData.user?.email?.trim().toLowerCase() ?? null;

  const { error } = await supabase.from('collectivity_members').delete().eq('id', memberId);
  if (error) {
    return redirectUrl(redirectTo, { error: error.message });
  }

  if (memberEmail) {
    await supabase
      .from('collectivity_contacts')
      .delete()
      .eq('collectivity_id', collectivityId)
      .eq('email', memberEmail)
      .eq('is_primary', false);
  }

  revalidatePath('/partenaire/fiche');
  return redirectUrl('/partenaire/fiche', { success: 'member-deleted' });
}
