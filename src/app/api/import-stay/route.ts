import { after } from 'next/server';
import { NextResponse } from 'next/server';
import { requireOrganizerApiAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { runStayImportInBackground } from '@/lib/run-stay-import-background';
import { canonicalizeStaySourceUrl, tryCanonicalizeStaySourceUrl } from '@/lib/stay-source-url-canonical';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';

export const runtime = 'nodejs';
/** Vercel : le travail lourd continue via `after()` après la redirection ; garder une marge pour Playwright + Thalie. */
export const maxDuration = 300;
type ImportAction = 'created' | 'existing' | 'restarted';

type ImportableDraftRow = {
  id: string;
  status: string;
  raw_payload: unknown;
  source_url: string;
  source_url_canonical?: string | null;
};
type ExistingStayRow = {
  id: string;
  source_url: string | null;
};

type DynamicStayDraftInsertBuilder = {
  insert: (values: Record<string, unknown>) => {
    select: (columns: string) => {
      single: () => Promise<{
        data: ImportableDraftRow | null;
        error: { code?: string | null; message?: string | null } | null;
      }>;
    };
  };
};

function requestExpectsJson(req: Request): boolean {
  const contentType = req.headers.get('content-type') ?? '';
  const accept = req.headers.get('accept') ?? '';
  return contentType.includes('application/json') || accept.includes('application/json');
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

function isUniqueCanonicalConflict(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error || error.code !== '23505') return false;
  const message = String(error.message ?? '').toLowerCase();
  return (
    message.includes('source_url_canonical') ||
    message.includes('stay_drafts_organizer_source_url_canonical_uidx')
  );
}

function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null,
  columnName: string
): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  const message = String(error.message ?? '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('column');
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      return {};
    }
  }
  return {};
}

function buildImportRawPayload(input: {
  existingRawPayload?: unknown;
  selectedAccommodation: { id: string; name: string } | null;
  includePricing: boolean;
  progressLabel: string;
}): Record<string, unknown> {
  const base = toObject(input.existingRawPayload);
  const currentImportOptions = toObject(base.import_options);

  return {
    ...base,
    import_options: {
      ...currentImportOptions,
      existing_accommodation_id: input.selectedAccommodation?.id ?? null,
      existing_accommodation_name: input.selectedAccommodation?.name ?? null,
      include_pricing: input.includePricing
    },
    import_progress: {
      step: 'created',
      label: input.progressLabel,
      percent: 5,
      completed: false,
      updated_at: new Date().toISOString(),
      error: null
    }
  };
}

function isFailedStatus(status: string | null | undefined): boolean {
  return String(status ?? '').trim().toLowerCase() === 'failed';
}

function shouldMatchExistingSourceUrl(
  sourceUrlValue: string | null | undefined,
  canonicalSourceUrl: string,
  sourceUrlCandidates: Set<string>
): boolean {
  const normalized = String(sourceUrlValue ?? '').trim();
  if (!normalized) return false;
  if (sourceUrlCandidates.has(normalized)) return true;
  return tryCanonicalizeStaySourceUrl(normalized) === canonicalSourceUrl;
}

