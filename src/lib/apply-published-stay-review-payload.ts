import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseMergedExtraOptionsRows,
  parseTransportOptionsFromJson,
  syncExtraOptions,
  syncInsuranceOptions,
  syncStayMedia,
  syncTransportOptions
} from '@/lib/publish-stay-draft';
import { normalizeStayCategories, normalizeStayDraftCategories, stayCategoryLabelToValue } from '@/lib/stay-categories';
import {
  expandDraftAges,
  normalizeStaySummary,
  normalizeStayTransportLogisticsMode
} from '@/lib/stay-draft-content';
import { isMissingRegionTextColumnError, normalizeStayRegion } from '@/lib/stay-regions';
import { sanitizeSeoTags, sanitizeSeoText } from '@/lib/stay-seo';
import { normalizeStayTitle } from '@/lib/stay-title';
import type { Json } from '@/types/supabase';
import type { Database } from '@/types/supabase';
import type { StayDraftReviewPayload } from '@/types/stay-draft-review';

function isMissingSeoColumnsError(message: string | null | undefined): boolean {
  const normalizedMessage = (message ?? '').toLowerCase();
  return (
    normalizedMessage.includes('seo_primary_keyword') ||
    normalizedMessage.includes('seo_secondary_keywords') ||
    normalizedMessage.includes('seo_target_city') ||
    normalizedMessage.includes('seo_target_region') ||
    normalizedMessage.includes('seo_search_intents') ||
    normalizedMessage.includes('seo_title') ||
    normalizedMessage.includes('seo_meta_description') ||
    normalizedMessage.includes('seo_intro_text') ||
    normalizedMessage.includes('seo_h1_variant') ||
    normalizedMessage.includes('seo_internal_link_anchor_suggestions') ||
    normalizedMessage.includes('seo_slug_candidate') ||
    normalizedMessage.includes('seo_score') ||
    normalizedMessage.includes('seo_checks')
  );
}

type StayUpdate = Database['public']['Tables']['stays']['Update'];

/**
 * Met à jour le séjour publié + options / assurances / transports / médias.
 * Ne modifie pas les sessions (gérées à part pour préserver les réservations).
 */
