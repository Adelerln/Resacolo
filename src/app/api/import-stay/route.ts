import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { mockOrganizerTenant } from '@/lib/mocks';
import {
  extractJsonLdOfferPricesFromHtml,
  extractStayData,
  extractThalieOptionUrlPricing,
  extractTransportVariants,
  extractVideoUrls,
  fetchHtml,
  buildDraftTransportOptionsFromVariants,
  mergeThalieSessionBaselinesIntoSessions,
  pickImportedSessionReferencePriceCents,
  selectBestStayImages,
  type DraftTransportPriceDebug,
  type DraftTransportVariant
} from '@/lib/stay-draft-import';
import {
  renderStayPageWithPlaywright,
  shouldUsePlaywrightForDynamicImages
} from '@/lib/stay-draft-playwright';
import { normalizeStayAges } from '@/lib/stay-ages';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeStayTitle } from '@/lib/stay-title';

export const runtime = 'nodejs';
/** Vercel / hébergeurs serverless : laisser le temps au fetch + Playwright (sinon 504 silencieux). */
export const maxDuration = 300;

function envTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function redirectToOrganizerStayCreation(
  req: Request,
  organizerId: string | null,
  params?: Record<string, string>
) {
  const query = new URLSearchParams(params ?? {}).toString();
  const path = withOrganizerQuery(
    query ? `/organisme/sejours/new?${query}` : '/organisme/sejours/new',
    organizerId
  );
  return NextResponse.redirect(new URL(path, req.url), 303);
}

async function readImportInput(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as {
      sourceUrl?: unknown;
      source_url?: unknown;
      organizerId?: unknown;
      organizer_id?: unknown;
      selectedAccommodationId?: unknown;
      selected_accommodation_id?: unknown;
    };
    return {
      sourceUrl:
        typeof body.sourceUrl === 'string'
          ? body.sourceUrl
          : typeof body.source_url === 'string'
            ? body.source_url
            : '',
      organizerId:
        typeof body.organizerId === 'string'
          ? body.organizerId
          : typeof body.organizer_id === 'string'
            ? body.organizer_id
            : '',
      selectedAccommodationId:
        typeof body.selectedAccommodationId === 'string'
          ? body.selectedAccommodationId
          : typeof body.selected_accommodation_id === 'string'
            ? body.selected_accommodation_id
            : ''
    };
  }

  const formData = await req.formData();
  return {
    sourceUrl: String(formData.get('sourceUrl') ?? formData.get('source_url') ?? ''),
    organizerId: String(formData.get('organizerId') ?? formData.get('organizer_id') ?? ''),
    selectedAccommodationId: String(
      formData.get('selectedAccommodationId') ?? formData.get('selected_accommodation_id') ?? ''
    )
  };
}

function buildRawPayload(
  html: string,
  fetchedAt: string,
  sourceUrl: string,
  finalUrl: string,
  contentType: string | null,
  status: number,
  extracted: ReturnType<typeof extractStayData>,
  transportVariants: DraftTransportVariant[],
  transportPriceDebug: DraftTransportPriceDebug[],
  videoUrls: string[],
  importOptions?: {
    existingAccommodationId?: string | null;
    existingAccommodationName?: string | null;
  }
) {
  return {
    html,
    fetched_at: fetchedAt,
    source_url: sourceUrl,
    final_url: finalUrl,
    content_type: contentType,
    status_code: status,
    extracted,
    video_urls: videoUrls,
    transport_variants: transportVariants,
    transport_matrix: transportVariants,
    transport_price_debug: transportPriceDebug,
    import_options: {
      existing_accommodation_id: importOptions?.existingAccommodationId ?? null,
      existing_accommodation_name: importOptions?.existingAccommodationName ?? null
    }
  };
}

function transportVariantScore(variant: DraftTransportVariant): number {
  let score = 0;
  if (typeof variant.amount_cents === 'number') score += 100;
  if (variant.confidence === 'high') score += 30;
  if (variant.confidence === 'medium') score += 20;
  if (variant.confidence === 'low') score += 10;
  return score;
}

