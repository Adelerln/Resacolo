import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { resolveOrganizerSelection } from '@/lib/organizers.server';
import { mockOrganizerTenant } from '@/lib/mocks';
import { publishStayDraftToLive, PublishStayDraftError } from '@/lib/publish-stay-draft';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';
import type { StayDraftReviewFieldErrors, StayDraftReviewPayload } from '@/types/stay-draft-review';

export const runtime = 'nodejs';

const textFieldSchema = z.string().optional().default('');
const arrayOfObjectsSchema = z.array(z.record(z.unknown())).optional().default([]);

const bodySchema = z.object({
  organizerId: z.string().optional(),
  title: z.string().trim().min(1, 'Le titre est requis.'),
  summary: textFieldSchema,
  location_text: textFieldSchema,
  region_text: textFieldSchema,
  description: textFieldSchema,
  program_text: textFieldSchema,
  supervision_text: textFieldSchema,
  transport_text: textFieldSchema,
  transport_mode: textFieldSchema,
  categories: z.array(z.string()).optional().default([]),
  ages: z.array(z.number().int().nonnegative()).optional().default([]),
  sessions_json: z
    .array(z.record(z.unknown()))
    .optional()
    .default([]),
  extra_options_json: arrayOfObjectsSchema,
  transport_options_json: arrayOfObjectsSchema,
  accommodations_json: z.record(z.unknown()).nullable().optional().default(null),
  images: z.array(z.string()).optional().default([])
});

type StayDraftRow = Database['public']['Tables']['stay_drafts']['Row'];

const REVIEW_DRAFT_SELECT = '*';

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeString(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim();
}

function toNullableString(value: string | null | undefined): string | null {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeCategories(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function normalizeAges(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value >= 0))).sort((a, b) => a - b);
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

function normalizeStatus(value: string | null | undefined): string {
  return normalizeString(value).toLowerCase();
}

async function updateDraftPublicationMetadata(input: {
  supabase: ReturnType<typeof getServerSupabaseClient>;
  draftId: string;
  organizerId: string;
  rawPayload: Record<string, unknown>;
  publishedAt: string | null;
  publishError: string | null;
}): Promise<StayDraftRow> {
  const now = new Date().toISOString();
  const attempts: Record<string, unknown>[] = [
    {
      raw_payload: input.rawPayload,
      published_at: input.publishedAt,
      publish_error: input.publishError,
      updated_at: now
    },
    {
      raw_payload: input.rawPayload,
      updated_at: now
    }
  ];

  let lastError: { message?: string } | null = null;

  for (const attempt of attempts) {
    const { data, error } = await (input.supabase.from('stay_drafts') as unknown as {
      update: (payload: Record<string, unknown>) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            select: (columns: string) => {
              maybeSingle: () => Promise<{ data: StayDraftRow | null; error: { message?: string } | null }>;
            };
          };
        };
      };
    })
      .update(attempt)
      .eq('id', input.draftId)
      .eq('organizer_id', input.organizerId)
      .select(REVIEW_DRAFT_SELECT)
      .maybeSingle();

    if (!error && data) {
      return data;
    }

    lastError = error;
  }

  throw new PublishStayDraftError(
    'persist-publication-meta',
    lastError?.message ?? 'Impossible de persister les métadonnées de publication.'
  );
}

function getFieldErrorsFromZod(error: z.ZodError): StayDraftReviewFieldErrors {
  const fieldErrors: StayDraftReviewFieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path[0];
    if (typeof path === 'string' && !(path in fieldErrors)) {
      fieldErrors[path as keyof StayDraftReviewFieldErrors] = issue.message;
    }
  }
  return fieldErrors;
}

