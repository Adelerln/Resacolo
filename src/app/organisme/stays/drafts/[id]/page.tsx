import Link from 'next/link';
import { redirect } from 'next/navigation';
import StayDraftReviewForm from '@/components/organisme/StayDraftReviewForm';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { normalizeStayDraftCategories } from '@/lib/stay-categories';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/supabase';
import type { StayDraftReviewPayload } from '@/types/stay-draft-review';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: {
    organizerId?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LinkedAccommodationSummary = {
  id: string;
  name: string;
  accommodationType: string | null;
};

function normalizeString(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value: Json | null): Record<string, unknown> {
  if (isPlainRecord(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (isPlainRecord(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function asArrayOfObjects(value: Json | null): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((item) => isPlainRecord(item));
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => isPlainRecord(item));
      }
    } catch {
      return [];
    }
  }

  return [];
}

function asStringArray(value: Json | null): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return [];
}

function readExistingAccommodationId(rawPayload: Record<string, unknown>): string | null {
  const importOptions = rawPayload.import_options;
  if (!isPlainRecord(importOptions)) return null;
  const selectedId = importOptions.existing_accommodation_id;
  return typeof selectedId === 'string' && selectedId.trim().length > 0 ? selectedId.trim() : null;
}

function draftStatusBadgeClass(status: string | null): string {
  switch ((status ?? '').toLowerCase()) {
    case 'validated':
      return 'bg-emerald-100 text-emerald-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default async function StayDraftReviewPage({ params: paramsPromise, searchParams }: PageProps) {
  const params = await paramsPromise;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const { data: draft } = await supabase
    .from('stay_drafts')
    .select('*')
    .eq('id', params.id)
    .eq('organizer_id', selectedOrganizerId)
    .maybeSingle();

  if (!draft) {
    redirect(withOrganizerQuery('/organisme/sejours', selectedOrganizerId));
  }

  const rawPayload = asObject(draft.raw_payload);
  const aiExtracted = rawPayload.ai_extracted ?? null;
  const aiModel = typeof rawPayload.ai_model === 'string' ? rawPayload.ai_model : null;
  const aiPromptVersion =
    typeof rawPayload.ai_prompt_version === 'string' ? rawPayload.ai_prompt_version : null;
  const aiEnrichedAt =
    typeof rawPayload.ai_enriched_at === 'string' ? rawPayload.ai_enriched_at : null;
  const accommodationsObject = asObject(draft.accommodations_json);
  const linkedAccommodationId = readExistingAccommodationId(rawPayload);
  const linkedAccommodation =
    linkedAccommodationId
      ? (
          await supabase
            .from('accommodations')
            .select('id,name,accommodation_type')
            .eq('id', linkedAccommodationId)
            .eq('organizer_id', selectedOrganizerId)
            .maybeSingle()
        ).data ?? null
      : null;

  const initialPayload: StayDraftReviewPayload = {
    title: normalizeString(draft.title),
    summary: normalizeString(draft.summary),
    location_text: normalizeString(draft.location_text),
    region_text: normalizeString(draft.region_text),
    description: normalizeString(draft.description),
    program_text: normalizeString(draft.program_text),
    supervision_text: normalizeString(draft.supervision_text),
    transport_text: normalizeString(draft.transport_text),
    transport_mode: normalizeString(draft.transport_mode),
    categories: normalizeStayDraftCategories(draft.categories ?? []).categories,
    ages: draft.ages ?? [],
    sessions_json: asArrayOfObjects(draft.sessions_json),
    extra_options_json: asArrayOfObjects(draft.extra_options_json),
    transport_options_json: asArrayOfObjects(draft.transport_options_json),
    accommodations_json:
      !linkedAccommodation && Object.keys(accommodationsObject).length > 0
        ? accommodationsObject
        : null,
    images: asStringArray(draft.images)
  };

  const backHref = withOrganizerQuery('/organisme/sejours', selectedOrganizerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Relecture du brouillon séjour</h1>
          <p className="text-sm text-slate-600">
            {selectedOrganizer
              ? `Relecture et validation manuelle pour ${selectedOrganizer.name}.`
              : 'Relecture et validation manuelle du brouillon.'}
          </p>
        </div>
        <Link
          href={backHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Retour à la liste
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <p>
            <span className="font-medium text-slate-700">ID :</span>{' '}
            <span className="font-mono text-slate-900">{draft.id}</span>
          </p>
          <p>
            <span className="font-medium text-slate-700">Source URL :</span>{' '}
            <a
              href={draft.source_url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-emerald-700 underline"
            >
              {draft.source_url}
            </a>
          </p>
          <p>
            <span className="font-medium text-slate-700">Statut :</span>{' '}
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ${draftStatusBadgeClass(draft.status)}`}>
              {draft.status}
            </span>
          </p>
          <p>
            <span className="font-medium text-slate-700">Créé le :</span>{' '}
            {new Date(draft.created_at).toLocaleString('fr-FR')}
          </p>
          <p>
            <span className="font-medium text-slate-700">Mis à jour le :</span>{' '}
            {new Date(draft.updated_at).toLocaleString('fr-FR')}
          </p>
          <p>
            <span className="font-medium text-slate-700">Validé le :</span>{' '}
            {draft.validated_at ? new Date(draft.validated_at).toLocaleString('fr-FR') : '—'}
          </p>
          <p>
            <span className="font-medium text-slate-700">Validé par :</span>{' '}
            {draft.validated_by_user_id ?? '—'}
          </p>
          <p>
            <span className="font-medium text-slate-700">Modèle IA :</span> {aiModel ?? '—'}
          </p>
          <p>
            <span className="font-medium text-slate-700">Version du prompt IA :</span>{' '}
            {aiPromptVersion ?? '—'}
          </p>
          <p>
            <span className="font-medium text-slate-700">Enrichi par IA le :</span>{' '}
            {aiEnrichedAt ? new Date(aiEnrichedAt).toLocaleString('fr-FR') : '—'}
          </p>
        </div>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Debug IA (`raw_payload.ai_extracted`)
        </summary>
        <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify(aiExtracted, null, 2)}
        </pre>
      </details>

      <StayDraftReviewForm
        draftId={draft.id}
        organizerId={draft.organizer_id}
        backHref={backHref}
        initialPayload={initialPayload}
        initialStatus={draft.status}
        initialValidatedAt={draft.validated_at}
        initialValidatedByUserId={draft.validated_by_user_id}
        linkedAccommodation={
          linkedAccommodation
            ? ({
                id: linkedAccommodation.id,
                name: linkedAccommodation.name,
                accommodationType: linkedAccommodation.accommodation_type
              } satisfies LinkedAccommodationSummary)
            : null
        }
      />
    </div>
  );
}