export async function applyPublishedStayReviewPayload(
  supabase: SupabaseClient<Database>,
  stayId: string,
  organizerId: string,
  payload: StayDraftReviewPayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: stay, error: stayReadError } = await supabase
    .from('stays')
    .select('id,organizer_id,transport_mode')
    .eq('id', stayId)
    .maybeSingle();

  if (stayReadError || !stay || stay.organizer_id !== organizerId) {
    return { ok: false, message: 'Séjour introuvable ou accès refusé.' };
  }

  const labels = normalizeStayDraftCategories(payload.categories).categories;
  const categoryValues = normalizeStayCategories(
    labels.map((label) => stayCategoryLabelToValue(label) ?? '').filter(Boolean)
  );
  const ages = expandDraftAges(payload.ages);
  const ageMin = ages.length > 0 ? ages[0]! : null;
  const ageMax = ages.length > 0 ? ages[ages.length - 1]! : null;

  const region = normalizeStayRegion(payload.region_text);

  const requestedTransportMode =
    normalizeStayTransportLogisticsMode(payload.transport_mode) || stay.transport_mode || 'Sans transport';

  const { data: existingTransportOptions } = await supabase
    .from('transport_options')
    .select('id')
    .eq('stay_id', stayId);
  const hasExistingTransportOptions = (existingTransportOptions ?? []).length > 0;

  if (hasExistingTransportOptions && requestedTransportMode !== (stay.transport_mode || 'Sans transport')) {
    return {
      ok: false,
      message:
        'Impossible de modifier le type de transport tant que des villes de transport existent. Supprimez-les d’abord.'
    };
  }

  const basePayload: StayUpdate = {
    title: normalizeStayTitle(payload.title),
    summary: normalizeStaySummary(payload.summary) || null,
    description: payload.description.trim() || null,
    activities_text: payload.activities_text.trim() || null,
    program_text: payload.program_text.trim() || null,
    supervision_text: payload.supervision_text.trim() || null,
    required_documents_text: payload.required_documents_text.trim() || null,
    categories: categoryValues,
    ages,
    age_min: ageMin,
    age_max: ageMax,
    location_text: payload.location_text.trim() || null,
    transport_mode: requestedTransportMode,
    transport_text: payload.transport_text.trim() || null,
    partner_discount_percent:
      payload.partner_discount_percent != null && Number.isFinite(payload.partner_discount_percent)
        ? payload.partner_discount_percent
        : null
  };

  const seoPayload: StayUpdate = {
    seo_primary_keyword: sanitizeSeoText(payload.seo_primary_keyword) || null,
    seo_secondary_keywords: sanitizeSeoTags(payload.seo_secondary_keywords),
    seo_target_city: sanitizeSeoText(payload.seo_target_city) || null,
    seo_target_region: sanitizeSeoText(payload.seo_target_region) || null,
    seo_search_intents: sanitizeSeoTags(payload.seo_search_intents),
    seo_title: sanitizeSeoText(payload.seo_title) || null,
    seo_meta_description: sanitizeSeoText(payload.seo_meta_description) || null,
    seo_intro_text: sanitizeSeoText(payload.seo_intro_text) || null,
    seo_h1_variant: sanitizeSeoText(payload.seo_h1_variant) || null,
    seo_internal_link_anchor_suggestions: sanitizeSeoTags(payload.seo_internal_link_anchor_suggestions),
    seo_slug_candidate: sanitizeSeoText(payload.seo_slug_candidate) || null,
    seo_score: payload.seo_score,
    seo_checks: payload.seo_checks as unknown as Database['public']['Tables']['stays']['Row']['seo_checks']
  };

  const payloadWithRegionAndSeo = { ...basePayload, region_text: region, ...seoPayload };
  const payloadWithSeo = { ...basePayload, ...seoPayload };
  const payloadWithRegion = { ...basePayload, region_text: region };
  let updateError: { message: string } | null = null;

  const firstAttempt = await supabase.from('stays').update(payloadWithRegionAndSeo).eq('id', stayId);
  updateError = firstAttempt.error;

  if (updateError) {
    const missingRegion = isMissingRegionTextColumnError(updateError.message);
    const missingSeo = isMissingSeoColumnsError(updateError.message);

    if (missingRegion && missingSeo) {
      const fallbackWithoutRegion = await supabase.from('stays').update(payloadWithSeo).eq('id', stayId);
      updateError = fallbackWithoutRegion.error;

      if (updateError && isMissingSeoColumnsError(updateError.message)) {
        const fallbackBase = await supabase.from('stays').update(basePayload).eq('id', stayId);
        updateError = fallbackBase.error;
      }
    } else if (missingRegion) {
      const fallbackWithoutRegion = await supabase.from('stays').update(payloadWithSeo).eq('id', stayId);
      updateError = fallbackWithoutRegion.error;
    } else if (missingSeo) {
      const fallbackWithoutSeo = await supabase.from('stays').update(payloadWithRegion).eq('id', stayId);
      updateError = fallbackWithoutSeo.error;

      if (updateError && isMissingRegionTextColumnError(updateError.message)) {
        const fallbackBase = await supabase.from('stays').update(basePayload).eq('id', stayId);
        updateError = fallbackBase.error;
      }
    }
  }

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  try {
    const mergedRows = payload.extra_options_json as Array<Record<string, unknown>>;
    const { extraOptions, insuranceOptions } = parseMergedExtraOptionsRows(mergedRows);
    await syncExtraOptions(supabase, stayId, extraOptions);
    await syncInsuranceOptions(supabase, stayId, insuranceOptions);

    const transportParsed = parseTransportOptionsFromJson(
      payload.transport_options_json as unknown as Json
    );
    await syncTransportOptions(supabase, stayId, transportParsed);

    await syncStayMedia(supabase, organizerId, stayId, payload.images);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur lors de la synchronisation des données liées.';
    return { ok: false, message: msg };
  }

  return { ok: true };
}
