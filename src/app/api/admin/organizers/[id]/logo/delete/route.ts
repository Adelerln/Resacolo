import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: slug } = await context.params;
  const supabase = getServerSupabaseClient();

  let { data: organizer } = await supabase
    .from('organizers')
    .select('id,logo_path')
    .eq('slug', slug)
    .maybeSingle();
  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select('id,logo_path')
      .eq('id', slug)
      .maybeSingle();
    organizer = byId ?? null;
  }

  if (!organizer) {
    return NextResponse.redirect(
      new URL(`/admin/organisateurs/${slug}?error=Organisateur%20introuvable`, req.url),
      303
    );
  }

  if (organizer.logo_path) {
    const { error: removeError } = await supabase.storage
      .from('organizer-logo')
      .remove([organizer.logo_path]);
    if (removeError) {
      return NextResponse.redirect(
        new URL(
          `/admin/organisateurs/${slug}?error=${encodeURIComponent(
            removeError.message ?? 'Impossible de supprimer le logo'
          )}`,
          req.url
        ),
        303
      );
    }

    const { error: updateError } = await supabase
      .from('organizers')
      .update({ logo_path: null })
      .eq('id', organizer.id);
    if (updateError) {
      return NextResponse.redirect(
        new URL(
          `/admin/organisateurs/${slug}?error=${encodeURIComponent(
            updateError.message ?? 'Impossible de mettre a jour le logo'
          )}`,
          req.url
        ),
        303
      );
    }
  }

  return NextResponse.redirect(new URL(`/admin/organisateurs/${slug}?success=1`, req.url), 303);
}
