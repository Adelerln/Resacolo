import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import { isOrganizerAccessRole } from '@/lib/organizer-access';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ memberId: string }> }) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { memberId } = await context.params;
  const formData = await req.formData();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const userId = String(formData.get('user_id') ?? '').trim();

  if (!isOrganizerAccessRole(role)) {
    return NextResponse.redirect(
      new URL(`/admin/utilisateurs?error=${encodeURIComponent('Role invalide')}`, req.url),
      303
    );
  }

  const supabase = getServerSupabaseClient();
  const { error: memberError } = await supabase
    .from('organizer_members')
    .update({ first_name: firstName || null, last_name: lastName || null, role })
    .eq('id', memberId);
  if (memberError) {
    return NextResponse.redirect(
      new URL(`/admin/utilisateurs?error=${encodeURIComponent(memberError.message)}`, req.url),
      303
    );
  }

  if (email && userId) {
    const { error: userError } = await supabase.auth.admin.updateUserById(userId, { email });
    if (userError) {
      return NextResponse.redirect(
        new URL(`/admin/utilisateurs?error=${encodeURIComponent(userError.message)}`, req.url),
        303
      );
    }
  }

  return NextResponse.redirect(new URL('/admin/utilisateurs', req.url), 303);
}
