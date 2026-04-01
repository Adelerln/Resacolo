'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeStayDraftCategories, STAY_CATEGORY_OPTIONS } from '@/lib/stay-categories';
import type { StayDraftReviewFieldErrors, StayDraftReviewPayload } from '@/types/stay-draft-review';

type StayDraftReviewFormProps = {
  draftId: string;
  organizerId: string | null;
  backHref: string;
  initialPayload: StayDraftReviewPayload;
  initialStatus: string;
  initialValidatedAt: string | null;
  initialValidatedByUserId: string | null;
};

type JsonFieldName =
  | 'sessions_json'
  | 'extra_options_json'
  | 'transport_options_json'
  | 'accommodations_json'
  | 'images';

function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function StayDraftReviewForm({
  draftId,
  organizerId,
  backHref,
  initialPayload,
  initialStatus,
  initialValidatedAt,
  initialValidatedByUserId
}: StayDraftReviewFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialPayload.title);
  const [summary, setSummary] = useState(initialPayload.summary);
  const [locationText, setLocationText] = useState(initialPayload.location_text);
  const [regionText, setRegionText] = useState(initialPayload.region_text);
  const [description, setDescription] = useState(initialPayload.description);
  const [programText, setProgramText] = useState(initialPayload.program_text);
  const [supervisionText, setSupervisionText] = useState(initialPayload.supervision_text);
  const [transportText, setTransportText] = useState(initialPayload.transport_text);
  const [transportMode, setTransportMode] = useState(initialPayload.transport_mode);
  const [selectedCategories, setSelectedCategories] = useState(() =>
    normalizeStayDraftCategories(initialPayload.categories).categories
  );
  const [agesText, setAgesText] = useState(initialPayload.ages.join(', '));
  const [sessionsJsonText, setSessionsJsonText] = useState(prettyJson(initialPayload.sessions_json));
  const [extraOptionsJsonText, setExtraOptionsJsonText] = useState(prettyJson(initialPayload.extra_options_json));
  const [transportOptionsJsonText, setTransportOptionsJsonText] = useState(
    prettyJson(initialPayload.transport_options_json)
  );
  const [accommodationsJsonText, setAccommodationsJsonText] = useState(
    prettyJson(initialPayload.accommodations_json)
  );
  const [imagesJsonText, setImagesJsonText] = useState(prettyJson(initialPayload.images));
  const [status, setStatus] = useState(initialStatus);
  const [validatedAt, setValidatedAt] = useState(initialValidatedAt);
  const [validatedByUserId, setValidatedByUserId] = useState(initialValidatedByUserId);
  const [fieldErrors, setFieldErrors] = useState<StayDraftReviewFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imagePreviewUrls = useMemo(() => {
    try {
      const parsed = JSON.parse(imagesJsonText);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((url) => url.trim())
        .filter((url) => /^https?:\/\//i.test(url))
        .slice(0, 8);
    } catch {
      return [];
    }
  }, [imagesJsonText]);

  function setFieldError(name: StayDraftReviewFieldErrors[keyof StayDraftReviewFieldErrors], key: keyof StayDraftReviewFieldErrors, next: StayDraftReviewFieldErrors) {
    if (name) next[key] = name;
  }

  function parseJsonField<T>(fieldName: JsonFieldName, raw: string): { value?: T; error?: string } {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (fieldName === 'accommodations_json') {
        return { value: null as T };
      }
      return { value: [] as T };
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (fieldName === 'accommodations_json') {
        if (parsed === null) return { value: null as T };
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          return { error: 'Ce champ doit être un objet JSON ou null.' };
        }
        return { value: parsed as T };
      }

      if (!Array.isArray(parsed)) {
        return { error: 'Ce champ doit être un tableau JSON.' };
      }
      return { value: parsed as T };
    } catch {
      return { error: 'JSON invalide.' };
    }
  }

  function toggleCategory(categoryLabel: string, checked: boolean) {
    setSelectedCategories((current) => {
      if (checked) {
        return normalizeStayDraftCategories([...current, categoryLabel]).categories;
      }
      return current.filter((value) => value !== categoryLabel);
    });
  }

  function buildPayload(): { payload?: StayDraftReviewPayload; errors?: StayDraftReviewFieldErrors } {
    const nextErrors: StayDraftReviewFieldErrors = {};
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      nextErrors.title = 'Le titre est requis.';
    }

    const categories = normalizeStayDraftCategories(selectedCategories).categories;
    const ages = parseCommaSeparatedList(agesText)
      .map((item) => Number(item))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .map((value) => Math.round(value));
    if (agesText.trim().length > 0 && ages.length === 0) {
      nextErrors.ages = 'Les âges doivent être une liste de nombres séparés par des virgules.';
    }

    const sessionsParsed = parseJsonField<Array<Record<string, unknown>>>('sessions_json', sessionsJsonText);
    const extraOptionsParsed = parseJsonField<Array<Record<string, unknown>>>(
      'extra_options_json',
      extraOptionsJsonText
    );
    const transportOptionsParsed = parseJsonField<Array<Record<string, unknown>>>(
      'transport_options_json',
      transportOptionsJsonText
    );
    const accommodationsParsed = parseJsonField<Record<string, unknown> | null>(
      'accommodations_json',
      accommodationsJsonText
    );
    const imagesParsed = parseJsonField<string[]>('images', imagesJsonText);

    setFieldError(sessionsParsed.error, 'sessions_json', nextErrors);
    setFieldError(extraOptionsParsed.error, 'extra_options_json', nextErrors);
    setFieldError(transportOptionsParsed.error, 'transport_options_json', nextErrors);
    setFieldError(accommodationsParsed.error, 'accommodations_json', nextErrors);
    setFieldError(imagesParsed.error, 'images', nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return { errors: nextErrors };
    }

    const payload: StayDraftReviewPayload = {
      title: normalizedTitle,
      summary,
      location_text: locationText,
      region_text: regionText,
      description,
      program_text: programText,
      supervision_text: supervisionText,
      transport_text: transportText,
      transport_mode: transportMode,
      categories,
      ages,
      sessions_json: sessionsParsed.value ?? [],
      extra_options_json: extraOptionsParsed.value ?? [],
      transport_options_json: transportOptionsParsed.value ?? [],
      accommodations_json: accommodationsParsed.value ?? null,
      images: (imagesParsed.value ?? []).filter((image): image is string => typeof image === 'string')
    };

    return { payload };
  }

  async function submit(mode: 'save' | 'validate') {
    const result = buildPayload();
    if (!result.payload) {
      setFieldErrors(result.errors ?? {});
      setGlobalError('Veuillez corriger les champs en erreur.');
      setSuccessMessage(null);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setGlobalError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/stay-drafts/${draftId}`, {
        method: mode === 'validate' ? 'POST' : 'PATCH',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify({
          organizerId,
          ...result.payload
        })
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            draftSaved?: boolean;
            published?: boolean;
            liveStayId?: string | null;
            fieldErrors?: StayDraftReviewFieldErrors;
            draft?: {
              organizer_id?: string | null;
              status?: string;
              validated_at?: string | null;
              validated_by_user_id?: string | null;
            };
          }
        | null;

      if (!response.ok) {
        setFieldErrors(data?.fieldErrors ?? {});
        setGlobalError(data?.error ?? 'Impossible de sauvegarder le brouillon.');
        if (data?.draftSaved) {
          setSuccessMessage('Brouillon enregistré, mais publication live échouée.');
          setStatus(data?.draft?.status ?? status);
          setValidatedAt(data?.draft?.validated_at ?? validatedAt);
          setValidatedByUserId(data?.draft?.validated_by_user_id ?? validatedByUserId);
          router.refresh();
        }
        return;
      }

      setSuccessMessage(
        mode === 'validate'
          ? 'Brouillon validé avec succès.'
          : data?.published
            ? 'Séjour enregistré et publié.'
            : 'Brouillon enregistré avec succès.'
      );
      setStatus(data?.draft?.status ?? status);
      setValidatedAt(data?.draft?.validated_at ?? validatedAt);
      setValidatedByUserId(data?.draft?.validated_by_user_id ?? validatedByUserId);

      if (mode === 'validate') {
        const organizerIdFromResponse =
          typeof data?.draft?.organizer_id === 'string' && data.draft.organizer_id.trim().length > 0
            ? data.draft.organizer_id
            : null;
        const targetOrganizerId =
          organizerIdFromResponse ??
          (typeof organizerId === 'string' && organizerId.trim().length > 0 ? organizerId : null);

        if (!targetOrganizerId) {
          console.error('[stay-drafts/review] redirection impossible: organizerId absent', {
            draftId
          });
          setGlobalError(
            'Validation réussie, mais redirection impossible: organizerId manquant.'
          );
          return;
        }

        router.push(`/organisme/sejours?organizerId=${encodeURIComponent(targetOrganizerId)}`);
        return;
      }

      router.refresh();
    } catch {
      setGlobalError("Une erreur réseau est survenue pendant l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-500">Statut :</span>
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {status}
          </span>
          {validatedAt && (
            <span className="text-xs text-slate-500">
              Validé le {new Date(validatedAt).toLocaleString('fr-FR')}
            </span>
          )}
          {validatedByUserId && (
            <span className="text-xs text-slate-500">par {validatedByUserId}</span>
          )}
        </div>
      </div>

      {globalError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {globalError}
        </div>
      )}
      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <label className="block text-sm font-medium text-slate-700">
          Titre
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          {fieldErrors.title && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.title}</span>}
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Lieu
            <input
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Région
            <input
              value={regionText}
              onChange={(event) => setRegionText(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Mode de transport
          <input
            value={transportMode}
            onChange={(event) => setTransportMode(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Résumé
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={5}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={6}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Programme
          <textarea
            value={programText}
            onChange={(event) => setProgramText(event.target.value)}
            rows={6}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Encadrement
          <textarea
            value={supervisionText}
            onChange={(event) => setSupervisionText(event.target.value)}
            rows={5}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Transport
          <textarea
            value={transportText}
            onChange={(event) => setTransportText(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="block text-sm font-medium text-slate-700">
            <span>Catégories (multi-sélection)</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {STAY_CATEGORY_OPTIONS.map((category) => {
                const checked = selectedCategories.includes(category.label);
                return (
                  <label
                    key={category.value}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleCategory(category.label, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>{category.label}</span>
                  </label>
                );
              })}
            </div>
            {fieldErrors.categories && (
              <span className="mt-1 block text-xs text-rose-600">{fieldErrors.categories}</span>
            )}
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Âges (séparés par des virgules)
            <input
              value={agesText}
              onChange={(event) => setAgesText(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {fieldErrors.ages && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.ages}</span>}
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Sessions (JSON)
          <textarea
            value={sessionsJsonText}
            onChange={(event) => setSessionsJsonText(event.target.value)}
            rows={10}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
          {fieldErrors.sessions_json && (
            <span className="mt-1 block text-xs text-rose-600">{fieldErrors.sessions_json}</span>
          )}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Options extras (JSON)
          <textarea
            value={extraOptionsJsonText}
            onChange={(event) => setExtraOptionsJsonText(event.target.value)}
            rows={8}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
          {fieldErrors.extra_options_json && (
            <span className="mt-1 block text-xs text-rose-600">{fieldErrors.extra_options_json}</span>
          )}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Options transport (JSON)
          <textarea
            value={transportOptionsJsonText}
            onChange={(event) => setTransportOptionsJsonText(event.target.value)}
            rows={8}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
          {fieldErrors.transport_options_json && (
            <span className="mt-1 block text-xs text-rose-600">{fieldErrors.transport_options_json}</span>
          )}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Hébergement (JSON)
          <textarea
            value={accommodationsJsonText}
            onChange={(event) => setAccommodationsJsonText(event.target.value)}
            rows={8}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
          {fieldErrors.accommodations_json && (
            <span className="mt-1 block text-xs text-rose-600">{fieldErrors.accommodations_json}</span>
          )}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Images (JSON)
          <textarea
            value={imagesJsonText}
            onChange={(event) => setImagesJsonText(event.target.value)}
            rows={8}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
          {fieldErrors.images && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.images}</span>}
        </label>

        {imagePreviewUrls.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Aperçu des images</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {imagePreviewUrls.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt="Aperçu"
                  className="h-28 w-full rounded-lg border border-slate-200 object-cover"
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => submit('save')}
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => submit('validate')}
            disabled={isSubmitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Valider le draft
          </button>
          <Link
            href={backHref}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Annuler
          </Link>
        </div>
      </div>
    </div>
  );
}
