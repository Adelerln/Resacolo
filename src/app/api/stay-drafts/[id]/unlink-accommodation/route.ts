import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export const runtime = 'nodejs';

function asObject(value: Json | null): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { organizerId?: string } | null;
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: body?.organizerId,
    requiredSection: 'stays'
  });

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { selectedOrganizerId } = access.context;
  const supabase = getServerSupabaseClient();
  const { data: draft, error } = await supabase
    .from('stay_drafts')
    .select('id,organizer_id,status,raw_payload')
    .eq('id', id)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (error || !draft) {
    return NextResponse.json(
      { error: error?.message ?? 'Brouillon introuvable.' },
      { status: 404 }
    );
  }

  const status = normalizeStatus(draft.status);
  if (status !== 'pending' && status !== 'draft' && status !== 'validated') {
    return NextResponse.json(
      { error: "Seuls les brouillons non publiés peuvent délier un hébergement." },
      { status: 400 }
    );
  }

  const rawPayload = asObject(draft.raw_payload);
  const importOptions =
    rawPayload.import_options &&
    typeof rawPayload.import_options === 'object' &&
    !Array.isArray(rawPayload.import_options)
      ? { ...(rawPayload.import_options as Record<string, unknown>) }
      : {};

  importOptions.existing_accommodation_id = null;
  importOptions.existing_accommodation_name = null;

  const nextRawPayload: Record<string, unknown> = {
    ...rawPayload,
    import_options: importOptions,
    draft_accommodation_preview: null
  };

  const { error: updateError } = await supabase
    .from('stay_drafts')
    .update({
      raw_payload: nextRawPayload as Json,
      accommodations_json: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', draft.id)
    .eq('organizer_id', selectedOrganizerId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Impossible de délier l'hébergement." },
      { status: 500 }
    );
  }

  revalidatePath('/organisme/sejours');
  revalidatePath('/organisme/stays');
  revalidatePath(`/organisme/sejours/drafts/${draft.id}`);
  revalidatePath(`/organisme/stays/drafts/${draft.id}`);

  return NextResponse.json({ success: true });
}
