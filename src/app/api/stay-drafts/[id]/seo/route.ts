import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { generateStayDraftSeo } from '@/lib/stay-draft-seo';
import { sanitizeSeoPrimaryKeyword, sanitizeSeoTags, sanitizeSeoText } from '@/lib/stay-seo';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

type StayDraftRow = Database['public']['Tables']['stay_drafts']['Row'];

const requestSchema = z.object({
  organizerId: z.string().optional(),
  force: z.boolean().optional().default(false)
});

function normalizeBool(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'on', 'yes', 'oui'].includes(normalized);
}

async function parseRequestBody(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as { organizerId?: unknown; force?: unknown };
    return requestSchema.parse({
      organizerId: typeof body.organizerId === 'string' ? body.organizerId : undefined,
      force: normalizeBool(body.force)
    });
  }

  const formData = await req.formData();
  return requestSchema.parse({
    organizerId: String(formData.get('organizerId') ?? ''),
    force: normalizeBool(formData.get('force'))
  });
}

function hasExistingSeoData(draft: StayDraftRow) {
  return Boolean(
    sanitizeSeoText(draft.seo_primary_keyword) ||
      sanitizeSeoText(draft.seo_title) ||
      sanitizeSeoText(draft.seo_meta_description) ||
      sanitizeSeoText(draft.seo_intro_text) ||
      sanitizeSeoText(draft.seo_h1_variant) ||
      sanitizeSeoText(draft.seo_slug_candidate) ||
      (draft.seo_secondary_keywords ?? []).length > 0 ||
      (draft.seo_search_intents ?? []).length > 0 ||
      (draft.seo_internal_link_anchor_suggestions ?? []).length > 0
  );
}

function pickSeoFromDraft(draft: StayDraftRow) {
  const seoChecks = Array.isArray(draft.seo_checks)
    ? (draft.seo_checks as unknown[])
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => {
          const code = typeof item.code === 'string' ? item.code.trim() : '';
          const level = item.level === 'ok' || item.level === 'warning' || item.level === 'info' ? item.level : null;
          const message = typeof item.message === 'string' ? item.message.trim() : '';
          if (!code || !level || !message) return null;
          return { code, level, message };
        })
        .filter(
          (item): item is { code: string; level: 'ok' | 'warning' | 'info'; message: string } =>
            Boolean(item)
        )
    : [];

  return {
    seo_primary_keyword: sanitizeSeoPrimaryKeyword(draft.seo_primary_keyword) || null,
    seo_secondary_keywords: sanitizeSeoTags(draft.seo_secondary_keywords ?? []),
    seo_target_city: sanitizeSeoText(draft.seo_target_city) || null,
    seo_target_region: sanitizeSeoText(draft.seo_target_region) || null,
    seo_search_intents: sanitizeSeoTags(draft.seo_search_intents ?? []),
    seo_title: sanitizeSeoText(draft.seo_title) || null,
    seo_meta_description: sanitizeSeoText(draft.seo_meta_description) || null,
    seo_intro_text: sanitizeSeoText(draft.seo_intro_text) || null,
    seo_h1_variant: sanitizeSeoText(draft.seo_h1_variant) || null,
    seo_internal_link_anchor_suggestions: sanitizeSeoTags(draft.seo_internal_link_anchor_suggestions ?? []),
    seo_slug_candidate: sanitizeSeoText(draft.seo_slug_candidate) || null,
    seo_score: Number.isFinite(draft.seo_score) ? draft.seo_score : null,
    seo_checks: seoChecks,
    seo_generated_at: draft.seo_generated_at,
    seo_generation_source: sanitizeSeoText(draft.seo_generation_source) || null
  };
}

function isMissingSeoColumnsError(message: string | null | undefined) {
  const normalized = String(message ?? '').toLowerCase();
  if (!normalized) return false;
  if (!normalized.includes('seo_')) return false;
  return (
    normalized.includes('does not exist') ||
    normalized.includes('schema cache') ||
    normalized.includes('could not find') ||
    normalized.includes('column')
  );
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedInput = await parseRequestBody(req).catch(() => null);
  if (!parsedInput) {
    return NextResponse.json({ error: 'Payload invalide.' }, { status: 400 });
  }
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: parsedInput.organizerId,
    requiredSection: 'stays'
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { selectedOrganizerId } = access.context;

  const supabase = getServerSupabaseClient();

  const { data: draft, error: draftError } = await supabase
    .from('stay_drafts')
    .select('*')
    .eq('id', params.id)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (draftError || !draft) {
    return NextResponse.json(
      { error: draftError?.message ?? 'Brouillon introuvable pour cet organisateur.' },
      { status: 404 }
    );
  }

  const existingSeo = pickSeoFromDraft(draft);
  if (!parsedInput.force && hasExistingSeoData(draft)) {
    return NextResponse.json({
      success: true,
      generated: false,
      alreadyGenerated: true,
      seo: existingSeo
    });
  }

  const generatedSeo = generateStayDraftSeo({
    title: draft.title,
    summary: draft.summary,
    description: draft.description,
    activities_text: draft.activities_text,
    program_text: draft.program_text,
    location_text: draft.location_text,
    region_text: draft.region_text,
    categories: draft.categories,
    ages: draft.ages,
    age_min: draft.age_min,
    age_max: draft.age_max,
    sessions_json: draft.sessions_json
  });

  const { data: updatedDraft, error: updateError } = await supabase
    .from('stay_drafts')
    .update({
      ...generatedSeo,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.id)
    .eq('organizer_id', selectedOrganizerId)
    .select('*')
    .maybeSingle();

  if (updateError || !updatedDraft) {
    if (isMissingSeoColumnsError(updateError?.message)) {
      return NextResponse.json(
        {
          error:
            'Colonnes SEO manquantes sur stay_drafts. Applique la migration SQL avant de générer le SEO.'
        },
        { status: 412 }
      );
    }

    return NextResponse.json(
      { error: updateError?.message ?? 'Impossible de générer le SEO pour ce brouillon.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    generated: true,
    alreadyGenerated: false,
    seo: pickSeoFromDraft(updatedDraft)
  });
}
