import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireApiAdminMutateSection } from '@/lib/auth/api';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  const unauthorized = await requireApiAdminMutateSection(req, 'partners');
  if (unauthorized) return unauthorized;

  const { id, memberId } = await context.params;
  const redirectToRaw = String((await req.formData()).get('redirect_to') ?? '').trim();
  const redirectTo = redirectToRaw.startsWith('/admin/partenaires/') ? redirectToRaw : `/admin/partenaires/${id}`;
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
    .eq('collectivity_id', id)
    .maybeSingle();

  if (!member) {
    return redirectUrl(redirectTo, { error: 'Utilisateur introuvable' });
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
      .eq('collectivity_id', id)
      .eq('email', memberEmail)
      .eq('is_primary', false);
  }

  revalidatePath('/admin/partenaires');
  revalidatePath(`/admin/partenaires/${id}`);
  revalidatePath('/partenaire/fiche');
  return redirectUrl(`/admin/partenaires/${id}`, { success: 'member-deleted' });
}
