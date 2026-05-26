import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireApiAdmin } from '@/lib/auth/api';
import { isPasswordPolicyValid, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type StaffRole = 'ADMIN' | 'ADMIN_SALES';

function normalizeRequestedStaffRole(value: string | null | undefined): StaffRole | null {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (normalized === 'ADMIN') return 'ADMIN';
  if (normalized === 'ADMIN_SALES' || normalized === 'SALES_ADMIN') return 'ADMIN_SALES';
  return null;
}

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

export async function POST(req: Request) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const formData = await req.formData();
  const redirectToRaw = String(formData.get('redirect_to') ?? '').trim();
  const redirectTo = redirectToRaw.startsWith('/admin/utilisateurs')
    ? redirectToRaw
    : '/admin/utilisateurs?openCreate=1';
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const tempPassword = String(formData.get('temp_password') ?? '').trim();
  const role = normalizeRequestedStaffRole(String(formData.get('role') ?? 'ADMIN_SALES'));
  const fullName = `${firstName} ${lastName}`.trim();

  if (!firstName || !lastName || !email || !tempPassword) {
    return redirectUrl(req, redirectTo, {
      openCreate: '1',
      error: 'Tous les champs sont requis.'
    });
  }

  if (!role) {
    return redirectUrl(req, redirectTo, {
      openCreate: '1',
      error: 'Rôle invalide.'
    });
  }

  if (!isPasswordPolicyValid(tempPassword)) {
    return redirectUrl(req, redirectTo, {
      openCreate: '1',
      error: PASSWORD_POLICY_MESSAGE
    });
  }

  const supabase = getServerSupabaseClient();
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return redirectUrl(req, redirectTo, {
      openCreate: '1',
      error: listError.message
    });
  }

  const existingUser = listData?.users?.find((user) => user.email?.toLowerCase() === email);
  let createdUserId: string | null = null;
  let userId = existingUser?.id ?? null;

  if (existingUser) {
    const [{ data: existingStaffRows }, { data: organizerMember }, { data: collectivityMember }] =
      await Promise.all([
        supabase.from('staff_users').select('role').eq('user_id', existingUser.id),
        supabase.from('organizer_members').select('id').eq('user_id', existingUser.id).limit(1).maybeSingle(),
        supabase.from('collectivity_members').select('id').eq('user_id', existingUser.id).limit(1).maybeSingle()
      ]);

    if ((existingStaffRows ?? []).some((row) => isMnemosRole(row.role))) {
      return redirectUrl(req, redirectTo, {
        openCreate: '1',
        error: 'Cet email est déjà utilisé par un compte Mnemos.'
      });
    }

    if ((existingStaffRows ?? []).length > 0) {
      return redirectUrl(req, redirectTo, {
        openCreate: '1',
        error: 'Un utilisateur back-office existe déjà pour cet email.'
      });
    }

    if (organizerMember) {
      return redirectUrl(req, redirectTo, {
        openCreate: '1',
        error: 'Cet email est déjà relié à un organisme.'
      });
    }

    if (collectivityMember) {
      return redirectUrl(req, redirectTo, {
        openCreate: '1',
        error: 'Cet email est déjà relié à un partenaire.'
      });
    }
  } else {
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (userError || !userData?.user?.id) {
      return redirectUrl(req, redirectTo, {
        openCreate: '1',
        error: userError?.message ?? "Impossible de créer l'utilisateur."
      });
    }

    createdUserId = userData.user.id;
    userId = userData.user.id;
  }

  if (!userId) {
    return redirectUrl(req, redirectTo, {
      openCreate: '1',
      error: 'Utilisateur introuvable après création.'
    });
  }

  const { error: staffInsertError } = await supabase.from('staff_users').insert({
    user_id: userId,
    role
  });

  if (staffInsertError) {
    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    }
    return redirectUrl(req, redirectTo, {
      openCreate: '1',
      error: staffInsertError.message
    });
  }

  const { error: updateUserError } = await supabase.auth.admin.updateUserById(userId, {
    email,
    user_metadata: {
      full_name: fullName
    }
  });

  if (updateUserError) {
    await supabase.from('staff_users').delete().eq('user_id', userId);
    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId).catch(() => undefined);
    }
    return redirectUrl(req, redirectTo, {
      openCreate: '1',
      error: updateUserError.message
    });
  }

  revalidatePath('/admin/utilisateurs');
  return redirectUrl(req, '/admin/utilisateurs', { success: 'staff-user-created' });
}
