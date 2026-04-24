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

  if (!email || !firstName || !lastName) {
    return NextResponse.redirect(
      new URL(
        `/admin/organizers/${idOrSlug}/members/new?error=Tous%20les%20champs%20sont%20requis`,
        req.url
      ),
      303
    );
  }
  if (!isOrganizerAccessRole(role)) {
    return NextResponse.redirect(
      new URL(
        `/admin/organizers/${idOrSlug}/members/new?error=${encodeURIComponent('Role invalide')}`,
        req.url
      ),
      303
    );
  }

  const supabase = getServerSupabaseClient();
  let { data: organizer } = await supabase
    .from('organizers')
    .select('id')
    .eq('slug', idOrSlug)
    .maybeSingle();
  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select('id')
      .eq('id', idOrSlug)
      .maybeSingle();
    organizer = byId ?? null;
  }
  if (!organizer) {
    return NextResponse.redirect(
      new URL(`/admin/organizers/${idOrSlug}?error=Organisateur%20introuvable`, req.url),
      303
    );
  }
  let userId: string | null = null;
  let createdSupabaseUserId: string | null = null;
  let createdPrismaUserId: string | null = null;

  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    userId = existingUser.id;
  } else {
    if (!tempPassword) {
      return NextResponse.redirect(
        new URL(
          `/admin/organizers/${idOrSlug}/members/new?error=Mot%20de%20passe%20temporaire%20requis`,
          req.url
        ),
        303
      );
    }
    if (!isPasswordPolicyValid(tempPassword)) {
      return NextResponse.redirect(
        new URL(
          `/admin/organizers/${idOrSlug}/members/new?error=${encodeURIComponent(PASSWORD_POLICY_MESSAGE)}`,
          req.url
        ),
        303
      );
    }
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true
    });
    if (userError || !userData?.user) {
      return NextResponse.redirect(
        new URL(
          `/admin/organizers/${idOrSlug}/members/new?error=${encodeURIComponent(
            userError?.message ?? "Impossible de créer l'utilisateur"
          )}`,
          req.url
        ),
        303
      );
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
    return NextResponse.redirect(
      new URL(
        `/admin/organizers/${idOrSlug}/members/new?error=${encodeURIComponent(
          prismaError instanceof Error ? prismaError.message : 'Impossible de synchroniser le compte applicatif'
        )}`,
        req.url
      ),
      303
    );
  }
  if (!userId) {
    if (createdSupabaseUserId) {
      await supabase.auth.admin.deleteUser(createdSupabaseUserId);
    }
    await removePrismaUserIfExists(createdPrismaUserId);
    return NextResponse.redirect(
      new URL(
        `/admin/organizers/${idOrSlug}/members/new?error=${encodeURIComponent(
          'Utilisateur introuvable après création.'
        )}`,
        req.url
      ),
      303
    );
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
    return NextResponse.redirect(
      new URL(
        `/admin/organizers/${idOrSlug}/members/new?error=${encodeURIComponent(
          memberError.message ?? "Impossible d'ajouter le membre"
        )}`,
        req.url
      ),
      303
    );
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
        `/admin/organizers/${idOrSlug}/members/new?error=${encodeURIComponent(
          syncError instanceof Error ? syncError.message : 'Impossible de synchroniser les accès back-office'
        )}`,
        req.url
      ),
      303
    );
  }

  return NextResponse.redirect(
    new URL(`/admin/organizers/${idOrSlug}?success=1`, req.url),
    303
  );
}
