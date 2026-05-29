import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { normalizeStayDraftCategories } from '@/lib/stay-categories';
import { expandDraftAges, normalizeStaySummary, normalizeStayTransportLogisticsMode } from '@/lib/stay-draft-content';
import { writeDraftDestinationFields } from '@/lib/stay-draft-destination';
import { normalizePaymentAids } from '@/lib/payment-aids';
import { mapToCanonicalStayRegion } from '@/lib/stay-regions';
import { sanitizeSeoPrimaryKeyword, sanitizeSeoTags, sanitizeSeoText } from '@/lib/stay-seo';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeStayTitle } from '@/lib/stay-title';
import type { Json } from '@/types/supabase';

export const runtime = 'nodejs';

const autosaveBodySchema = z.object({
  organizerId: z.string().optional(),
  payload: z.record(z.unknown()).optional().default({})
});

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'number' ? item : Number(item)))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.round(item));
}

function asObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asSeoChecks(
  value: unknown
): Array<{ code: string; level: 'ok' | 'warning' | 'info'; message: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => {
      const code = normalizeString(item.code);
      const level =
        item.level === 'ok' || item.level === 'warning' || item.level === 'info'
          ? item.level
          : null;
      const message = normalizeString(item.message);
      if (!code || !level || !message) return null;
      return { code, level, message };
    })
    .filter(
      (
        item
      ): item is { code: string; level: 'ok' | 'warning' | 'info'; message: string } => Boolean(item)
    );
}

function isMissingSeoColumnsError(message: string | null | undefined): boolean {
  const normalized = String(message ?? '').toLowerCase();
  if (!normalized) return false;
  return normalized.includes('column') && normalized.includes('seo_') && normalized.includes('does not exist');
}

function removeSeoFields(payload: Record<string, unknown>): Record<string, unknown> {
  const nextPayload = { ...payload };
  for (const key of Object.keys(nextPayload)) {
    if (key.startsWith('seo_')) {
      delete nextPayload[key];
    }
  }
  return nextPayload;
}

