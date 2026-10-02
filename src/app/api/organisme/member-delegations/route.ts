import { NextResponse } from 'next/server';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function wantsJson(req: Request) {
  return (req.headers.get('accept') ?? '').includes('application/json');
}

function redirectToUsers(req: Request, organizerId: string, search: Record<string, string>) {
  const url = new URL('/organisme/utilisateurs', req.url);
  if (organizerId) {
    url.searchParams.set('organizerId', organizerId);
  }
  for (const [key, value] of Object.entries(search)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

function normalizeMemberId(value: FormDataEntryValue | null) {
  const id = String(value ?? '').trim();
  return id.length > 0 ? id : null;
}

async function assertMemberBelongsToOrganizer(
  supabase: ReturnType<typeof getServerSupabaseClient>,
  memberId: string | null,
  organizerId: string
) {
  if (!memberId) return null;
  const { data: member } = await supabase
    .from('organizer_members')
    .select('id,organizer_id')
    .eq('id', memberId)
    .maybeSingle();
  if (!member || member.organizer_id !== organizerId) {
    return 'Membre désigné introuvable pour cet organisme.';
  }
  return null;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const orderStatusMemberId = normalizeMemberId(formData.get('order_status_notify_member_id'));
  const weeklyRecapMemberId = normalizeMemberId(formData.get('weekly_recap_notify_member_id'));

  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: organizerId,
    requiredSection: 'users'
  });
  if (!access.ok) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: access.error });
    }
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.context.accessRole !== 'OWNER') {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, {
        error: 'Seul un propriétaire peut modifier les désignations.'
      });
    }
    return NextResponse.json(
      { error: 'Seul un propriétaire peut modifier les désignations.' },
      { status: 403 }
    );
  }

  const supabase = getServerSupabaseClient();
  const orderMemberError = await assertMemberBelongsToOrganizer(
    supabase,
    orderStatusMemberId,
    organizerId
  );
  if (orderMemberError) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: orderMemberError });
    }
    return NextResponse.json({ error: orderMemberError }, { status: 400 });
  }
  const weeklyMemberError = await assertMemberBelongsToOrganizer(
    supabase,
    weeklyRecapMemberId,
    organizerId
  );
  if (weeklyMemberError) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: weeklyMemberError });
    }
    return NextResponse.json({ error: weeklyMemberError }, { status: 400 });
  }

  const { error } = await supabase
    .from('organizers')
    .update({
      order_status_notify_member_id: orderStatusMemberId,
      weekly_recap_notify_member_id: weeklyRecapMemberId
    })
    .eq('id', organizerId);

  if (error) {
    const message = error.message.includes('order_status_notify_member_id')
      ? 'Migration des désignations non appliquée en base. Contactez le support Resacolo.'
      : error.message;
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: message });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!wantsJson(req)) {
    return redirectToUsers(req, organizerId, { success: 'Désignations enregistrées.' });
  }
  return NextResponse.json({ ok: true });
}
