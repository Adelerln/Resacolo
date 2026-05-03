import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import { removeBackofficeAccessAndMirrorOrganizerMember } from '@/lib/organizer-backoffice-sync.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { id: idOrSlug, memberId } = await context.params;
  const formData = await req.formData();
  const redirectToRaw = String(formData.get('redirect_to') ?? '').trim();

  const redirectUrl = (path: string, search: Record<string, string | null>) => {
    const url = new URL(path, req.url);
    for (const [key, value] of Object.entries(search)) {
      if (value == null || value.length === 0) continue;
      url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, 303);
  };

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
  const redirectTo = redirectToRaw.startsWith('/admin/organizers/') ? redirectToRaw : organizerRedirectBase;

  const { data: member } = await supabase
    .from('organizer_members')
    .select('id,organizer_id,user_id,first_name,last_name')
    .eq('id', memberId)
    .maybeSingle();

  if (!member || member.organizer_id !== organizer.id) {
    return redirectUrl(redirectTo, { error: 'Membre introuvable' });
  }

  try {
    await removeBackofficeAccessAndMirrorOrganizerMember({
      organizerId: organizer.id,
      identity: {
        appUserId: member.user_id,
        email: 'admin@resacolo.local',
        supabaseUserId: member.user_id,
        firstName: member.first_name ?? null,
        lastName: member.last_name ?? null
      }
    });
  } catch (error) {
    return redirectUrl(redirectTo, {
      error: error instanceof Error ? error.message : 'Impossible de supprimer le membre'
    });
  }

  return redirectUrl(organizerRedirectBase, { success: 'member-deleted' });
}
