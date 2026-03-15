import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: { id: string } }) {
  const { id } = context.params;
  const supabase = getServerSupabaseClient();

  // Retrouver l'organisateur par slug puis par id
  let { data: organizer } = await supabase
    .from('organizers')
    .select('id,education_project_path,slug')
    .eq('slug', id)
    .maybeSingle();

  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select('id,education_project_path,slug')
      .eq('id', id)
      .maybeSingle();
    organizer = byId ?? null;
  }

  const organizerSlug = organizer?.slug ?? organizer?.id ?? id;

  if (!organizer) {
    return NextResponse.redirect(
      new URL(`/admin/organisateurs/${organizerSlug}?error=Organisateur%20introuvable`, req.url),
      303
    );
  }

  // Supprimer le fichier dans le bucket si présent
  if (organizer.education_project_path) {
    await supabase.storage.from('organizer-docs').remove([organizer.education_project_path]);
  }

  // Nettoyer la colonne dans la table
  const { error } = await supabase
    .from('organizers')
    .update({ education_project_path: null })
    .eq('id', organizer.id);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/organisateurs/${organizerSlug}?error=${encodeURIComponent(error.message)}`,
        req.url
      ),
      303
    );
  }

  return NextResponse.redirect(
    new URL(`/admin/organisateurs/${organizerSlug}?success=1`, req.url),
    303
  );
}