function mergeTransportVariants(
  primary: DraftTransportVariant[],
  secondary: DraftTransportVariant[]
): DraftTransportVariant[] {
  const map = new Map<string, DraftTransportVariant>();

  for (const variant of [...primary, ...secondary]) {
    const key = `${variant.departure_city}|${variant.return_city}`.toLowerCase();
    const existing = map.get(key);
    if (!existing || transportVariantScore(variant) > transportVariantScore(existing)) {
      map.set(key, variant);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    `${a.departure_city}|${a.return_city}`.localeCompare(`${b.departure_city}|${b.return_city}`, 'fr')
  );
}

function buildDraftUpdatePayload(
  columns: Set<string>,
  extracted: ReturnType<typeof extractStayData>,
  rawPayload: ReturnType<typeof buildRawPayload>,
  transportVariants: DraftTransportVariant[]
) {
  const payload: Record<string, unknown> = {};

  // Parsing manuel minimal : on ne remplit ici que les champs fiables.
  if (columns.has('title')) payload.title = normalizeStayTitle(extracted.title);
  if (columns.has('description')) payload.description = extracted.description;
  if (columns.has('age_min')) payload.age_min = extracted.ageMin;
  if (columns.has('age_max')) payload.age_max = extracted.ageMax;
  if (columns.has('ages')) {
    const ages = normalizeStayAges([], extracted.ageMin, extracted.ageMax);
    payload.ages = ages.length > 0 ? ages : null;
  }
  if (columns.has('images')) {
    payload.images = extracted.images.length > 0 ? extracted.images : null;
  }
  if (columns.has('image')) {
    payload.image = extracted.images[0] ?? null;
  }
  if (columns.has('source_url')) {
    payload.source_url = rawPayload.source_url;
  }
  if (columns.has('raw_text')) {
    payload.raw_text = extracted.rawText;
  }
  if (columns.has('raw_payload')) {
    payload.raw_payload = rawPayload;
  }
  if (columns.has('sessions_json')) {
    payload.sessions_json = extracted.sessionsJson && extracted.sessionsJson.length > 0
      ? extracted.sessionsJson
      : null;
  }
  if (columns.has('transport_mode')) {
    payload.transport_mode = extracted.transportMode ?? null;
  }
  if (columns.has('transport_options_json')) {
    const transportOptions = buildDraftTransportOptionsFromVariants(transportVariants);
    payload.transport_options_json = transportOptions.length > 0 ? transportOptions : null;
  }
  if (columns.has('status')) {
    payload.status = 'pending';
  }

  return payload;
}

async function updateDraftWithFallbacks(
  draftId: string,
  payload: Record<string, unknown>
) {
  const supabase = getServerSupabaseClient();

  const attempts: Record<string, unknown>[] = [];
  const baseAttempt = { ...payload };
  attempts.push(baseAttempt);

  const stringifiedAttempt = { ...payload };
  let hasStringifiedFallback = false;
  const maybeComplexKeys = [
    'activities',
    'images',
    'sessions_json',
    'extra_options_json',
    'transport_options_json',
    'accommodations_json',
    'raw_payload'
  ];
  for (const key of maybeComplexKeys) {
    const value = stringifiedAttempt[key];
    if (Array.isArray(value)) {
      stringifiedAttempt[key] =
        key === 'activities' ? value.join(' | ') || null : JSON.stringify(value);
      hasStringifiedFallback = true;
      continue;
    }
    if (value && typeof value === 'object') {
      stringifiedAttempt[key] = JSON.stringify(value);
      hasStringifiedFallback = true;
    }
  }
  if (hasStringifiedFallback) {
    attempts.push(stringifiedAttempt);
  }

  const strippedAttempt = { ...payload };
  delete strippedAttempt.activities;
  delete strippedAttempt.images;
  delete strippedAttempt.sessions_json;
  delete strippedAttempt.transport_options_json;
  delete strippedAttempt.accommodations_json;
  if (Object.keys(strippedAttempt).length > 0) {
    attempts.push(strippedAttempt);
  }

  let lastError: { message: string } | null = null;
  for (const attempt of attempts) {
    const { error } = await supabase
      .from('stay_drafts')
      .update(attempt)
      .eq('id', draftId);

    if (!error) return null;
    lastError = error;
  }

  return lastError;
}

export async function POST(req: Request) {
  const isMockMode = process.env.MOCK_UI === '1' || process.env.DISABLE_AUTH === '1';
  const session = await getSession();

  if (!isMockMode && (!session || session.role !== 'ORGANISATEUR')) {
    return NextResponse.redirect(new URL('/login', req.url), 303);
  }

  const {
    sourceUrl: sourceUrlRaw,
    organizerId: organizerIdRaw,
    selectedAccommodationId: selectedAccommodationIdRaw
  } = await readImportInput(req);
  const sourceUrl = sourceUrlRaw.trim();
  const requestedOrganizerId = organizerIdRaw.trim();
  const selectedAccommodationId = selectedAccommodationIdRaw.trim();
  const { selectedOrganizerId } = await resolveOrganizerSelection(
    requestedOrganizerId || undefined,
    isMockMode ? mockOrganizerTenant.id : session?.tenantId ?? null
  );

  if (!selectedOrganizerId) {
    return redirectToOrganizerStayCreation(req, null, {
      error: 'Aucun organisateur disponible.'
    });
  }

  if (!sourceUrl) {
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: "L'URL de la fiche séjour est requise."
    });
  }

  try {
    const parsedUrl = new URL(sourceUrl);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('invalid-protocol');
    }
  } catch {
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: 'Veuillez saisir une URL valide.'
    });
  }

  const supabase = getServerSupabaseClient();
  let selectedAccommodation:
    | {
        id: string;
        name: string;
      }
    | null = null;

  if (selectedAccommodationId) {
    const { data: accommodation, error: accommodationError } = await supabase
      .from('accommodations')
      .select('id,name')
      .eq('id', selectedAccommodationId)
      .eq('organizer_id', selectedOrganizerId)
      .maybeSingle();

    if (accommodationError || !accommodation) {
      return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
        error: 'Hébergement introuvable pour cet organisateur.'
      });
    }

    selectedAccommodation = accommodation;
  }

  const { data: insertedDraft, error: insertError } = await supabase
    .from('stay_drafts')
    .insert({
      organizer_id: selectedOrganizerId,
      source_url: sourceUrl,
      status: 'pending'
    })
    .select('*')
    .single();

  if (insertError || !insertedDraft) {
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: insertError?.message ?? 'Impossible de créer le brouillon.'
    });
  }

  const draftColumns = new Set(Object.keys(insertedDraft));

  let fetchedHtml: Awaited<ReturnType<typeof fetchHtml>>;
  try {
    fetchedHtml = await fetchHtml(sourceUrl);
  } catch (error) {
    const fetchErrorMessage =
      error instanceof Error ? error.message : 'Impossible de récupérer la page source.';

    if (draftColumns.has('raw_payload')) {
      await supabase
        .from('stay_drafts')
        .update({
          raw_payload: {
            source_url: sourceUrl,
            fetch_error: fetchErrorMessage,
            fetched_at: new Date().toISOString()
          }
        })
        .eq('id', insertedDraft.id);
    }

    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: fetchErrorMessage
    });
  }

  const extracted = extractStayData(fetchedHtml.html, fetchedHtml.finalUrl);
  let sourceHost: string | null = null;
  try {
    sourceHost = new URL(fetchedHtml.finalUrl || sourceUrl).hostname.toLowerCase();
  } catch {
    sourceHost = null;
  }
  const isThalieImport = Boolean(sourceHost?.includes('thalie.eu'));
  const forcePlaywright = envTruthy(process.env.IMPORT_STAY_FORCE_PLAYWRIGHT);
  const shouldTryDynamicRender =
    forcePlaywright ||
    shouldUsePlaywrightForDynamicImages(fetchedHtml.html, extracted.images.length);
  let playwrightFailureMessage: string | null = null;
  const dynamicSnapshot = shouldTryDynamicRender
    ? await renderStayPageWithPlaywright(fetchedHtml.finalUrl).catch((error) => {
        playwrightFailureMessage = error instanceof Error ? error.message : 'unknown-error';
        console.warn('[import-stay] Playwright snapshot failed', {
          sourceUrl: fetchedHtml.finalUrl,
          error: playwrightFailureMessage
        });
        return null;
      })
    : null;
  const effectiveHtml = dynamicSnapshot?.html || fetchedHtml.html;
  const effectiveFinalUrl = dynamicSnapshot?.finalUrl || fetchedHtml.finalUrl;
  const extractedWithDynamicDom =
    dynamicSnapshot && dynamicSnapshot.html
      ? extractStayData(dynamicSnapshot.html, dynamicSnapshot.finalUrl)
      : extracted;
  const thaliePricing = isThalieImport
    ? await extractThalieOptionUrlPricing(fetchedHtml.html, fetchedHtml.finalUrl).catch((error) => {
        console.warn('[import-stay] Thalie option-url pricing failed', {
          sourceUrl: fetchedHtml.finalUrl,
          error: error instanceof Error ? error.message : 'unknown-error'
        });
        return null;
      })
    : null;
  const extractedAfterThalieSessions = {
    ...extractedWithDynamicDom,
    transportMode: thaliePricing?.transportMode || extractedWithDynamicDom.transportMode,
    sessionsJson:
      mergeThalieSessionBaselinesIntoSessions(
        extractedWithDynamicDom.sessionsJson,
        thaliePricing?.sessionBaselines ?? dynamicSnapshot?.thalieSessionBaselines ?? []
      ) ?? extractedWithDynamicDom.sessionsJson
  };
  const mergedExtractedImages = Array.from(
    new Set([
      ...extracted.images,
      ...extractedWithDynamicDom.images,
      ...(dynamicSnapshot?.imageUrls ?? [])
    ])
  );
  const mergedVideoUrls = Array.from(
    new Set([
      ...extractVideoUrls(fetchedHtml.html, fetchedHtml.finalUrl),
      ...(dynamicSnapshot?.videoUrls ?? [])
    ])
  );
  const [selectedImages, transportExtraction] = await Promise.all([
    selectBestStayImages(effectiveHtml, effectiveFinalUrl, mergedExtractedImages, {
      title: extractedAfterThalieSessions.title,
      description: extractedAfterThalieSessions.description,
      summary: extractedAfterThalieSessions.summary,
      locationText: extractedAfterThalieSessions.locationText,
      regionText: extractedAfterThalieSessions.regionText,
      activities: extractedAfterThalieSessions.activities
    }),
    extractTransportVariants(effectiveHtml, effectiveFinalUrl)
  ]);
  const extractedWithSmartImages = {
    ...extractedAfterThalieSessions,
    images:
      selectedImages.length > 0
        ? selectedImages
        : mergedExtractedImages.length > 0
          ? mergedExtractedImages
          : extractedAfterThalieSessions.images
  };
  const thaliePricingFromOptionUrls = Boolean(thaliePricing);
  const thaliePbpFromPlaywright =
    !thaliePricingFromOptionUrls && (dynamicSnapshot?.thalieSessionBaselines?.length ?? 0) > 0;
  const transportVariants = mergeTransportVariants(
    thaliePricing?.transportVariants ?? dynamicSnapshot?.transportVariants ?? [],
    thaliePricingFromOptionUrls || thaliePbpFromPlaywright ? [] : transportExtraction.transportVariants
  );
  const transportPriceDebug = [
    ...(thaliePricing?.transportPriceDebug ?? dynamicSnapshot?.transportPriceDebug ?? []),
    ...(thaliePricingFromOptionUrls || thaliePbpFromPlaywright ? [] : transportExtraction.transportPriceDebug)
  ];
  const rawPayload = buildRawPayload(
    effectiveHtml,
    fetchedHtml.fetchedAt,
    sourceUrl,
    effectiveFinalUrl,
    fetchedHtml.contentType,
    fetchedHtml.status,
    extractedWithSmartImages,
    transportVariants,
    transportPriceDebug,
    mergedVideoUrls,
    {
      existingAccommodationId: selectedAccommodation?.id ?? null,
      existingAccommodationName: selectedAccommodation?.name ?? null
    }
  );
  const traceDirConfigured = Boolean(process.env.PLAYWRIGHT_TRACE_DIR?.trim());
  const videoDirConfigured = Boolean(process.env.PLAYWRIGHT_IMPORT_VIDEO_DIR?.trim());

  Object.assign(rawPayload, {
    import_review_debrief: {
      schema: 'import_review_debrief/v1',
      built_at: new Date().toISOString(),
      source_request_url: sourceUrl,
      source_host: sourceHost,
      session_price_extraction: {
        price_from_eur_static: extracted.priceFrom,
        price_from_eur_after_dynamic_dom: extractedWithDynamicDom.priceFrom,
        pick_reference_cents_static: pickImportedSessionReferencePriceCents(extracted),
        pick_reference_cents_after_dynamic_dom: pickImportedSessionReferencePriceCents(
          extractedAfterThalieSessions
        ),
        thalie_session_baselines_from_option_urls_eur:
          thaliePricing?.sessionBaselines?.map((b) => ({
            date_label: b.date_label,
            baseline_total_eur:
              b.baseline_total_cents != null && Number.isFinite(b.baseline_total_cents)
                ? Math.round(b.baseline_total_cents) / 100
                : null
          })) ?? null,
        thalie_session_baselines_from_playwright_eur:
          dynamicSnapshot?.thalieSessionBaselines?.map((b) => ({
            date_label: b.date_label,
            baseline_total_eur:
              b.baseline_total_cents != null && Number.isFinite(b.baseline_total_cents)
                ? Math.round(b.baseline_total_cents) / 100
                : null
          })) ?? null,
        json_ld_offer_prices_eur_sorted_static: extractJsonLdOfferPricesFromHtml(fetchedHtml.html),
        json_ld_offer_prices_eur_sorted_effective: extractJsonLdOfferPricesFromHtml(effectiveHtml),
        note:
          'Si plusieurs tarifs session dans sessionsJson : pas de référence unique (pick null). Sinon priorité aux prix session puis priceFrom (min JSON-LD). Pour Thalie, priorité au parcours statique par URLs d’options (dates puis villes aller), avec prix session = Dépose centre / Reprise centre et transport global = aller x 2.'
      },
      playwright_how_to_debug: {
        trace_zip_ui:
          traceDirConfigured
            ? `Trace activée (PLAYWRIGHT_TRACE_DIR). Ouvrir le .zip avec : npx playwright show-trace <fichier.zip> — relecture action par action, captures, DOM.`
            : 'Pour un « écran » rejeu : exporter PLAYWRIGHT_TRACE_DIR=/un/dossier avant import, puis npx playwright show-trace sur le .zip généré.',
        headed_window:
          'IMPORT_STAY_PLAYWRIGHT_HEADED=1 : navigateur réel visible pendant l’import.',
        slow_mo: 'PLAYWRIGHT_SLOW_MO_MS=400 : ralentit les actions.',
        video_mp4: videoDirConfigured
          ? 'PLAYWRIGHT_IMPORT_VIDEO_DIR : vidéo MP4 enregistrée pour ce run.'
          : 'PLAYWRIGHT_IMPORT_VIDEO_DIR=/un/dossier : enregistre une vidéo MP4 de la page (si supporté).',
        server_logs: 'PLAYWRIGHT_VERBOSE_IMPORT=1 : détails dans les logs serveur Next.',
        inspector:
          'PWDEBUG=1 (avec next dev) : inspecteur Playwright, exécution pas à pas sur le premier await.'
      },
      static_fetch: {
        final_url: fetchedHtml.finalUrl,
        fetched_at: fetchedHtml.fetchedAt,
        status_code: fetchedHtml.status,
        content_type: fetchedHtml.contentType,
        html_length_chars: fetchedHtml.html.length,
        extracted_after_static_dom: {
          title: extracted.title ?? null,
          image_count: extracted.images.length
        }
      },
      effective_after_processing: {
        final_url: effectiveFinalUrl,
        html_length_chars: effectiveHtml.length,
        merged_candidate_image_count: mergedExtractedImages.length,
        selected_images_after_scoring: selectedImages.length,
        video_url_count: mergedVideoUrls.length,
        transport_variant_count: transportVariants.length,
        transport_price_debug_count: transportPriceDebug.length
      },
      playwright: !shouldTryDynamicRender
        ? { attempted: false, reason: 'skipped_static_html_sufficient_or_heuristic' }
        : dynamicSnapshot
          ? {
              attempted: true,
              success: true,
              browser_engine: dynamicSnapshot.browserEngine,
              snapshot_final_url: dynamicSnapshot.finalUrl,
              snapshot_html_length_chars: dynamicSnapshot.html.length,
              dom_image_urls_found: dynamicSnapshot.imageUrls.length,
              dom_video_urls_found: dynamicSnapshot.videoUrls.length,
              transport_variants_from_playwright: dynamicSnapshot.transportVariants.length,
              transport_detected_flag: dynamicSnapshot.transportDetected,
              ignored_for_thalie_transport: thaliePricingFromOptionUrls,
              force_playwright_flag: forcePlaywright
            }
          : {
              attempted: true,
              success: false,
              error_message: playwrightFailureMessage,
              force_playwright_flag: forcePlaywright
            }
    }
  });
  if (dynamicSnapshot) {
    Object.assign(rawPayload, {
      playwright: {
        browser_engine: dynamicSnapshot.browserEngine,
        final_url: dynamicSnapshot.finalUrl,
        image_count: dynamicSnapshot.imageUrls.length,
        video_count: dynamicSnapshot.videoUrls.length,
        used_for_dynamic_images: true,
        used_for_dynamic_transport:
          dynamicSnapshot.transportDetected || dynamicSnapshot.transportVariants.length > 0,
        transport_variant_count: dynamicSnapshot.transportVariants.length,
        force_playwright: forcePlaywright
      }
    });
  }
  const updatePayload = buildDraftUpdatePayload(
    draftColumns,
    extractedWithSmartImages,
    rawPayload,
    transportVariants
  );
  const updateError = await updateDraftWithFallbacks(insertedDraft.id, updatePayload);

  if (updateError) {
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: updateError.message ?? 'Impossible de mettre à jour le brouillon.'
    });
  }

  return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
    prefill: 'created',
    draftId: insertedDraft.id
  });
}
