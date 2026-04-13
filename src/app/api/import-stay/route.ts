import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { mockOrganizerTenant } from '@/lib/mocks';
import {
  extractStayData,
  extractTransportVariants,
  fetchHtml,
  selectBestStayImages,
  type DraftTransportPriceDebug,
  type DraftTransportVariant
} from '@/lib/stay-draft-import';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeStayTitle } from '@/lib/stay-title';

export const runtime = 'nodejs';

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
            : ''
    };
  }

  const formData = await req.formData();
  return {
    sourceUrl: String(formData.get('sourceUrl') ?? formData.get('source_url') ?? ''),
    organizerId: String(formData.get('organizerId') ?? formData.get('organizer_id') ?? '')
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
  transportPriceDebug: DraftTransportPriceDebug[]
) {
  return {
    html,
    fetched_at: fetchedAt,
    source_url: sourceUrl,
    final_url: finalUrl,
    content_type: contentType,
    status_code: status,
    extracted,
    transport_variants: transportVariants,
    transport_matrix: transportVariants,
    transport_price_debug: transportPriceDebug
  };
}

function buildDraftTransportOptionsFromVariants(transportVariants: DraftTransportVariant[]) {
  return transportVariants
    .filter((variant) => typeof variant.amount_cents === 'number' && Number.isFinite(variant.amount_cents))
    .map((variant) => ({
      label:
        variant.departure_city === variant.return_city
          ? variant.departure_city
          : `${variant.departure_city} / ${variant.return_city}`,
      departure_city: variant.departure_city,
      return_city: variant.return_city,
      amount_cents: variant.amount_cents,
      price:
        typeof variant.amount_cents === 'number'
          ? Number((variant.amount_cents / 100).toFixed(2))
          : null,
      currency: variant.currency ?? 'EUR',
      source_url: variant.source_url,
      departure_label_raw: variant.departure_label_raw ?? null,
      return_label_raw: variant.return_label_raw ?? null
    }));
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

  const { sourceUrl: sourceUrlRaw, organizerId: organizerIdRaw } = await readImportInput(req);
  const sourceUrl = sourceUrlRaw.trim();
  const requestedOrganizerId = organizerIdRaw.trim();
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
  const [selectedImages, transportExtraction] = await Promise.all([
    selectBestStayImages(fetchedHtml.html, fetchedHtml.finalUrl, extracted.images, {
      title: extracted.title,
      description: extracted.description,
      summary: extracted.summary,
      locationText: extracted.locationText,
      regionText: extracted.regionText,
      activities: extracted.activities
    }),
    extractTransportVariants(fetchedHtml.html, fetchedHtml.finalUrl)
  ]);
  const extractedWithSmartImages = {
    ...extracted,
    images: selectedImages.length > 0 ? selectedImages : extracted.images
  };
  const transportVariants = transportExtraction.transportVariants;
  const transportPriceDebug = transportExtraction.transportPriceDebug;
  const rawPayload = buildRawPayload(
    fetchedHtml.html,
    fetchedHtml.fetchedAt,
    sourceUrl,
    fetchedHtml.finalUrl,
    fetchedHtml.contentType,
    fetchedHtml.status,
    extractedWithSmartImages,
    transportVariants,
    transportPriceDebug
  );
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