async function findExistingStayBySourceUrl(params: {
  supabase: ReturnType<typeof getServerSupabaseClient>;
  organizerId: string;
  canonicalSourceUrl: string;
  sourceUrlCandidates: Set<string>;
}): Promise<{ stayId: string | null; errorMessage: string | null }> {
  const sourceUrlCandidatesArray = Array.from(params.sourceUrlCandidates);
  const exactLookup = await params.supabase
    .from('stays')
    .select('id,source_url')
    .eq('organizer_id', params.organizerId)
    .in('source_url', sourceUrlCandidatesArray)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (exactLookup.error) {
    if (isMissingColumnError(exactLookup.error, 'source_url')) {
      return { stayId: null, errorMessage: null };
    }
    return {
      stayId: null,
      errorMessage: exactLookup.error.message ?? 'Impossible de vérifier les séjours existants.'
    };
  }

  const exactMatch = (exactLookup.data as ExistingStayRow[] | null)?.[0];
  if (exactMatch?.id) {
    return { stayId: exactMatch.id, errorMessage: null };
  }

  const canonicalLookup = await params.supabase
    .from('stays')
    .select('id,source_url')
    .eq('organizer_id', params.organizerId)
    .not('source_url', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(500);

  if (canonicalLookup.error) {
    if (isMissingColumnError(canonicalLookup.error, 'source_url')) {
      return { stayId: null, errorMessage: null };
    }
    return {
      stayId: null,
      errorMessage: canonicalLookup.error.message ?? 'Impossible de vérifier les séjours existants.'
    };
  }

  const canonicalMatch = (canonicalLookup.data as ExistingStayRow[] | null)?.find((row) =>
    shouldMatchExistingSourceUrl(row.source_url, params.canonicalSourceUrl, params.sourceUrlCandidates)
  );

  if (canonicalMatch?.id) {
    return { stayId: canonicalMatch.id, errorMessage: null };
  }

  return { stayId: null, errorMessage: null };
}

async function readImportInput(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';

  const parseBooleanInput = (value: unknown, fallback = true): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['1', 'true', 'on', 'yes', 'oui'].includes(normalized)) return true;
    if (['0', 'false', 'off', 'no', 'non'].includes(normalized)) return false;
    return fallback;
  };

  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as {
      sourceUrl?: unknown;
      source_url?: unknown;
      organizerId?: unknown;
      organizer_id?: unknown;
      selectedAccommodationId?: unknown;
      selected_accommodation_id?: unknown;
      includePricing?: unknown;
      include_pricing?: unknown;
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
            : '',
      includePricing:
        typeof body.includePricing !== 'undefined'
          ? parseBooleanInput(body.includePricing)
          : typeof body.include_pricing !== 'undefined'
            ? parseBooleanInput(body.include_pricing)
            : true
    };
  }

  const formData = await req.formData();
  return {
    sourceUrl: String(formData.get('sourceUrl') ?? formData.get('source_url') ?? ''),
    organizerId: String(formData.get('organizerId') ?? formData.get('organizer_id') ?? ''),
    selectedAccommodationId: String(
      formData.get('selectedAccommodationId') ?? formData.get('selected_accommodation_id') ?? ''
    ),
    includePricing:
      formData.has('includePricing') || formData.has('include_pricing')
        ? parseBooleanInput(formData.get('includePricing') ?? formData.get('include_pricing'))
        : false
  };
}

