import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import {
  isCollectivityMembersRoleConstraintError,
  isPartnerAccessRole,
  PARTNER_MEMBERSHIP_ROLE_CONSTRAINT_MESSAGE,
  toStoredPartnerMembershipRole,
  type PartnerAccessRole
} from '@/lib/partner-access';
import { readPartnerContactRoleLabelFromFormData } from '@/lib/partner-contact-role-label';
import { getServerSupabaseClient } from '@/lib/supabase/server';

function isCollectivityContactsTableMissingError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? '');
  return error?.code === 'PGRST205' || message.includes("Could not find the table 'public.collectivity_contacts'");
}

async function upsertPartnerContact(input: {
  collectivityId: string;
  email: string;
  fullName: string;
  roleLabel: string | null;
}) {
  const supabase = getServerSupabaseClient();
  const { data: existingContact, error } = await supabase
    .from('collectivity_contacts')
    .select('id,is_primary')
    .eq('collectivity_id', input.collectivityId)
    .eq('email', input.email)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isCollectivityContactsTableMissingError(error)) return;
    throw new Error(error.message);
  }

  if (existingContact) {
    const payload = {
      full_name: input.fullName,
      email: input.email,
      role_label: input.roleLabel,
      updated_at: new Date().toISOString()
    };
    const { error: updateError } = await supabase
      .from('collectivity_contacts')
      .update(payload)
      .eq('id', existingContact.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
    return;
  }

  const { error: insertError } = await supabase.from('collectivity_contacts').insert({
    collectivity_id: input.collectivityId,
    full_name: input.fullName,
    role_label: input.roleLabel,
    email: input.email,
    phone: null,
    is_primary: false
  });

  if (insertError && !isCollectivityContactsTableMissingError(insertError)) {
    throw new Error(insertError.message);
  }
}

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const formData = await req.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const tempPassword = String(formData.get('temp_password') ?? '').trim();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const role = String(formData.get('role') ?? 'PARTNER_BENEFICIARY_MANAGER').trim();
  const roleLabel = readPartnerContactRoleLabelFromFormData(formData);
  const redirectToRaw = String(formData.get('redirect_to') ?? '').trim();
  const redirectToBase = redirectToRaw.startsWith('/admin/partenaires/')
    ? redirectToRaw
    : `/admin/partenaires/${id}?openMemberModal=add`;

  const redirectUrl = (path: string, search: Record<string, string | null>) => {
    const url = new URL(path, req.url);
    for (const [key, value] of Object.entries(search)) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, 303);
  };

  if (!email || !firstName || !lastName) {
    return redirectUrl(redirectToBase, { openMemberModal: 'add', error: 'Tous les champs sont requis' });
  }
  if (!isPartnerAccessRole(role)) {
    return redirectUrl(redirectToBase, { openMemberModal: 'add', error: 'Rôle invalide' });
  }

  const supabase = getServerSupabaseClient();
  const { data: collectivity } = await supabase.from('collectivities').select('id').eq('id', id).maybeSingle();
  if (!collectivity) {
    return redirectUrl('/admin/partenaires', { error: 'Partenaire introuvable' });
  }

  let userId: string | null = null;
  let createdSupabaseUserId: string | null = null;

  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = listData?.users?.find((user) => user.email?.toLowerCase() === email);
  if (existingUser) {
    userId = existingUser.id;
  } else {
    if (!tempPassword) {
      return redirectUrl(redirectToBase, {
        openMemberModal: 'add',
        error: 'Mot de passe temporaire requis pour un nouvel utilisateur'
      });
    }
    if (!isPasswordPolicyValid(tempPassword)) {
      return redirectUrl(redirectToBase, { openMemberModal: 'add', error: PASSWORD_POLICY_MESSAGE });
    }

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: `${firstName} ${lastName}`.trim()
      }
    });

    if (userError || !userData?.user) {
      return redirectUrl(redirectToBase, {
        openMemberModal: 'add',
        error: userError?.message ?? "Impossible de créer l'utilisateur"
      });
    }
    userId = userData.user.id;
    createdSupabaseUserId = userData.user.id;
  }

  if (!userId) {
    return redirectUrl(redirectToBase, { openMemberModal: 'add', error: 'Utilisateur introuvable.' });
  }

  const { error: memberError } = await supabase.from('collectivity_members').insert({
    collectivity_id: collectivity.id,
    user_id: userId,
    role: toStoredPartnerMembershipRole(role)
  });

  if (memberError) {
    if (createdSupabaseUserId) {
      await supabase.auth.admin.deleteUser(createdSupabaseUserId);
    }
    const errorMessage = isCollectivityMembersRoleConstraintError(memberError)
      ? PARTNER_MEMBERSHIP_ROLE_CONSTRAINT_MESSAGE
      : memberError.message ?? "Impossible d'ajouter l'utilisateur";
    return redirectUrl(redirectToBase, {
      openMemberModal: 'add',
      error: errorMessage
    });
  }

  try {
    await upsertPartnerContact({
      collectivityId: collectivity.id,
      email,
      fullName: `${firstName} ${lastName}`.trim(),
      roleLabel
    });
  } catch (contactError) {
    await supabase
      .from('collectivity_members')
      .delete()
      .eq('collectivity_id', collectivity.id)
      .eq('user_id', userId);
    if (createdSupabaseUserId) {
      await supabase.auth.admin.deleteUser(createdSupabaseUserId);
    }
    return redirectUrl(redirectToBase, {
      openMemberModal: 'add',
      error: contactError instanceof Error ? contactError.message : 'Impossible de créer le contact'
    });
  }

  revalidatePath('/admin/partenaires');
  revalidatePath(`/admin/partenaires/${collectivity.id}`);
  revalidatePath('/partenaire/fiche');
  return redirectUrl(`/admin/partenaires/${collectivity.id}`, { success: 'member-added' });
}
