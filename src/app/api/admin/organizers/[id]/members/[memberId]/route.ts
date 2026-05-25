import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import { isOrganizerAccessRole } from '@/lib/organizer-access';
import { syncBackofficeAccessFromOrganizerMember } from '@/lib/organizer-backoffice-sync.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { id, memberId } = await context.params;
  const formData = await req.formData();
  const role = String(formData.get('role') ?? '').trim();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const redirectToRaw = String(formData.get('redirect_to') ?? '').trim();
  const defaultRedirectTo = `/admin/organizers/${id}?openMemberModal=edit&memberId=${memberId}`;
  const redirectTo = redirectToRaw.startsWith('/admin/organizers/') ? redirectToRaw : defaultRedirectTo;

  const redirectUrl = (path: string, search: Record<string, string | null>) => {
    const url = new URL(path, req.url);
    for (const [key, value] of Object.entries(search)) {
      if (value == null || value.length === 0) continue;
      url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, 303);
  };

  if (!isOrganizerAccessRole(role)) {
    return redirectUrl(redirectTo, { error: 'Role invalide', openMemberModal: 'edit', memberId });
  }

  const supabase = getServerSupabaseClient();
  const { data: previousMember } = await supabase
    .from('organizer_members')
    .select('id,organizer_id,user_id,role,first_name,last_name')
    .eq('id', memberId)
    .maybeSingle();

  if (!previousMember) {
    return redirectUrl(redirectTo, { error: 'Membre introuvable', openMemberModal: 'edit', memberId });
  }

  const { data: previousUserData } = await supabase.auth.admin.getUserById(previousMember.user_id);
  const previousEmail = previousUserData.user?.email ?? null;
  const { error: memberError } = await supabase
    .from('organizer_members')
    .update({ role, first_name: firstName || null, last_name: lastName || null })
    .eq('id', memberId);

  if (memberError) {
    return redirectUrl(redirectTo, {
      error: memberError.message,
      openMemberModal: 'edit',
      memberId
    });
  }

  if (email) {
    const { error: userError } = await supabase.auth.admin.updateUserById(previousMember.user_id, { email });
    if (userError) {
      await supabase
        .from('organizer_members')
        .update({
          role: previousMember.role,
          first_name: previousMember.first_name,
          last_name: previousMember.last_name
        })
        .eq('id', memberId);
      return redirectUrl(redirectTo, { error: userError.message, openMemberModal: 'edit', memberId });
    }
  }
  try {
    await syncBackofficeAccessFromOrganizerMember({
      organizerId: previousMember.organizer_id,
      supabaseUserId: previousMember.user_id,
      role,
      emailHint: email || previousEmail
    });
  } catch (syncError) {
    await supabase
      .from('organizer_members')
      .update({
        role: previousMember.role,
        first_name: previousMember.first_name,
        last_name: previousMember.last_name
      })
      .eq('id', memberId);
    if (email && previousEmail) {
      await supabase
        .auth.admin
        .updateUserById(previousMember.user_id, { email: previousEmail })
        .catch(() => undefined);
    }
    return redirectUrl(redirectTo, {
      error:
        syncError instanceof Error
          ? syncError.message
          : 'Impossible de synchroniser les accès back-office',
      openMemberModal: 'edit',
      memberId
    });
  }

  return redirectUrl(`/admin/organizers/${id}`, { success: 'member-updated' });
}
