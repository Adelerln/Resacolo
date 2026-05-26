import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireApiAdmin } from '@/lib/auth/api';
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

export async function POST(req: Request, context: { params: Promise<{ userId: string }> }) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { userId } = await context.params;
  const formData = await req.formData();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = normalizeRequestedStaffRole(String(formData.get('role') ?? 'ADMIN_SALES'));
  const redirectToRaw = String(formData.get('redirect_to') ?? '').trim();
  const redirectTo = redirectToRaw.startsWith('/admin/utilisateurs')
    ? redirectToRaw
    : `/admin/utilisateurs?editUserId=${encodeURIComponent(userId)}`;
  const fullName = `${firstName} ${lastName}`.trim();

  if (!email) {
    return redirectUrl(req, redirectTo, {
      editUserId: userId,
      error: 'Email requis.'
    });
  }

  if (!role) {
    return redirectUrl(req, redirectTo, {
      editUserId: userId,
      error: 'Rôle invalide.'
    });
  }

  const supabase = getServerSupabaseClient();
  const { data: existingStaffRows } = await supabase.from('staff_users').select('user_id,role').eq('user_id', userId);
  const existingStaffRow = existingStaffRows?.[0] ?? null;

  if (!existingStaffRow) {
    return redirectUrl(req, redirectTo, {
      error: 'Utilisateur back-office introuvable.'
    });
  }

  if (isMnemosRole(existingStaffRow.role)) {
    return redirectUrl(req, redirectTo, {
      error: 'Les comptes Mnemos ne se gèrent pas depuis cette page.'
    });
  }

  const { data: previousUserData } = await supabase.auth.admin.getUserById(userId);
  const previousMetadata = previousUserData.user?.user_metadata ?? {};

  const { error: roleError } = await supabase.from('staff_users').update({ role }).eq('user_id', userId);
  if (roleError) {
    return redirectUrl(req, redirectTo, {
      editUserId: userId,
      error: roleError.message
    });
  }

  const { error: userError } = await supabase.auth.admin.updateUserById(userId, {
    email,
    user_metadata: {
      ...previousMetadata,
      full_name: fullName
    }
  });

  if (userError) {
    await supabase.from('staff_users').update({ role: existingStaffRow.role }).eq('user_id', userId);
    return redirectUrl(req, redirectTo, {
      editUserId: userId,
      error: userError.message
    });
  }

  revalidatePath('/admin/utilisateurs');
  return redirectUrl(req, '/admin/utilisateurs', { success: 'staff-user-updated' });
}
