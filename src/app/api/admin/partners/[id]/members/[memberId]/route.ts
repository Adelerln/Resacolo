import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
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

async function syncPartnerContacts(input: {
  collectivityId: string;
  previousEmail: string | null;
  nextEmail: string;
  fullName: string;
  roleLabel: string | null;
}) {
  const supabase = getServerSupabaseClient();
  if (!input.previousEmail) {
    const { error: insertError } = await supabase.from('collectivity_contacts').insert({
      collectivity_id: input.collectivityId,
      full_name: input.fullName,
      role_label: input.roleLabel,
      email: input.nextEmail,
      phone: null,
      is_primary: false
    });
    if (insertError && !isCollectivityContactsTableMissingError(insertError)) {
      throw new Error(insertError.message);
    }
    return;
  }

  const { data: contacts, error } = await supabase
    .from('collectivity_contacts')
    .select('id,is_primary')
    .eq('collectivity_id', input.collectivityId)
    .eq('email', input.previousEmail);

  if (error) {
    if (isCollectivityContactsTableMissingError(error)) return;
    throw new Error(error.message);
  }

  if (!contacts || contacts.length === 0) {
    const { error: insertError } = await supabase.from('collectivity_contacts').insert({
      collectivity_id: input.collectivityId,
      full_name: input.fullName,
      role_label: input.roleLabel,
      email: input.nextEmail,
      phone: null,
      is_primary: false
    });
    if (insertError && !isCollectivityContactsTableMissingError(insertError)) {
      throw new Error(insertError.message);
    }
    return;
  }

  const ids = contacts.map((contact) => contact.id);
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('collectivity_contacts')
    .update({
      full_name: input.fullName,
      email: input.nextEmail,
      role_label: input.roleLabel,
      updated_at: now
    })
    .in('id', ids);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

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
  const roleLabel = readPartnerContactRoleLabelFromFormData(formData);
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const redirectToRaw = String(formData.get('redirect_to') ?? '').trim();
  const defaultRedirectTo = `/admin/partenaires/${id}?openMemberModal=edit&memberId=${memberId}`;
  const redirectTo = redirectToRaw.startsWith('/admin/partenaires/') ? redirectToRaw : defaultRedirectTo;

  const redirectUrl = (path: string, search: Record<string, string | null>) => {
    const url = new URL(path, req.url);
    for (const [key, value] of Object.entries(search)) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, 303);
  };

  if (!email || !firstName || !lastName) {
    return redirectUrl(redirectTo, { error: 'Tous les champs sont requis', openMemberModal: 'edit', memberId });
  }
  if (!isPartnerAccessRole(role)) {
    return redirectUrl(redirectTo, { error: 'Rôle invalide', openMemberModal: 'edit', memberId });
  }

  const supabase = getServerSupabaseClient();
  const { data: previousMember } = await supabase
    .from('collectivity_members')
    .select('id,collectivity_id,user_id,role')
    .eq('id', memberId)
    .eq('collectivity_id', id)
    .maybeSingle();

  if (!previousMember) {
    return redirectUrl(`/admin/partenaires/${id}`, { error: 'Utilisateur introuvable' });
  }

  const { data: previousUserData } = await supabase.auth.admin.getUserById(previousMember.user_id);
  const previousEmail = previousUserData.user?.email?.trim().toLowerCase() ?? null;

  const { error: memberError } = await supabase
    .from('collectivity_members')
    .update({ role: toStoredPartnerMembershipRole(role) })
    .eq('id', memberId);

  if (memberError) {
    const errorMessage = isCollectivityMembersRoleConstraintError(memberError)
      ? PARTNER_MEMBERSHIP_ROLE_CONSTRAINT_MESSAGE
      : memberError.message;
    return redirectUrl(redirectTo, {
      error: errorMessage,
      openMemberModal: 'edit',
      memberId
    });
  }

  const { error: userError } = await supabase.auth.admin.updateUserById(previousMember.user_id, {
    email,
    user_metadata: {
      full_name: `${firstName} ${lastName}`.trim()
    }
  });

  if (userError) {
    await supabase.from('collectivity_members').update({ role: previousMember.role }).eq('id', memberId);
    return redirectUrl(redirectTo, { error: userError.message, openMemberModal: 'edit', memberId });
  }

  try {
    await syncPartnerContacts({
      collectivityId: previousMember.collectivity_id,
      previousEmail,
      nextEmail: email,
      fullName: `${firstName} ${lastName}`.trim(),
      roleLabel
    });
  } catch (contactError) {
    await supabase.from('collectivity_members').update({ role: previousMember.role }).eq('id', memberId);
    if (previousEmail) {
      await supabase.auth.admin.updateUserById(previousMember.user_id, { email: previousEmail }).catch(() => undefined);
    }
    return redirectUrl(redirectTo, {
      error: contactError instanceof Error ? contactError.message : 'Impossible de synchroniser le contact',
      openMemberModal: 'edit',
      memberId
    });
  }

  revalidatePath('/admin/partenaires');
  revalidatePath(`/admin/partenaires/${id}`);
  revalidatePath('/partenaire/fiche');
  return redirectUrl(`/admin/partenaires/${id}`, { success: 'member-updated' });
}
