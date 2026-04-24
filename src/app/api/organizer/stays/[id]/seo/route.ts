import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { generateStayDraftSeo } from '@/lib/stay-draft-seo';
import { sanitizeSeoPrimaryKeyword, sanitizeSeoTags, sanitizeSeoText } from '@/lib/stay-seo';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';

type StayRow = Database['public']['Tables']['stays']['Row'];

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

function hasExistingSeoData(stay: StayRow) {
  return Boolean(
    sanitizeSeoText(stay.seo_primary_keyword) ||
      sanitizeSeoText(stay.seo_title) ||
      sanitizeSeoText(stay.seo_meta_description) ||
      sanitizeSeoText(stay.seo_intro_text) ||
      sanitizeSeoText(stay.seo_h1_variant) ||
      sanitizeSeoText(stay.seo_slug_candidate) ||
      (stay.seo_secondary_keywords ?? []).length > 0 ||
      (stay.seo_search_intents ?? []).length > 0 ||
      (stay.seo_internal_link_anchor_suggestions ?? []).length > 0
  );
}

function pickSeoFromStay(stay: StayRow) {
  const seoChecks = Array.isArray(stay.seo_checks)
    ? (stay.seo_checks as unknown[])
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
    seo_primary_keyword: sanitizeSeoPrimaryKeyword(stay.seo_primary_keyword) || null,
    seo_secondary_keywords: sanitizeSeoTags(stay.seo_secondary_keywords ?? []),
    seo_target_city: sanitizeSeoText(stay.seo_target_city) || null,
    seo_target_region: sanitizeSeoText(stay.seo_target_region) || null,
    seo_search_intents: sanitizeSeoTags(stay.seo_search_intents ?? []),
    seo_title: sanitizeSeoText(stay.seo_title) || null,
    seo_meta_description: sanitizeSeoText(stay.seo_meta_description) || null,
    seo_intro_text: sanitizeSeoText(stay.seo_intro_text) || null,
    seo_h1_variant: sanitizeSeoText(stay.seo_h1_variant) || null,
    seo_internal_link_anchor_suggestions: sanitizeSeoTags(stay.seo_internal_link_anchor_suggestions ?? []),
    seo_slug_candidate: sanitizeSeoText(stay.seo_slug_candidate) || null,
    seo_score: Number.isFinite(stay.seo_score) ? stay.seo_score : null,
    seo_checks: seoChecks,
    seo_generated_at: stay.seo_generated_at,
    seo_generation_source: sanitizeSeoText(stay.seo_generation_source) || null
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

function pickCoreSeoFields(
  generatedSeo: ReturnType<typeof generateStayDraftSeo>,
  updatedAt: string
): Database['public']['Tables']['stays']['Update'] {
  return {
    seo_primary_keyword: generatedSeo.seo_primary_keyword,
    seo_secondary_keywords: generatedSeo.seo_secondary_keywords,
    seo_target_city: generatedSeo.seo_target_city,
    seo_target_region: generatedSeo.seo_target_region,
    seo_search_intents: generatedSeo.seo_search_intents,
    seo_title: generatedSeo.seo_title,
    seo_meta_description: generatedSeo.seo_meta_description,
    updated_at: updatedAt
  };
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

  const { data: stay, error: stayError } = await supabase
    .from('stays')
    .select('*')
    .eq('id', params.id)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (stayError || !stay) {
    return NextResponse.json(
      { error: stayError?.message ?? 'Séjour introuvable pour cet organisateur.' },
      { status: 404 }
    );
  }

  const existingSeo = pickSeoFromStay(stay);
  if (!parsedInput.force && hasExistingSeoData(stay)) {
    return NextResponse.json({
      success: true,
      generated: false,
      alreadyGenerated: true,
      seo: existingSeo
    });
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('start_date')
    .eq('stay_id', stay.id);

  const safeSessions = sessionsError ? [] : sessions ?? [];

  const generatedSeo = generateStayDraftSeo({
    title: stay.title,
    summary: stay.summary,
    description: stay.description,
    activities_text: stay.activities_text,
    program_text: stay.program_text,
    location_text: stay.location_text,
    region_text: stay.region_text,
    categories: stay.categories,
    ages: stay.ages,
    age_min: stay.age_min,
    age_max: stay.age_max,
    sessions_json: safeSessions.map((sessionItem) => ({ start_date: sessionItem.start_date }))
  });

  const updatedAt = new Date().toISOString();
  const { data: updatedStay, error: updateError } = await supabase
    .from('stays')
    .update({
      ...generatedSeo,
      updated_at: updatedAt
    })
    .eq('id', params.id)
    .eq('organizer_id', selectedOrganizerId)
    .select('*')
    .maybeSingle();

  if ((updateError || !updatedStay) && isMissingSeoColumnsError(updateError?.message)) {
    const fallback = await supabase
      .from('stays')
      .update(pickCoreSeoFields(generatedSeo, updatedAt))
      .eq('id', params.id)
      .eq('organizer_id', selectedOrganizerId)
      .select('*')
      .maybeSingle();

    if (fallback.error || !fallback.data) {
      if (isMissingSeoColumnsError(fallback.error?.message)) {
        return NextResponse.json(
          {
            error:
              'Colonnes SEO manquantes sur stays. Applique la migration SQL avant de générer le SEO.'
          },
          { status: 412 }
        );
      }

      return NextResponse.json(
        { error: fallback.error?.message ?? 'Impossible de générer le SEO pour ce séjour.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      generated: true,
      alreadyGenerated: false,
      seo: pickSeoFromStay(fallback.data)
    });
  }

  if (updateError || !updatedStay) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Impossible de générer le SEO pour ce séjour.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    generated: true,
    alreadyGenerated: false,
    seo: pickSeoFromStay(updatedStay)
  });
}
