import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireApiAdmin } from '@/lib/auth/api';
import { applyPublishedStayReviewPayload } from '@/lib/apply-published-stay-review-payload';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { StayDraftReviewPayload } from '@/types/stay-draft-review';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireApiAdmin(req);
  if (unauthorized) return unauthorized;

  const { id: stayId } = await params;
  const body = (await req.json().catch(() => null)) as
    | { payload?: StayDraftReviewPayload }
    | null;

  if (!body?.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  const { data: stay, error: stayError } = await supabase
    .from('stays')
    .select('id,organizer_id')
    .eq('id', stayId)
    .maybeSingle();

  if (stayError || !stay) {
    return NextResponse.json({ error: 'Séjour introuvable.' }, { status: 404 });
  }

  const result = await applyPublishedStayReviewPayload(
    supabase,
    stayId,
    stay.organizer_id,
    body.payload
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  revalidatePath('/admin/sejours');
  revalidatePath(`/admin/sejours/${stayId}`);
  revalidatePath('/organisme/sejours');
  revalidatePath(`/organisme/sejours/${stayId}`);
  revalidatePath(`/organisme/stays/${stayId}`);
  revalidatePath(`/organisme/stays/${stayId}/edit`);
  revalidatePath('/sejours');

  return NextResponse.json({ ok: true, saved: true });
}
