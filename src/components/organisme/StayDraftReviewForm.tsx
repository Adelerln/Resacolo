'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import GoogleMapsCityInput from '@/components/common/GoogleMapsCityInput';
import AccommodationImportReviewFields from '@/components/organisme/AccommodationImportReviewFields';
import {
  DraftExtraOptionsEditor,
  DraftSessionsEditor,
  DraftTransportOptionsEditor
} from '@/components/organisme/StayDraftStructuredLists';
import { formatAccommodationType } from '@/lib/accommodation-types';
import {
  MAX_STAY_SUMMARY_LENGTH,
  STAY_TRANSPORT_LOGISTICS_MODES
} from '@/lib/stay-draft-content';
import {
  defaultAccommodationImportRecord,
  mergeAccommodationImportRecord
} from '@/lib/stay-draft-accommodation-import';
import { normalizeStayDraftCategories, STAY_CATEGORY_OPTIONS } from '@/lib/stay-categories';
import { normalizeImportedImageUrlList, normalizeImportedVideoUrlList } from '@/lib/stay-draft-url-extract';
import type { StayDraftReviewFieldErrors, StayDraftReviewPayload } from '@/types/stay-draft-review';

type StayDraftReviewFormProps = {
  draftId: string;
  organizerId: string | null;
  backHref: string;
  initialPayload: StayDraftReviewPayload;
  initialStatus: string;
  initialValidatedAt: string | null;
  initialValidatedByUserId: string | null;
  linkedAccommodation?: {
    id: string;
    name: string;
    accommodationType: string | null;
  } | null;
};

function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function getAccommodationField(
  source: Record<string, unknown> | null,
  ...keys: string[]
): string {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
}

