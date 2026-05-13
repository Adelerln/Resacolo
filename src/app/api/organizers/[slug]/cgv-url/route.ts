import { NextResponse } from 'next/server';
import { createOrganizerCgvSignedUrl } from '@/lib/organizer-cgv';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: idOrSlug } = await params;
  const supabase = getServerSupabaseClient();

  let { data: organizer } = await supabase
    .from('organizers')
    .select('id')
    .eq('slug', idOrSlug)
    .maybeSingle();
  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select('id')
      .eq('id', idOrSlug)
      .maybeSingle();
    organizer = byId ?? null;
  }

  if (!organizer?.id) {
    return NextResponse.json({
      url: '/cgv-organisateur',
      hasUploadedCgv: false
    });
  }

  const signedUrl = await createOrganizerCgvSignedUrl(supabase, organizer.id, 60 * 30);
  return NextResponse.json({
    url: signedUrl ?? '/cgv-organisateur',
    hasUploadedCgv: Boolean(signedUrl)
  });
}

