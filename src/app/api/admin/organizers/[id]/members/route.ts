import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { isOrganizerAccessRole } from '@/lib/organizer-access';
import {
  ensurePrismaUserForOrganizerAccess,
  removePrismaUserIfExists,
  syncBackofficeAccessFromOrganizerMember
} from '@/lib/organizer-backoffice-sync.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { id: idOrSlug } = await context.params;
  const formData = await req.formData();
  const email = String(formData.get('email') ?? '').trim();
  const tempPassword = String(formData.get('temp_password') ?? '').trim();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const role = String(formData.get('role') ?? 'EDITOR').trim();
  const redirectToRaw = String(formData.get('redirect_to') ?? '').trim();
  const redirectToBase = redirectToRaw.startsWith('/admin/organizers/')
    ? redirectToRaw
    : `/admin/organizers/${idOrSlug}?openMemberModal=add`;
  const redirectUrl = (path: string, search: Record<string, string | null>) => {
    const url = new URL(path, req.url);
    for (const [key, value] of Object.entries(search)) {
      if (value == null || value.length === 0) continue;
      url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, 303);
  };

  if (!email || !firstName || !lastName) {
    return redirectUrl(redirectToBase, {
      openMemberModal: 'add',
      error: 'Tous les champs sont requis'
    });
  }
  if (!isOrganizerAccessRole(role)) {
    return redirectUrl(redirectToBase, { openMemberModal: 'add', error: 'Role invalide' });
  }

  const supabase = getServerSupabaseClient();
  let { data: organizer } = await supabase
    .from('organizers')
    .select('id,slug')
    .eq('slug', idOrSlug)
    .maybeSingle();
  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select('id,slug')
      .eq('id', idOrSlug)
      .maybeSingle();
    organizer = byId ?? null;
  }
  if (!organizer) {
    return redirectUrl(`/admin/organizers/${idOrSlug}`, { error: 'Organisateur introuvable' });
  }
  const organizerRedirectBase = `/admin/organizers/${organizer.slug ?? organizer.id}`;
  let userId: string | null = null;
  let createdSupabaseUserId: string | null = null;
  let createdPrismaUserId: string | null = null;

  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    userId = existingUser.id;
  } else {
    if (!tempPassword) {
      return redirectUrl(organizerRedirectBase, {
        openMemberModal: 'add',
        error: 'Mot de passe temporaire requis'
      });
    }
    if (!isPasswordPolicyValid(tempPassword)) {
      return redirectUrl(organizerRedirectBase, {
        openMemberModal: 'add',
        error: PASSWORD_POLICY_MESSAGE
      });
    }
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true
    });
    if (userError || !userData?.user) {
      return redirectUrl(organizerRedirectBase, {
        openMemberModal: 'add',
        error: userError?.message ?? "Impossible de créer l'utilisateur"
      });
    }
    userId = userData.user.id;
    createdSupabaseUserId = userData.user.id;
  }

  try {
    const prismaUser = await ensurePrismaUserForOrganizerAccess({
      email,
      tempPassword: tempPassword || undefined,
      displayName: `${firstName} ${lastName}`.trim()
    });
    if (prismaUser.created) {
      createdPrismaUserId = prismaUser.id;
    }
  } catch (prismaError) {
    if (createdSupabaseUserId) {
      await supabase.auth.admin.deleteUser(createdSupabaseUserId);
    }
    return redirectUrl(organizerRedirectBase, {
      openMemberModal: 'add',
      error:
        prismaError instanceof Error
          ? prismaError.message
          : 'Impossible de synchroniser le compte applicatif'
    });
  }
  if (!userId) {
    if (createdSupabaseUserId) {
      await supabase.auth.admin.deleteUser(createdSupabaseUserId);
    }
    await removePrismaUserIfExists(createdPrismaUserId);
    return redirectUrl(organizerRedirectBase, {
      openMemberModal: 'add',
      error: 'Utilisateur introuvable après création.'
    });
  }

  const { error: memberError } = await supabase.from('organizer_members').insert({
    organizer_id: organizer.id,
    user_id: userId,
    role,
    first_name: firstName,
    last_name: lastName
  });

  if (memberError) {
    if (createdSupabaseUserId) {
      await supabase.auth.admin.deleteUser(createdSupabaseUserId);
    }
    await removePrismaUserIfExists(createdPrismaUserId);
    return redirectUrl(organizerRedirectBase, {
      openMemberModal: 'add',
      error: memberError.message ?? "Impossible d'ajouter le membre"
    });
  }
  try {
    await syncBackofficeAccessFromOrganizerMember({
      organizerId: organizer.id,
      supabaseUserId: userId,
      role,
      emailHint: email
    });
  } catch (syncError) {
    await supabase
      .from('organizer_members')
      .delete()
      .eq('organizer_id', organizer.id)
      .eq('user_id', userId);
    if (createdSupabaseUserId) {
      await supabase.auth.admin.deleteUser(createdSupabaseUserId);
    }
    await removePrismaUserIfExists(createdPrismaUserId);
    return NextResponse.redirect(
      new URL(
        `${organizerRedirectBase}?openMemberModal=add&error=${encodeURIComponent(
          syncError instanceof Error ? syncError.message : 'Impossible de synchroniser les accès back-office'
        )}`,
        req.url
      ),
      303
    );
  }

  return redirectUrl(organizerRedirectBase, { success: 'member-added' });
}
