import { NextResponse } from 'next/server';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const supabase = getServerSupabaseClient();

  let { data: organizer } = await supabase
    .from('organizers')
    .select('id,education_project_path,slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select('id,education_project_path,slug')
      .eq('id', slug)
      .maybeSingle();
    organizer = byId ?? null;
  }

  if (!organizer) {
    return NextResponse.redirect(
      new URL('/organisme/organisateur?error=Organisateur%20introuvable', req.url),
      303
    );
  }
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: organizer.id,
    requiredSection: 'organizer-profile'
  });
  if (!access.ok) {
    return NextResponse.redirect(new URL('/login', req.url), 303);
  }
  if (access.context.accessRole !== 'OWNER') {
    return NextResponse.redirect(new URL('/login', req.url), 303);
  }

  if (organizer.education_project_path) {
    await supabase.storage.from('organizer-docs').remove([organizer.education_project_path]);
    await supabase
      .from('organizers')
      .update({ education_project_path: null })
      .eq('id', organizer.id);
  }

  return NextResponse.redirect(new URL('/organisme/organisateur?success=1', req.url), 303);
}
