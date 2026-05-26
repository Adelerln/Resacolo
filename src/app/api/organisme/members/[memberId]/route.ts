import { NextResponse } from 'next/server';
import { isOrganizerAccessRole } from '@/lib/organizer-access';
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

export async function POST(req: Request, context: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await context.params;
  const formData = await req.formData();
  const organizerId = String(formData.get('organizer_id') ?? '').trim();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim();

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
      return redirectToUsers(req, organizerId, { error: 'Seul un propriétaire peut gérer les utilisateurs.' });
    }
    return NextResponse.json({ error: 'Seul un propriétaire peut gérer les utilisateurs.' }, { status: 403 });
  }

  if (!isOrganizerAccessRole(role)) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: 'Rôle invalide.' });
    }
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  const { data: member } = await supabase
    .from('organizer_members')
    .select('id,organizer_id')
    .eq('id', memberId)
    .maybeSingle();
  if (!member || member.organizer_id !== organizerId) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: 'Membre introuvable.' });
    }
    return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
  }

  const { error } = await supabase
    .from('organizer_members')
    .update({ first_name: firstName || null, last_name: lastName || null, role })
    .eq('id', memberId);
  if (error) {
    if (!wantsJson(req)) {
      return redirectToUsers(req, organizerId, { error: error.message });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!wantsJson(req)) {
    return redirectToUsers(req, organizerId, { success: 'Utilisateur mis à jour.' });
  }
  return NextResponse.json({ ok: true });
}