export async function POST(req: Request) {
  const {
    sourceUrl: sourceUrlRaw,
    organizerId: organizerIdRaw,
    selectedAccommodationId: selectedAccommodationIdRaw,
    includePricing
  } = await readImportInput(req);
  const sourceUrlInput = sourceUrlRaw.trim();
  const requestedOrganizerId = organizerIdRaw.trim();
  const selectedAccommodationId = selectedAccommodationIdRaw.trim();
  const access = await requireOrganizerApiAccess({
    requestedOrganizerId: requestedOrganizerId || undefined,
    requiredSection: 'stays'
  });

  if (!access.ok) {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    return NextResponse.redirect(new URL('/login', req.url), 303);
  }

  const { selectedOrganizerId } = access.context;

  if (!selectedOrganizerId) {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: 'Aucun organisateur disponible.' }, { status: 400 });
    }
    return redirectToOrganizerStayCreation(req, null, {
      error: 'Aucun organisateur disponible.'
    });
  }

  if (!sourceUrlInput) {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: "L'URL de la fiche séjour est requise." }, { status: 400 });
    }
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: "L'URL de la fiche séjour est requise."
    });
  }

  let canonicalSourceUrl: string;
  try {
    canonicalSourceUrl = canonicalizeStaySourceUrl(sourceUrlInput);
  } catch {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: 'Veuillez saisir une URL valide.' }, { status: 400 });
    }
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: 'Veuillez saisir une URL valide.'
    });
  }
  const sourceUrl = canonicalSourceUrl;
  const sourceUrlCandidates = new Set<string>(
    [sourceUrlInput, canonicalSourceUrl].map((value) => value.trim()).filter(Boolean)
  );

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
      if (requestExpectsJson(req)) {
        return NextResponse.json(
          { error: 'Hébergement introuvable pour cet organisateur.' },
          { status: 400 }
        );
      }
      return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
        error: 'Hébergement introuvable pour cet organisateur.'
      });
    }

    selectedAccommodation = accommodation;
  }

  const initialRawPayload = buildImportRawPayload({
    selectedAccommodation,
    includePricing,
    progressLabel: 'Brouillon créé'
  });

  let supportsCanonicalColumn = true;

  const resolveExistingDraft = async (): Promise<{
    draft: ImportableDraftRow | null;
    errorMessage: string | null;
  }> => {
    const lookupByCanonical = await supabase
      .from('stay_drafts')
      .select('*')
      .eq('organizer_id', selectedOrganizerId)
      .eq('source_url_canonical', canonicalSourceUrl)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (isMissingColumnError(lookupByCanonical.error, 'source_url_canonical')) {
      supportsCanonicalColumn = false;
      const fallbackLookup = await supabase
        .from('stay_drafts')
        .select('*')
        .eq('organizer_id', selectedOrganizerId)
        .order('created_at', { ascending: false })
        .limit(250);

      if (fallbackLookup.error) {
        return {
          draft: null,
          errorMessage: fallbackLookup.error.message ?? 'Impossible de lire les brouillons existants.'
        };
      }

      const matchedDraft = (fallbackLookup.data as ImportableDraftRow[] | null)?.find((row) =>
        shouldMatchExistingSourceUrl(row.source_url, canonicalSourceUrl, sourceUrlCandidates)
      );
      return { draft: matchedDraft ?? null, errorMessage: null };
    }

    if (lookupByCanonical.error) {
      return {
        draft: null,
        errorMessage: lookupByCanonical.error.message ?? 'Impossible de lire les brouillons existants.'
      };
    }

    return {
      draft: (lookupByCanonical.data as ImportableDraftRow | null) ?? null,
      errorMessage: null
    };
  };

  const upsertExistingFailedDraft = async (
    existingDraft: ImportableDraftRow
  ): Promise<{ draft: ImportableDraftRow; importAction: ImportAction; errorMessage: string | null }> => {
    if (!isFailedStatus(existingDraft.status)) {
      return { draft: existingDraft, importAction: 'existing', errorMessage: null };
    }

    const restartRawPayload = buildImportRawPayload({
      existingRawPayload: existingDraft.raw_payload,
      selectedAccommodation,
      includePricing,
      progressLabel: 'Relance du brouillon'
    });
    const { data: restartedDraft, error: restartError } = await supabase
      .from('stay_drafts')
      .update({
        status: 'pending',
        source_url: sourceUrl,
        ...(supportsCanonicalColumn ? { source_url_canonical: canonicalSourceUrl } : {}),
        raw_payload: restartRawPayload as Json
      })
      .eq('id', existingDraft.id)
      .eq('organizer_id', selectedOrganizerId)
      .eq('status', 'failed')
      .select('*')
      .maybeSingle();

    if (restartError) {
      return {
        draft: existingDraft,
        importAction: 'existing',
        errorMessage: restartError.message ?? "Impossible de relancer l'import du brouillon."
      };
    }

    if (restartedDraft) {
      return {
        draft: restartedDraft as ImportableDraftRow,
        importAction: 'restarted',
        errorMessage: null
      };
    }

    return { draft: existingDraft, importAction: 'existing', errorMessage: null };
  };

  const preflightExisting = await resolveExistingDraft();
  if (preflightExisting.errorMessage) {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: preflightExisting.errorMessage }, { status: 500 });
    }
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: preflightExisting.errorMessage
    });
  }

  if (preflightExisting.draft) {
    const existingHandling = await upsertExistingFailedDraft(preflightExisting.draft);
    if (existingHandling.errorMessage) {
      if (requestExpectsJson(req)) {
        return NextResponse.json({ error: existingHandling.errorMessage }, { status: 500 });
      }
      return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
        error: existingHandling.errorMessage
      });
    }

    const shouldLaunchBackgroundImport = existingHandling.importAction === 'restarted';
    if (shouldLaunchBackgroundImport) {
      const draftColumns = new Set(Object.keys(existingHandling.draft));
      after(() => {
        void runStayImportInBackground({
          draftId: existingHandling.draft.id,
          sourceUrl,
          selectedOrganizerId,
          selectedAccommodation,
          includePricing,
          draftColumnKeys: Array.from(draftColumns)
        });
      });
    }

    if (requestExpectsJson(req)) {
      return NextResponse.json({
        success: true,
        draftId: existingHandling.draft.id,
        organizerId: selectedOrganizerId,
        importAction: existingHandling.importAction
      });
    }

    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      prefill: existingHandling.importAction,
      draftId: existingHandling.draft.id
    });
  }

  const existingStayLookup = await findExistingStayBySourceUrl({
    supabase,
    organizerId: selectedOrganizerId,
    canonicalSourceUrl,
    sourceUrlCandidates
  });
  if (existingStayLookup.errorMessage) {
    if (requestExpectsJson(req)) {
      return NextResponse.json({ error: existingStayLookup.errorMessage }, { status: 500 });
    }
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: existingStayLookup.errorMessage
    });
  }

  if (existingStayLookup.stayId) {
    const alreadyExistsMessage =
      "Un séjour existe déjà pour cette URL. Ouvrez le séjour existant depuis la liste pour le modifier.";
    if (requestExpectsJson(req)) {
      return NextResponse.json(
        {
          error: alreadyExistsMessage,
          existingStayId: existingStayLookup.stayId
        },
        { status: 409 }
      );
    }
    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      error: alreadyExistsMessage
    });
  }

  const insertDraftPayload = {
    organizer_id: selectedOrganizerId,
    source_url: sourceUrl,
    status: 'pending',
    raw_payload: initialRawPayload as Json
  };

  const firstInsertAttempt = await supabase
    .from('stay_drafts')
    .insert({
      ...insertDraftPayload,
      source_url_canonical: canonicalSourceUrl
    })
    .select('*')
    .single();
  let insertedDraft = (firstInsertAttempt.data as ImportableDraftRow | null) ?? null;
  let insertError: { code?: string | null; message?: string | null } | null = firstInsertAttempt.error
    ? { code: firstInsertAttempt.error.code, message: firstInsertAttempt.error.message }
    : null;

  if (isMissingColumnError(insertError, 'source_url_canonical')) {
    supportsCanonicalColumn = false;
    const dynamicInsertWithoutCanonical = supabase.from('stay_drafts') as unknown as DynamicStayDraftInsertBuilder;
    const retryWithoutCanonicalColumn = await dynamicInsertWithoutCanonical
      .insert(insertDraftPayload)
      .select('*')
      .single();
    insertedDraft = retryWithoutCanonicalColumn.data;
    insertError = retryWithoutCanonicalColumn.error;
  }

  const targetDraft: ImportableDraftRow | null = (insertedDraft as ImportableDraftRow | null) ?? null;

  if (insertError || !targetDraft) {
    if (!isUniqueCanonicalConflict(insertError)) {
      if (requestExpectsJson(req)) {
        return NextResponse.json(
          { error: insertError?.message ?? 'Impossible de créer le brouillon.' },
          { status: 500 }
        );
      }
      return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
        error: insertError?.message ?? 'Impossible de créer le brouillon.'
      });
    }

    const existingAfterConflict = await resolveExistingDraft();
    if (existingAfterConflict.errorMessage || !existingAfterConflict.draft) {
      if (requestExpectsJson(req)) {
        return NextResponse.json(
          {
            error:
              existingAfterConflict.errorMessage ??
              'Un brouillon existe déjà pour cette source, mais sa récupération a échoué.'
          },
          { status: 500 }
        );
      }
      return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
        error:
          existingAfterConflict.errorMessage ??
          'Un brouillon existe déjà pour cette source, mais sa récupération a échoué.'
      });
    }

    const conflictHandling = await upsertExistingFailedDraft(existingAfterConflict.draft);
    if (conflictHandling.errorMessage) {
      if (requestExpectsJson(req)) {
        return NextResponse.json({ error: conflictHandling.errorMessage }, { status: 500 });
      }
      return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
        error: conflictHandling.errorMessage
      });
    }

    const shouldLaunchBackgroundImport = conflictHandling.importAction === 'restarted';
    if (shouldLaunchBackgroundImport) {
      const draftColumns = new Set(Object.keys(conflictHandling.draft));
      after(() => {
        void runStayImportInBackground({
          draftId: conflictHandling.draft.id,
          sourceUrl,
          selectedOrganizerId,
          selectedAccommodation,
          includePricing,
          draftColumnKeys: Array.from(draftColumns)
        });
      });
    }

    if (requestExpectsJson(req)) {
      return NextResponse.json({
        success: true,
        draftId: conflictHandling.draft.id,
        organizerId: selectedOrganizerId,
        importAction: conflictHandling.importAction
      });
    }

    return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
      prefill: conflictHandling.importAction,
      draftId: conflictHandling.draft.id
    });
  }

  const shouldLaunchBackgroundImport = true;
  if (shouldLaunchBackgroundImport) {
    const draftColumns = new Set(Object.keys(targetDraft));
    after(() => {
      void runStayImportInBackground({
        draftId: targetDraft.id,
        sourceUrl,
        selectedOrganizerId,
        selectedAccommodation,
        includePricing,
        draftColumnKeys: Array.from(draftColumns)
      });
    });
  }

  if (requestExpectsJson(req)) {
    return NextResponse.json({
      success: true,
      draftId: targetDraft.id,
      organizerId: selectedOrganizerId,
      importAction: 'created'
    });
  }

  return redirectToOrganizerStayCreation(req, selectedOrganizerId, {
    prefill: 'created',
    draftId: targetDraft.id
  });
}