async function parseBody(req: Request): Promise<{ payload: StayDraftReviewPayload; organizerId?: string } | {
  errors: StayDraftReviewFieldErrors;
}> {
  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return { errors: getFieldErrorsFromZod(parsed.error) };
  }

  const data = parsed.data;
  const categories = normalizeCategories(data.categories);
  const ages = normalizeAges(data.ages);
  const payload: StayDraftReviewPayload = {
    title: normalizeString(data.title),
    summary: normalizeString(data.summary),
    location_text: normalizeString(data.location_text),
    region_text: normalizeString(data.region_text),
    description: normalizeString(data.description),
    program_text: normalizeString(data.program_text),
    supervision_text: normalizeString(data.supervision_text),
    transport_text: normalizeString(data.transport_text),
    transport_mode: normalizeString(data.transport_mode),
    categories,
    ages,
    sessions_json: data.sessions_json,
    extra_options_json: data.extra_options_json,
    transport_options_json: data.transport_options_json,
    accommodations_json: data.accommodations_json,
    images: data.images.map((image) => normalizeString(image)).filter(Boolean)
  };

  if (!payload.title) {
    return { errors: { title: 'Le titre est requis.' } };
  }
  return {
    payload,
    organizerId: normalizeString(data.organizerId) || undefined
  };
}