export default function StayDraftReviewForm({
  draftId,
  organizerId,
  backHref,
  initialPayload,
  initialStatus,
  initialValidatedAt,
  initialValidatedByUserId,
  linkedAccommodation = null
}: StayDraftReviewFormProps) {
  const router = useRouter();
  const [reviewStep, setReviewStep] = useState<'hebergement' | 'sejour'>(() =>
    linkedAccommodation ? 'sejour' : 'hebergement'
  );
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
  const [sessionsList, setSessionsList] = useState<Array<Record<string, unknown>>>(() =>
    Array.isArray(initialPayload.sessions_json)
      ? initialPayload.sessions_json.map((row) => ({ ...row }))
      : []
  );
  const [extraOptionsList, setExtraOptionsList] = useState<Array<Record<string, unknown>>>(() =>
    Array.isArray(initialPayload.extra_options_json)
      ? initialPayload.extra_options_json.map((row) => ({ ...row }))
      : []
  );
  const [transportOptionsList, setTransportOptionsList] = useState<Array<Record<string, unknown>>>(() =>
    Array.isArray(initialPayload.transport_options_json)
      ? initialPayload.transport_options_json.map((row) => ({ ...row }))
      : []
  );
  const [accommodationImport, setAccommodationImport] = useState<Record<string, unknown>>(() =>
    mergeAccommodationImportRecord(
      defaultAccommodationImportRecord(),
      initialPayload.accommodations_json ?? {}
    )
  );
  const [imageUrls, setImageUrls] = useState<string[]>(() =>
    normalizeImportedImageUrlList(initialPayload.images)
  );
  const [videoUrls, setVideoUrls] = useState<string[]>(() =>
    normalizeImportedVideoUrlList(initialPayload.video_urls)
  const [accommodationTitle, setAccommodationTitle] = useState(() =>
    getAccommodationField(initialPayload.accommodations_json, 'title', 'name')
  );
  const [accommodationType, setAccommodationType] = useState(() =>
    getAccommodationField(initialPayload.accommodations_json, 'accommodation_type')
  );
  const [accommodationDescription, setAccommodationDescription] = useState(() =>
    getAccommodationField(initialPayload.accommodations_json, 'description')
  );
  const [accommodationBedInfo, setAccommodationBedInfo] = useState(() =>
    getAccommodationField(initialPayload.accommodations_json, 'bed_info', 'sleeping_info')
  );
  const [accommodationBathroomInfo, setAccommodationBathroomInfo] = useState(() =>
    getAccommodationField(initialPayload.accommodations_json, 'bathroom_info', 'sanitary_info')
  );
  const [accommodationCateringInfo, setAccommodationCateringInfo] = useState(() =>
    getAccommodationField(initialPayload.accommodations_json, 'catering_info', 'food_info')
  );
  const [accommodationAccessibilityInfo, setAccommodationAccessibilityInfo] = useState(() =>
    getAccommodationField(initialPayload.accommodations_json, 'accessibility_info', 'pmr_info')
  );
  const [status, setStatus] = useState(initialStatus);
  const [validatedAt, setValidatedAt] = useState(initialValidatedAt);
  const [validatedByUserId, setValidatedByUserId] = useState(initialValidatedByUserId);
  const [fieldErrors, setFieldErrors] = useState<StayDraftReviewFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imagePreviewUrls = useMemo(
    () => imageUrls.filter((url) => /^https?:\/\//i.test(url)).slice(0, 24),
    [imageUrls]
  );


  function addImageFromPrompt() {
    const raw = window.prompt("Collez l'URL complète de l'image (https://…)");
    if (!raw) return;
    const url = raw.trim();
    if (!/^https?:\/\//i.test(url)) {
      window.alert('L’URL doit commencer par http:// ou https://');
      return;
    }
    setImageUrls((current) => (current.includes(url) ? current : [...current, url]));
  }

  function removeImageAt(index: number) {
    setImageUrls((current) => {
      const removed = current[index];
      if (removed) {
        setLightboxUrl((open) => (open === removed ? null : open));
      }
      return current.filter((_, i) => i !== index);
    });
  }

  function addVideoFromPrompt() {
    const raw = window.prompt("Collez l’URL de la vidéo (https://…) ou un extrait contenant le lien");
    if (!raw) return;
    const extracted = normalizeImportedVideoUrlList([raw.trim()]);
    if (extracted.length === 0) {
      window.alert('Aucun lien YouTube / Vimeo / fichier vidéo reconnu.');
      return;
    }
    setVideoUrls((current) => {
      const next = [...current];
      for (const url of extracted) {
        if (!next.includes(url)) next.push(url);
      }
      return next;
    });
  }

  function removeVideoAt(index: number) {
    setVideoUrls((current) => current.filter((_, i) => i !== index));
  }

  function setFieldError(name: StayDraftReviewFieldErrors[keyof StayDraftReviewFieldErrors], key: keyof StayDraftReviewFieldErrors, next: StayDraftReviewFieldErrors) {
    if (name) next[key] = name;
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

    const sessionsPayload = sessionsList.filter(
      (row) =>
        String(row.label ?? '').trim().length > 0 ||
        String(row.start_date ?? '').trim().length > 0 ||
        String(row.end_date ?? '').trim().length > 0
    );
    const extraOptionsPayload = extraOptionsList.filter(
      (row) => String(row.label ?? '').trim().length > 0
    );
    const transportOptionsPayload = transportOptionsList.filter(
      (row) => String(row.label ?? '').trim().length > 0
    );
    const normalizedAccommodation = linkedAccommodation
      ? null
      : (() => {
          const payload = {
            title: accommodationTitle.trim(),
            accommodation_type: accommodationType.trim(),
            description: accommodationDescription.trim(),
            bed_info: accommodationBedInfo.trim(),
            bathroom_info: accommodationBathroomInfo.trim(),
            catering_info: accommodationCateringInfo.trim(),
            accessibility_info: accommodationAccessibilityInfo.trim()
          };

          const hasContent = Object.values(payload).some((value) => value.length > 0);
          return hasContent ? payload : null;
        })();
    const imagesParsed = parseJsonField<string[]>('images', imagesJsonText);

    setFieldError(sessionsParsed.error, 'sessions_json', nextErrors);
    setFieldError(extraOptionsParsed.error, 'extra_options_json', nextErrors);
    setFieldError(transportOptionsParsed.error, 'transport_options_json', nextErrors);
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
      accommodations_json: normalizedAccommodation,
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

  const showStayStep = Boolean(linkedAccommodation) || reviewStep === 'sejour';

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

      {!linkedAccommodation && reviewStep === 'hebergement' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">Étape 1 sur 2</span> — contrôlez d&apos;abord l&apos;hébergement importé,
          puis passez à la relecture du séjour. Rien n&apos;est envoyé au serveur tant que vous n&apos;avez pas
          enregistré depuis l&apos;étape « séjour ».
        </div>
      )}

      {!linkedAccommodation && reviewStep === 'hebergement' && (
        <div className="space-y-4">
          <AccommodationImportReviewFields
            value={accommodationImport}
            onChange={setAccommodationImport}
            fieldError={fieldErrors.accommodations_json}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFieldErrors({});
                setGlobalError(null);
                setReviewStep('sejour');
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Continuer vers la relecture du séjour
            </button>
            <Link
              href={backHref}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Annuler
            </Link>
          </div>
        </div>
      )}

      {linkedAccommodation && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
          <p className="font-semibold">Hébergement déjà sélectionné avant import</p>
          <p className="mt-1">
            Le séjour sera rattaché à <span className="font-semibold">{linkedAccommodation.name}</span>
            {linkedAccommodation.accommodationType
              ? ` (${formatAccommodationType(linkedAccommodation.accommodationType)})`
              : ''}.
          </p>
          <p className="mt-1 text-sky-800">
            L&apos;IA n&apos;extrait pas de nouvel hébergement pour ce brouillon.
          </p>
        </div>
      )}

      {!linkedAccommodation && (
        <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Hébergement</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Review de l&apos;hébergement importé</h2>
            <p className="mt-1 text-sm text-slate-600">
              Validez ou corrigez ici les informations récupérées pour l&apos;hébergement avant la publication live.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Nom de l&apos;hébergement
              <input
                value={accommodationTitle}
                onChange={(event) => setAccommodationTitle(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Type d&apos;hébergement
              <input
                value={accommodationType}
                onChange={(event) => setAccommodationType(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea
              value={accommodationDescription}
              onChange={(event) => setAccommodationDescription(event.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Couchage
              <textarea
                value={accommodationBedInfo}
                onChange={(event) => setAccommodationBedInfo(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Sanitaires
              <textarea
                value={accommodationBathroomInfo}
                onChange={(event) => setAccommodationBathroomInfo(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Restauration
              <textarea
                value={accommodationCateringInfo}
                onChange={(event) => setAccommodationCateringInfo(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Accessibilité / PMR
              <textarea
                value={accommodationAccessibilityInfo}
                onChange={(event) => setAccommodationAccessibilityInfo(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>

          {fieldErrors.accommodations_json && (
            <p className="text-sm text-rose-600">{fieldErrors.accommodations_json}</p>
          )}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        {!linkedAccommodation && (
          <button
            type="button"
            onClick={() => setReviewStep('hebergement')}
            className="text-sm font-semibold text-orange-700 underline-offset-2 hover:underline"
          >
            ← Retour à la relecture de l&apos;hébergement
          </button>
        )}

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {linkedAccommodation ? 'Relecture du séjour' : 'Étape 2 sur 2 — séjour'}
        </p>

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
          <GoogleMapsCityInput
            key={draftId}
            name="location_text"
            label="Lieu"
            value={locationText}
            onValueChange={setLocationText}
            showApiHint
          />
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
          Acheminement aller / retour
          <select
            value={transportMode}
            onChange={(event) => setTransportMode(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            <option value="">À préciser</option>
            {STAY_TRANSPORT_LOGISTICS_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Résumé
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Phrase d&apos;accroche, {MAX_STAY_SUMMARY_LENGTH} caractères max.
            {' '}
            {summary.trim().length}/{MAX_STAY_SUMMARY_LENGTH}
          </span>
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
          <span className="mt-1 block text-xs text-slate-500">
            Préciser en phrases si le trajet se fait en train, en train puis en car, en car, en avion ou sur place.
          </span>
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

        <DraftSessionsEditor
          value={sessionsList}
          onChange={setSessionsList}
          error={fieldErrors.sessions_json}
        />

        <DraftExtraOptionsEditor
          value={extraOptionsList}
          onChange={setExtraOptionsList}
          error={fieldErrors.extra_options_json}
        />

        <DraftTransportOptionsEditor
          value={transportOptionsList}
          onChange={setTransportOptionsList}
          error={fieldErrors.transport_options_json}
        />

        <div className="relative space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 pr-14">
          <button
            type="button"
            onClick={addImageFromPrompt}
            className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold leading-none text-slate-800 shadow-sm hover:bg-slate-50"
            aria-label="Ajouter une image par URL"
          >
            +
          </button>
          <p className="text-sm font-medium text-slate-700">Images du séjour</p>
          <p className="text-xs text-slate-500">Cliquez sur une vignette pour l&apos;agrandir. Ajoutez une URL avec le bouton +.</p>
          {imagePreviewUrls.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune image — utilisez le bouton + pour coller une URL https.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {imagePreviewUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="relative">
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(url)}
                    className="block w-full overflow-hidden rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <img src={url} alt="" className="h-28 w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImageAt(index)}
                    className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/75"
                    aria-label="Retirer cette image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
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

        <div className="relative space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 pr-14">
          <button
            type="button"
            onClick={addVideoFromPrompt}
            className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold leading-none text-slate-800 shadow-sm hover:bg-slate-50"
            aria-label="Ajouter une vidéo par URL"
          >
            +
          </button>
          <p className="text-sm font-medium text-slate-700">Liens vidéo repérés</p>
          <p className="text-xs text-slate-500">
            Liens cliquables (YouTube, Vimeo, etc.), y compris extraits d&apos;une page (ex. liens dans du
            JavaScript).
          </p>
          {videoUrls.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune vidéo — ajoutez un lien avec le bouton +.</p>
          ) : (
            <div className="space-y-2">
              {videoUrls.map((url, index) => (
                <div
                  key={`video-${index}`}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => {
                      const value = event.target.value;
                      setVideoUrls((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? value : item))
                      );
                    }}
                    className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1.5 font-mono text-xs text-slate-900"
                    spellCheck={false}
                    aria-label={`URL de la vidéo ${index + 1}`}
                  />
                  <div className="flex shrink-0 items-center gap-2">
                    {/^https?:\/\//i.test(url.trim()) ? (
                      <a
                        href={url.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-emerald-700 underline"
                      >
                        Ouvrir
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeVideoAt(index)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow hover:bg-black/75"
                      aria-label="Retirer cette vidéo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => submit('save')}
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Enregistrer le brouillon
          </button>
          <button
            type="button"
            onClick={() => submit('validate')}
            disabled={isSubmitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Valider et publier le séjour
          </button>
          <Link
            href={backHref}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Annuler
          </Link>
        </div>
      </div>
      )}

      {lightboxUrl ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center border-0 bg-black/85 p-4"
          onClick={() => setLightboxUrl(null)}
          aria-label="Fermer l’aperçu"
        >
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </button>
      ) : null}
    </div>
  );
}
