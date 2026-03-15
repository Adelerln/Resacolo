import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  context: { params: { id: string; memberId: string } }
) {
  const { id, memberId } = context.params;
  const formData = await req.formData();
  const role = String(formData.get('role') ?? '').trim();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const userId = String(formData.get('user_id') ?? '').trim();

  const supabase = getServerSupabaseClient();
  await supabase
    .from('organizer_members')
    .update({ role, first_name: firstName || null, last_name: lastName || null })
    .eq('id', memberId);

  if (email && userId) {
    await supabase.auth.admin.updateUserById(userId, { email });
  }

  return NextResponse.redirect(new URL(`/admin/organizers/${id}`, req.url), 303);
}