async function handleUpdate(req: Request, params: { id: string }, mode: 'save' | 'validate') {
  const isMockMode = process.env.MOCK_UI === '1' || process.env.DISABLE_AUTH === '1';
  const session = getSession();

  if (!isMockMode && (!session || session.role !== 'ORGANISATEUR')) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const parsedBody = await parseBody(req);
  if ('errors' in parsedBody) {
    return NextResponse.json(
      { error: 'Veuillez corriger les champs en erreur.', fieldErrors: parsedBody.errors },
      { status: 400 }
    );
  }

  const fallbackOrganizerId = isMockMode ? mockOrganizerTenant.id : session?.tenantId ?? null;
  const { selectedOrganizerId } = await resolveOrganizerSelection(
    parsedBody.organizerId,
    fallbackOrganizerId
  );

  if (!selectedOrganizerId) {
    return NextResponse.json({ error: 'Aucun organisateur disponible.' }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  const now = new Date().toISOString();
  const ages = normalizeAges(parsedBody.payload.ages);
  const categories = normalizeCategories(parsedBody.payload.categories);
  const validatedByUserId = isUuid(session?.userId) ? session?.userId : null;

  const updatePayload: Record<string, unknown> = {
    title: parsedBody.payload.title,
    summary: toNullableString(parsedBody.payload.summary),
    location_text: toNullableString(parsedBody.payload.location_text),
    region_text: toNullableString(parsedBody.payload.region_text),
    description: toNullableString(parsedBody.payload.description),
    program_text: toNullableString(parsedBody.payload.program_text),
    supervision_text: toNullableString(parsedBody.payload.supervision_text),
    transport_text: toNullableString(parsedBody.payload.transport_text),
    transport_mode: toNullableString(parsedBody.payload.transport_mode),
    categories: categories.length > 0 ? categories : null,
    ages: ages.length > 0 ? ages : null,
    age_min: ages.length > 0 ? ages[0] : null,
    age_max: ages.length > 0 ? ages[ages.length - 1] : null,
    sessions_json: parsedBody.payload.sessions_json,
    extra_options_json: parsedBody.payload.extra_options_json,
    transport_options_json: parsedBody.payload.transport_options_json,
    accommodations_json: parsedBody.payload.accommodations_json,
    images: parsedBody.payload.images.length > 0 ? parsedBody.payload.images : null,
    updated_at: now
  };

  if (mode === 'validate') {
    updatePayload.status = 'validated';
    updatePayload.validated_at = now;
    updatePayload.validated_by_user_id = validatedByUserId;
  }

  const { data: updatedDraft, error } = await supabase
    .from('stay_drafts')
    .update(updatePayload)
    .eq('id', params.id)
    .eq('organizer_id', selectedOrganizerId)
    .select(REVIEW_DRAFT_SELECT)
    .maybeSingle();

  if (error || !updatedDraft) {
    return NextResponse.json(
      { error: error?.message ?? 'Impossible de mettre à jour le brouillon.' },
      { status: 500 }
    );
  }

  console.info('[stay-drafts/review] draft enregistré', {
    draftId: updatedDraft.id,
    organizerId: selectedOrganizerId,
    mode,
    status: updatedDraft.status,
    validatedAt: updatedDraft.validated_at
  });

  const { data: freshDraft, error: freshDraftError } = await supabase
    .from('stay_drafts')
    .select(REVIEW_DRAFT_SELECT)
    .eq('id', params.id)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (freshDraftError || !freshDraft) {
    return NextResponse.json(
      { error: freshDraftError?.message ?? 'Impossible de relire le brouillon après sauvegarde.' },
      { status: 500 }
    );
  }

  let responseDraft = freshDraft as StayDraftRow;
  let published = false;
  let liveStayId: string | null = null;
  let publicationMeta:
    | {
        stay_id: string;
        published_at: string;
        synced_tables: string[];
      }
    | null = null;

  const shouldAttemptPublish =
    normalizeStatus(freshDraft.status) === 'validated' || Boolean(freshDraft.validated_at);

  console.info('[stay-drafts/review] décision publication', {
    draftId: freshDraft.id,
    mode,
    status: freshDraft.status,
    validatedAt: freshDraft.validated_at,
    shouldAttemptPublish
  });

  if (shouldAttemptPublish) {
    console.info('[stay-drafts/review] publication live déclenchée', {
      draftId: freshDraft.id,
      organizerId: selectedOrganizerId
    });

    try {
      console.info('[stay-drafts/review] étape publication: appel service', {
        draftId: freshDraft.id
      });
      const publishResult = await publishStayDraftToLive({
        supabase,
        draft: freshDraft as StayDraftRow
      });

      console.info('[stay-drafts/review] étape publication: persistance métadonnées', {
        draftId: freshDraft.id,
        stayId: publishResult.stayId,
        publishedAt: publishResult.publishedAt,
        syncedTables: publishResult.syncedTables
      });

      const persistedDraft = await updateDraftPublicationMetadata({
        supabase,
        draftId: params.id,
        organizerId: selectedOrganizerId,
        rawPayload: publishResult.rawPayload,
        publishedAt: publishResult.publishedAt,
        publishError: null
      });

      responseDraft = persistedDraft as StayDraftRow;
      published = true;
      liveStayId = publishResult.stayId;
      publicationMeta = {
        stay_id: publishResult.stayId,
        published_at: publishResult.publishedAt,
        synced_tables: publishResult.syncedTables
      };

      console.info('[stay-drafts/review] publication live réussie', {
        draftId: params.id,
        stayId: publishResult.stayId,
        publishedAt: publishResult.publishedAt,
        syncedTables: publishResult.syncedTables
      });
    } catch (publishError) {
      const step =
        publishError instanceof PublishStayDraftError ? publishError.step : 'publish-live';
      const message =
        publishError instanceof Error
          ? publishError.message
          : 'Erreur inconnue pendant la publication live.';

      console.error('[stay-drafts/review] publication live échouée', {
        draftId: params.id,
        organizerId: selectedOrganizerId,
        step,
        message
      });

      const currentRawPayload = asObject(freshDraft.raw_payload);
      const failedRawPayload = {
        ...currentRawPayload,
        publish_error: `${step}: ${message}`,
        publish_failed_at: new Date().toISOString()
      };

      let failedPersistedDraft: StayDraftRow | null = null;
      try {
        failedPersistedDraft = await updateDraftPublicationMetadata({
          supabase,
          draftId: params.id,
          organizerId: selectedOrganizerId,
          rawPayload: failedRawPayload,
          publishedAt: null,
          publishError: `${step}: ${message}`
        });
      } catch (persistError) {
        console.error('[stay-drafts/review] échec persistance publish_error', {
          draftId: params.id,
          organizerId: selectedOrganizerId,
          error: persistError instanceof Error ? persistError.message : 'unknown'
        });
      }

      return NextResponse.json(
        {
          error: `Brouillon enregistré, mais publication live échouée (${step}) : ${message}`,
          draftSaved: true,
          mode,
          published: false,
          publication: null,
          draft: failedPersistedDraft ?? freshDraft
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    mode,
    published,
    liveStayId,
    publication: publicationMeta,
    draft: responseDraft
  });
}

export async function PATCH(
  req: Request,
  context: { params: { id: string } }
) {
  return handleUpdate(req, context.params, 'save');
}

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  return handleUpdate(req, context.params, 'validate');
}