function hasOwn(payload: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const parsedBody = autosaveBodySchema.safeParse(await req.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Payload invalide.' }, { status: 400 });
  }

  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: parsedBody.data.organizerId,
    requiredSection: 'stays'
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { selectedOrganizerId } = access.context;
  const payload = parsedBody.data.payload;
  const supabase = getServerSupabaseClient();

  const { data: currentDraft, error: currentDraftError } = await supabase
    .from('stay_drafts')
    .select('*')
    .eq('id', id)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (currentDraftError || !currentDraft) {
    return NextResponse.json(
      { error: currentDraftError?.message ?? 'Brouillon introuvable.' },
      { status: 404 }
    );
  }

  const now = new Date().toISOString();
  const currentRawPayload = asObject(currentDraft.raw_payload);
  const nextCategories = hasOwn(payload, 'categories')
    ? normalizeStayDraftCategories(asStringArray(payload.categories)).categories
    : normalizeStayDraftCategories(currentDraft.categories ?? []).categories;
  const nextAges = hasOwn(payload, 'ages') ? expandDraftAges(asNumberArray(payload.ages)) : expandDraftAges(currentDraft.ages ?? []);
  const nextSeasonIds = hasOwn(payload, 'season_ids')
    ? asStringArray(payload.season_ids)
    : asStringArray(currentRawPayload.draft_season_ids);
  const nextSeasonNames = hasOwn(payload, 'season_names')
    ? asStringArray(payload.season_names)
    : asStringArray(currentRawPayload.draft_season_names);
  const nextVideoUrls = hasOwn(payload, 'video_urls')
    ? asStringArray(payload.video_urls)
    : asStringArray(currentRawPayload.video_urls);
  const nextAccommodationVideoUrls = hasOwn(payload, 'accommodation_video_urls')
    ? asStringArray(payload.accommodation_video_urls)
    : asStringArray(currentRawPayload.accommodation_video_urls);
  const nextPartnerDiscountRaw = hasOwn(payload, 'partner_discount_percent')
    ? payload.partner_discount_percent
    : currentRawPayload.partner_discount_percent;
  const nextPartnerDiscount =
    typeof nextPartnerDiscountRaw === 'number' && Number.isFinite(nextPartnerDiscountRaw)
      ? nextPartnerDiscountRaw
      : nextPartnerDiscountRaw == null || nextPartnerDiscountRaw === ''
        ? null
        : Number.isFinite(Number(nextPartnerDiscountRaw))
          ? Number(nextPartnerDiscountRaw)
          : null;
  const nextPaymentAids = hasOwn(payload, 'payment_aids')
    ? normalizePaymentAids(payload.payment_aids)
    : normalizePaymentAids(currentDraft.payment_aids ?? []);

  const updatePayload: Record<string, unknown> = {
    title: hasOwn(payload, 'title')
      ? toNullableString(normalizeStayTitle(String(payload.title ?? '')))
      : currentDraft.title,
    summary: hasOwn(payload, 'summary')
      ? toNullableString(normalizeStaySummary(String(payload.summary ?? '')))
      : currentDraft.summary,
    location_text: hasOwn(payload, 'location_text')
      ? toNullableString(payload.location_text)
      : currentDraft.location_text,
    region_text: hasOwn(payload, 'region_text')
      ? toNullableString(mapToCanonicalStayRegion(String(payload.region_text ?? '')))
      : currentDraft.region_text,
    description: hasOwn(payload, 'description') ? toNullableString(payload.description) : currentDraft.description,
    activities_text: hasOwn(payload, 'activities_text')
      ? toNullableString(payload.activities_text)
      : currentDraft.activities_text,
    required_documents_text: hasOwn(payload, 'required_documents_text')
      ? toNullableString(payload.required_documents_text)
      : currentDraft.required_documents_text,
    program_text: hasOwn(payload, 'program_text') ? toNullableString(payload.program_text) : currentDraft.program_text,
    supervision_text: hasOwn(payload, 'supervision_text')
      ? toNullableString(payload.supervision_text)
      : currentDraft.supervision_text,
    transport_text: hasOwn(payload, 'transport_text')
      ? toNullableString(payload.transport_text)
      : currentDraft.transport_text,
    transport_mode: hasOwn(payload, 'transport_mode')
      ? toNullableString(normalizeStayTransportLogisticsMode(String(payload.transport_mode ?? '')))
      : currentDraft.transport_mode,
    payment_aids: nextPaymentAids,
    categories: nextCategories.length > 0 ? nextCategories : null,
    ages: nextAges.length > 0 ? nextAges : null,
    age_min: nextAges.length > 0 ? nextAges[0] : null,
    age_max: nextAges.length > 0 ? nextAges[nextAges.length - 1] : null,
    sessions_json: hasOwn(payload, 'sessions_json')
      ? asObjectArray(payload.sessions_json)
      : currentDraft.sessions_json,
    extra_options_json: hasOwn(payload, 'extra_options_json')
      ? asObjectArray(payload.extra_options_json)
      : currentDraft.extra_options_json,
    transport_options_json: hasOwn(payload, 'transport_options_json')
      ? asObjectArray(payload.transport_options_json)
      : currentDraft.transport_options_json,
    accommodations_json: hasOwn(payload, 'accommodations_json')
      ? asRecord(payload.accommodations_json)
      : currentDraft.accommodations_json,
    images: hasOwn(payload, 'images')
      ? (() => {
          const nextImages = asStringArray(payload.images);
          return nextImages.length > 0 ? nextImages : null;
        })()
      : currentDraft.images,
    seo_primary_keyword: hasOwn(payload, 'seo_primary_keyword')
      ? toNullableString(sanitizeSeoPrimaryKeyword(String(payload.seo_primary_keyword ?? '')))
      : currentDraft.seo_primary_keyword,
    seo_secondary_keywords: hasOwn(payload, 'seo_secondary_keywords')
      ? sanitizeSeoTags(asStringArray(payload.seo_secondary_keywords))
      : currentDraft.seo_secondary_keywords,
    seo_target_city: hasOwn(payload, 'seo_target_city')
      ? toNullableString(sanitizeSeoText(String(payload.seo_target_city ?? '')))
      : currentDraft.seo_target_city,
    seo_target_region: hasOwn(payload, 'seo_target_region')
      ? toNullableString(sanitizeSeoText(String(payload.seo_target_region ?? '')))
      : currentDraft.seo_target_region,
    seo_search_intents: hasOwn(payload, 'seo_search_intents')
      ? sanitizeSeoTags(asStringArray(payload.seo_search_intents))
      : currentDraft.seo_search_intents,
    seo_title: hasOwn(payload, 'seo_title')
      ? toNullableString(sanitizeSeoText(String(payload.seo_title ?? '')))
      : currentDraft.seo_title,
    seo_meta_description: hasOwn(payload, 'seo_meta_description')
      ? toNullableString(sanitizeSeoText(String(payload.seo_meta_description ?? '')))
      : currentDraft.seo_meta_description,
    seo_intro_text: hasOwn(payload, 'seo_intro_text')
      ? toNullableString(sanitizeSeoText(String(payload.seo_intro_text ?? '')))
      : currentDraft.seo_intro_text,
    seo_h1_variant: hasOwn(payload, 'seo_h1_variant')
      ? toNullableString(sanitizeSeoText(String(payload.seo_h1_variant ?? '')))
      : currentDraft.seo_h1_variant,
    seo_internal_link_anchor_suggestions: hasOwn(payload, 'seo_internal_link_anchor_suggestions')
      ? sanitizeSeoTags(asStringArray(payload.seo_internal_link_anchor_suggestions))
      : currentDraft.seo_internal_link_anchor_suggestions,
    seo_slug_candidate: hasOwn(payload, 'seo_slug_candidate')
      ? toNullableString(sanitizeSeoText(String(payload.seo_slug_candidate ?? '')))
      : currentDraft.seo_slug_candidate,
    seo_score: hasOwn(payload, 'seo_score')
      ? (() => {
          const value = payload.seo_score;
          if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
          return null;
        })()
      : currentDraft.seo_score,
    seo_checks: hasOwn(payload, 'seo_checks') ? asSeoChecks(payload.seo_checks) : currentDraft.seo_checks,
    raw_payload: writeDraftDestinationFields(currentRawPayload, {
      destination_type:
        hasOwn(payload, 'destination_type') && typeof payload.destination_type === 'string'
          ? payload.destination_type
          : (currentRawPayload.destination_type as string | null | undefined),
      destination_city:
        hasOwn(payload, 'destination_city') ? normalizeString(payload.destination_city) : String(currentRawPayload.destination_city ?? ''),
      destination_postal_code:
        hasOwn(payload, 'destination_postal_code')
          ? normalizeString(payload.destination_postal_code)
          : String(currentRawPayload.destination_postal_code ?? ''),
      destination_department_code:
        hasOwn(payload, 'destination_department_code')
          ? normalizeString(payload.destination_department_code)
          : String(currentRawPayload.destination_department_code ?? ''),
      destination_region:
        hasOwn(payload, 'destination_region')
          ? mapToCanonicalStayRegion(String(payload.destination_region ?? '')) ?? normalizeString(payload.destination_region)
          : String(currentRawPayload.destination_region ?? ''),
      destination_country:
        hasOwn(payload, 'destination_country')
          ? normalizeString(payload.destination_country)
          : String(currentRawPayload.destination_country ?? ''),
      destination_itinerary_label:
        hasOwn(payload, 'destination_itinerary_label')
          ? normalizeString(payload.destination_itinerary_label)
          : String(currentRawPayload.destination_itinerary_label ?? ''),
      destination_countries:
        hasOwn(payload, 'destination_countries')
          ? asStringArray(payload.destination_countries)
          : asStringArray(currentRawPayload.destination_countries)
    }),
    updated_at: now
  };

  updatePayload.raw_payload = {
    ...(updatePayload.raw_payload as Record<string, unknown>),
    draft_season_ids: nextSeasonIds.length > 0 ? nextSeasonIds : null,
    draft_season_names: nextSeasonNames.length > 0 ? nextSeasonNames : null,
    video_urls: nextVideoUrls.length > 0 ? nextVideoUrls : null,
    accommodation_video_urls:
      nextAccommodationVideoUrls.length > 0 ? nextAccommodationVideoUrls : null,
    partner_discount_percent: nextPartnerDiscount,
    autosave_updated_at: now
  };

  let { data: savedDraft, error: updateError } = await supabase
    .from('stay_drafts')
    .update(updatePayload)
    .eq('id', id)
    .eq('organizer_id', selectedOrganizerId)
    .select('id,updated_at')
    .maybeSingle();

  if ((updateError || !savedDraft) && isMissingSeoColumnsError(updateError?.message)) {
    const fallbackPayload = removeSeoFields(updatePayload);
    const fallback = await supabase
      .from('stay_drafts')
      .update(fallbackPayload)
      .eq('id', id)
      .eq('organizer_id', selectedOrganizerId)
      .select('id,updated_at')
      .maybeSingle();
    savedDraft = fallback.data;
    updateError = fallback.error;
  }

  if (updateError || !savedDraft) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Impossible de sauvegarder automatiquement le brouillon.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    draftId: savedDraft.id,
    updatedAt: savedDraft.updated_at
  });
}
