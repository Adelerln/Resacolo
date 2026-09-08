import { NextResponse } from 'next/server';
import { createOrganizerCgvSignedUrl, findOrganizerCgvPath } from '@/lib/organizer-cgv';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

async function resolveOrganizerId(idOrSlug: string) {
  const supabase = getServerSupabaseClient();
  const { data: bySlug } = await supabase.from('organizers').select('id').eq('slug', idOrSlug).maybeSingle();
  if (bySlug?.id) return bySlug.id;

  const { data: byId } = await supabase.from('organizers').select('id').eq('id', idOrSlug).maybeSingle();
  return byId?.id ?? null;
}

/** Redirige vers le PDF CGV signé de l’organisateur (téléchargement). */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: idOrSlug } = await params;
  const organizerId = await resolveOrganizerId(idOrSlug);
  if (!organizerId) {
    return NextResponse.json({ error: 'Organisateur introuvable.' }, { status: 404 });
  }

  const supabase = getServerSupabaseClient();
  const path = await findOrganizerCgvPath(supabase, organizerId);
  if (!path) {
    return NextResponse.json(
      { error: "Aucune CGV PDF n'a été déposée par cet organisateur." },
      { status: 404 }
    );
  }

  const signedUrl = await createOrganizerCgvSignedUrl(supabase, organizerId, 60 * 10);
  if (!signedUrl) {
    return NextResponse.json({ error: 'Impossible de préparer le téléchargement des CGV.' }, { status: 502 });
  }

  return NextResponse.redirect(signedUrl, 302);
}
