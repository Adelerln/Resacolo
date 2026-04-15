'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import GoogleMapsCityInput from '@/components/common/GoogleMapsCityInput';
import AccommodationImportReviewFields from '@/components/organisme/AccommodationImportReviewFields';
import {
  DraftExtraOptionsEditor,
  DraftInsuranceOptionsEditor,
  DraftSessionsEditor,
  DraftTransportOptionsEditor,
  emptyDraftExtraOptionRecord,
  emptyDraftInsuranceOptionRecord
} from '@/components/organisme/StayDraftStructuredLists';
import { formatAccommodationType } from '@/lib/accommodation-types';
import {
  buildStaySeoGooglePreview,
  buildStaySeoSuggestions,
  buildStaySeoWarnings,
  sanitizeSeoTags,
  sanitizeSeoText,
  SEO_META_RECOMMENDED_MAX,
  SEO_META_RECOMMENDED_MIN,
  SEO_TITLE_RECOMMENDED_MAX,
  SEO_TITLE_RECOMMENDED_MIN
} from '@/lib/stay-seo';
import { normalizeStayDraftCategories, STAY_CATEGORY_OPTIONS, stayCategoryLabelToValue } from '@/lib/stay-categories';
import { slugify } from '@/lib/utils';
import {
  MAX_STAY_SUMMARY_LENGTH,
  STAY_TRANSPORT_LOGISTICS_MODES
} from '@/lib/stay-draft-content';
import {
  defaultAccommodationImportRecord,
  mergeAccommodationImportRecord
} from '@/lib/stay-draft-accommodation-import';
import {
  mergeDraftExtraOptionsJson,
  splitDraftExtraOptionsJson
} from '@/lib/stay-draft-extra-options-split';
import { collapseTransportDraftOptionsJson } from '@/lib/stay-draft-transport-display';
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

type SeoCheck = {
  code: string;
  level: 'ok' | 'warning' | 'info';
  message: string;
};

type SeoActionState = {
  level: 'info' | 'success' | 'error';
  message: string;
};

function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatAgeRangeFromAgesText(agesText: string) {
  const ages = parseCommaSeparatedList(agesText)
    .map((item) => Number(item))
    .filter((value) => Number.isFinite(value) && value >= 3 && value <= 25)
    .sort((left, right) => left - right);
  if (ages.length === 0) return '';
  if (ages.length === 1) return `${ages[0]} ans`;
  return `${ages[0]}-${ages[ages.length - 1]} ans`;
}

function resolveDraftCanonicalPath(slugCandidate: string, title: string) {
  const normalizedCandidate = sanitizeSeoText(slugCandidate);
  const fallback = slugify(sanitizeSeoText(title)) || 'slug-a-definir';
  const finalSlug = normalizedCandidate || fallback;
  return `/sejours/${finalSlug}`;
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
  const initialExtraSplit = splitDraftExtraOptionsJson(
    Array.isArray(initialPayload.extra_options_json) ? initialPayload.extra_options_json : []
  );
  const [extraOptionsList, setExtraOptionsList] = useState<Array<Record<string, unknown>>>(() =>
    initialExtraSplit.extras.map((row) => ({ ...row }))
  );
  const [insuranceOptionsList, setInsuranceOptionsList] = useState<Array<Record<string, unknown>>>(() =>
    initialExtraSplit.insurance.map((row) => ({ ...row }))
  );
  const [extrasSectionVisible, setExtrasSectionVisible] = useState(
    () => initialExtraSplit.extras.length > 0
  );
  const [insuranceSectionVisible, setInsuranceSectionVisible] = useState(
    () => initialExtraSplit.insurance.length > 0
  );
  const [transportOptionsList, setTransportOptionsList] = useState<Array<Record<string, unknown>>>(() => {
    if (!Array.isArray(initialPayload.transport_options_json)) return [];
    const raw = initialPayload.transport_options_json.map((row) => ({ ...row }));
    return collapseTransportDraftOptionsJson(raw);
  });
  const [accommodationImport, setAccommodationImport] = useState<Record<string, unknown>>(() =>
    mergeAccommodationImportRecord(
      defaultAccommodationImportRecord(),
      initialPayload.accommodations_json ?? {}
    )
  );
  const [imageUrls, setImageUrls] = useState<string[]>(() =>
    normalizeImportedImageUrlList(initialPayload.images)
  );
  const [videoUrls, setVideoUrls] = useState<string[]>(() => {
    return normalizeImportedVideoUrlList(initialPayload.video_urls);
  });
  const [status, setStatus] = useState(initialStatus);
  const [validatedAt, setValidatedAt] = useState(initialValidatedAt);
  const [validatedByUserId, setValidatedByUserId] = useState(initialValidatedByUserId);
  const [fieldErrors, setFieldErrors] = useState<StayDraftReviewFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);

  const [seoPrimaryKeyword, setSeoPrimaryKeyword] = useState(initialPayload.seo_primary_keyword);
  const [seoSecondaryKeywords, setSeoSecondaryKeywords] = useState<string[]>(
    sanitizeSeoTags(initialPayload.seo_secondary_keywords)
  );
  const [seoSecondaryInput, setSeoSecondaryInput] = useState('');
  const [seoTargetCity, setSeoTargetCity] = useState(initialPayload.seo_target_city);
  const [seoTargetRegion, setSeoTargetRegion] = useState(initialPayload.seo_target_region);
  const [seoSearchIntents, setSeoSearchIntents] = useState<string[]>(
    sanitizeSeoTags(initialPayload.seo_search_intents)
  );
  const [seoIntentInput, setSeoIntentInput] = useState('');
  const [seoTitle, setSeoTitle] = useState(initialPayload.seo_title);
  const [seoMetaDescription, setSeoMetaDescription] = useState(initialPayload.seo_meta_description);
  const [seoIntroText, setSeoIntroText] = useState(initialPayload.seo_intro_text);
  const [seoH1Variant, setSeoH1Variant] = useState(initialPayload.seo_h1_variant);
  const [seoInternalAnchors, setSeoInternalAnchors] = useState<string[]>(
    sanitizeSeoTags(initialPayload.seo_internal_link_anchor_suggestions)
  );
  const [seoAnchorInput, setSeoAnchorInput] = useState('');
  const [seoSlugCandidate, setSeoSlugCandidate] = useState(initialPayload.seo_slug_candidate);
  const [seoScore, setSeoScore] = useState<number | null>(initialPayload.seo_score);
  const [seoChecks, setSeoChecks] = useState<SeoCheck[]>(initialPayload.seo_checks);
  const [seoGeneratedAt, setSeoGeneratedAt] = useState<string | null>(initialPayload.seo_generated_at ?? null);
  const [seoGenerationSource, setSeoGenerationSource] = useState<string | null>(
    initialPayload.seo_generation_source ?? null
  );
  const [seoActionState, setSeoActionState] = useState<SeoActionState | null>(null);

  const seoCategoryValues = useMemo(
    () =>
      selectedCategories
        .map((categoryLabel) => stayCategoryLabelToValue(categoryLabel))
        .filter(
          (value): value is NonNullable<ReturnType<typeof stayCategoryLabelToValue>> => value !== null
        ),
    [selectedCategories]
  );

  const seoInput = useMemo(
    () => ({
      title,
      summary,
      description,
      activitiesText: description,
      programText,
      location: locationText,
      region: regionText,
      seasonName: '',
      ageRange: formatAgeRangeFromAgesText(agesText),
      categories: seoCategoryValues,
      seo: {
        primaryKeyword: seoPrimaryKeyword,
        secondaryKeywords: seoSecondaryKeywords,
        targetCity: seoTargetCity,
        targetRegion: seoTargetRegion,
        searchIntents: seoSearchIntents,
        title: seoTitle,
        metaDescription: seoMetaDescription,
        introText: seoIntroText,
        h1Variant: seoH1Variant,
        internalLinkAnchorSuggestions: seoInternalAnchors,
        slugCandidate: seoSlugCandidate,
        score: seoScore ?? undefined,
        checks: seoChecks
      }
    }),
    [
      title,
      summary,
      description,
      programText,
      locationText,
      regionText,
      agesText,
      seoCategoryValues,
      seoPrimaryKeyword,
      seoSecondaryKeywords,
      seoTargetCity,
      seoTargetRegion,
      seoSearchIntents,
      seoTitle,
      seoMetaDescription,
      seoIntroText,
      seoH1Variant,
      seoInternalAnchors,
      seoSlugCandidate,
      seoScore,
      seoChecks
    ]
  );

  const seoSuggestions = useMemo(() => buildStaySeoSuggestions(seoInput), [seoInput]);
  const seoWarnings = useMemo(() => buildStaySeoWarnings(seoInput), [seoInput]);
  const seoCanonicalPreview = useMemo(
    () => resolveDraftCanonicalPath(seoSlugCandidate, title),
    [seoSlugCandidate, title]
  );
  const seoGooglePreview = useMemo(
    () => buildStaySeoGooglePreview(seoInput, seoCanonicalPreview),
    [seoInput, seoCanonicalPreview]
  );

  const imagePreviewUrls = useMemo(
    () => imageUrls.filter((url) => /^https?:\/\//i.test(url)).slice(0, 24),
    [imageUrls]
  );

  const hasGeneratedSeo = useMemo(
    () =>
      Boolean(
        seoPrimaryKeyword ||
          seoTitle ||
          seoMetaDescription ||
          seoIntroText ||
          seoH1Variant ||
          seoSlugCandidate ||
          seoSecondaryKeywords.length > 0 ||
          seoSearchIntents.length > 0 ||
          seoInternalAnchors.length > 0
      ),
    [
      seoPrimaryKeyword,
      seoTitle,
      seoMetaDescription,
      seoIntroText,
      seoH1Variant,
      seoSlugCandidate,
      seoSecondaryKeywords,
      seoSearchIntents,
      seoInternalAnchors
    ]
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

  function toggleCategory(categoryLabel: string, checked: boolean) {
    setSelectedCategories((current) => {
      if (checked) {
        return normalizeStayDraftCategories([...current, categoryLabel]).categories;
      }
      return current.filter((value) => value !== categoryLabel);
    });
  }

  function pushSeoTag(rawValue: string, setter: (updater: (current: string[]) => string[]) => void) {
    const [candidate] = sanitizeSeoTags([rawValue]);
    if (!candidate) return;
    setter((current) => sanitizeSeoTags([...current, candidate]));
  }

  function applyGeneratedSeo(seo: {
    seo_primary_keyword?: string | null;
    seo_secondary_keywords?: string[];
    seo_target_city?: string | null;
    seo_target_region?: string | null;
    seo_search_intents?: string[];
    seo_title?: string | null;
    seo_meta_description?: string | null;
    seo_intro_text?: string | null;
    seo_h1_variant?: string | null;
    seo_internal_link_anchor_suggestions?: string[];
    seo_slug_candidate?: string | null;
    seo_score?: number | null;
    seo_checks?: SeoCheck[];
    seo_generated_at?: string | null;
    seo_generation_source?: string | null;
  }) {
    setSeoPrimaryKeyword(sanitizeSeoText(seo.seo_primary_keyword));
    setSeoSecondaryKeywords(sanitizeSeoTags(seo.seo_secondary_keywords ?? []));
    setSeoTargetCity(sanitizeSeoText(seo.seo_target_city));
    setSeoTargetRegion(sanitizeSeoText(seo.seo_target_region));
    setSeoSearchIntents(sanitizeSeoTags(seo.seo_search_intents ?? []));
    setSeoTitle(sanitizeSeoText(seo.seo_title));
    setSeoMetaDescription(sanitizeSeoText(seo.seo_meta_description));
    setSeoIntroText(sanitizeSeoText(seo.seo_intro_text));
    setSeoH1Variant(sanitizeSeoText(seo.seo_h1_variant));
    setSeoInternalAnchors(sanitizeSeoTags(seo.seo_internal_link_anchor_suggestions ?? []));
    setSeoSlugCandidate(sanitizeSeoText(seo.seo_slug_candidate));
    setSeoScore(Number.isFinite(seo.seo_score) ? Number(seo.seo_score) : null);
    setSeoChecks(Array.isArray(seo.seo_checks) ? seo.seo_checks : []);
    setSeoGeneratedAt(typeof seo.seo_generated_at === 'string' ? seo.seo_generated_at : null);
    setSeoGenerationSource(
      typeof seo.seo_generation_source === 'string' && seo.seo_generation_source.trim().length > 0
        ? seo.seo_generation_source
        : null
    );
  }

  async function generateSeo(force: boolean) {
    setIsGeneratingSeo(true);
    setGlobalError(null);
    setSuccessMessage(null);
    setSeoActionState({
      level: 'info',
      message: force ? 'Regénération SEO en cours…' : 'Génération SEO en cours…'
    });
    try {
      const response = await fetch(`/api/stay-drafts/${draftId}/seo`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify({
          organizerId,
          force
        })
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            generated?: boolean;
            alreadyGenerated?: boolean;
            seo?: {
              seo_primary_keyword?: string | null;
              seo_secondary_keywords?: string[];
              seo_target_city?: string | null;
              seo_target_region?: string | null;
              seo_search_intents?: string[];
              seo_title?: string | null;
              seo_meta_description?: string | null;
              seo_intro_text?: string | null;
              seo_h1_variant?: string | null;
              seo_internal_link_anchor_suggestions?: string[];
              seo_slug_candidate?: string | null;
              seo_score?: number | null;
              seo_checks?: SeoCheck[];
              seo_generated_at?: string | null;
              seo_generation_source?: string | null;
            };
          }
        | null;

      if (!response.ok) {
        const message = data?.error ?? 'Impossible de générer le SEO.';
        setGlobalError(message);
        setSeoActionState({
          level: 'error',
          message
        });
        return;
      }

      if (data?.seo) {
        applyGeneratedSeo(data.seo);
      }

      if (data?.alreadyGenerated && !force) {
        const message = 'Un SEO existe déjà pour ce draft. Clique sur “Regénérer le SEO” pour le remplacer.';
        setSuccessMessage(message);
        setSeoActionState({
          level: 'info',
          message
        });
      } else {
        const message = force ? 'SEO regénéré avec succès.' : 'SEO généré avec succès.';
        setSuccessMessage(message);
        setSeoActionState({
          level: 'success',
          message
        });
      }
    } catch {
      const message = "Une erreur réseau est survenue pendant la génération SEO.";
      setGlobalError(message);
      setSeoActionState({
        level: 'error',
        message
      });
    } finally {
      setIsGeneratingSeo(false);
    }
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
    const insuranceOptionsPayload = insuranceOptionsList.filter(
      (row) => String(row.label ?? '').trim().length > 0
    );
    const mergedExtraOptions = mergeDraftExtraOptionsJson(extraOptionsPayload, insuranceOptionsPayload);
    const transportOptionsPayload = transportOptionsList.filter(
      (row) => String(row.label ?? '').trim().length > 0
    );
    const accommodationsParsed = linkedAccommodation
      ? { value: null as Record<string, unknown> | null }
      : { value: JSON.parse(JSON.stringify(accommodationImport)) as Record<string, unknown> };
    const imagesPayload = normalizeImportedImageUrlList(
      imageUrls.map((u) => u.trim()).filter(Boolean)
    );
    const videosPayload = normalizeImportedVideoUrlList(
      videoUrls.map((u) => u.trim()).filter(Boolean)
    );

    if (!linkedAccommodation && !String(accommodationImport.title ?? '').trim()) {
      nextErrors.accommodations_json = "Le nom de l'hébergement importé est requis.";
    }

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
      sessions_json: sessionsPayload,
      extra_options_json: mergedExtraOptions,
      transport_options_json: transportOptionsPayload,
      accommodations_json: accommodationsParsed.value ?? null,
      images: imagesPayload,
      video_urls: videosPayload,
      seo_primary_keyword: sanitizeSeoText(seoPrimaryKeyword),
      seo_secondary_keywords: sanitizeSeoTags(seoSecondaryKeywords),
      seo_target_city: sanitizeSeoText(seoTargetCity),
      seo_target_region: sanitizeSeoText(seoTargetRegion),
      seo_search_intents: sanitizeSeoTags(seoSearchIntents),
      seo_title: sanitizeSeoText(seoTitle),
      seo_meta_description: sanitizeSeoText(seoMetaDescription),
      seo_intro_text: sanitizeSeoText(seoIntroText),
      seo_h1_variant: sanitizeSeoText(seoH1Variant),
      seo_internal_link_anchor_suggestions: sanitizeSeoTags(seoInternalAnchors),
      seo_slug_candidate: sanitizeSeoText(seoSlugCandidate),
      seo_score: Number.isFinite(seoScore) ? seoScore : null,
      seo_checks: seoChecks
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

      {showStayStep && (
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

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">SEO du brouillon</h3>
              <p className="mt-1 text-sm text-slate-600">
                Générez automatiquement un SEO propre à partir des données réelles du séjour, puis ajustez avant publication.
              </p>
              {seoGeneratedAt && (
                <p className="mt-1 text-xs text-slate-500">
                  Dernière génération: {new Date(seoGeneratedAt).toLocaleString('fr-FR')}
                  {seoGenerationSource ? ` (${seoGenerationSource})` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => generateSeo(false)}
                disabled={isSubmitting || isGeneratingSeo}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isGeneratingSeo ? 'Génération en cours…' : 'Générer le SEO'}
              </button>
              {hasGeneratedSeo && (
                <button
                  type="button"
                  onClick={() => generateSeo(true)}
                  disabled={isSubmitting || isGeneratingSeo}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  Regénérer le SEO
                </button>
              )}
            </div>
          </div>

          {seoActionState && (
            <div
              aria-live="polite"
              className={`rounded-lg px-3 py-2 text-sm ${
                seoActionState.level === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : seoActionState.level === 'error'
                    ? 'border border-rose-200 bg-rose-50 text-rose-800'
                    : 'border border-slate-200 bg-white text-slate-700'
              }`}
            >
              {seoActionState.message}
            </div>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Mot-clé principal
            <input
              value={seoPrimaryKeyword}
              onChange={(event) => setSeoPrimaryKeyword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              placeholder="Ex. colonie de vacances surf à Biarritz"
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Mots-clés secondaires</p>
            <div className="flex flex-wrap gap-2">
              {seoSecondaryKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() =>
                      setSeoSecondaryKeywords((current) => current.filter((item) => item !== keyword))
                    }
                    className="text-slate-500 hover:text-slate-800"
                    aria-label={`Supprimer ${keyword}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={seoSecondaryInput}
                onChange={(event) => setSeoSecondaryInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    pushSeoTag(seoSecondaryInput, setSeoSecondaryKeywords);
                    setSeoSecondaryInput('');
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Ajouter un mot-clé secondaire"
              />
              <button
                type="button"
                onClick={() => {
                  pushSeoTag(seoSecondaryInput, setSeoSecondaryKeywords);
                  setSeoSecondaryInput('');
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Ajouter
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Ville cible SEO
              <input
                value={seoTargetCity}
                onChange={(event) => setSeoTargetCity(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                placeholder="Ex. Biarritz"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Région cible SEO
              <input
                value={seoTargetRegion}
                onChange={(event) => setSeoTargetRegion(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                placeholder="Ex. Nouvelle-Aquitaine"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Intentions de recherche associées</p>
            <div className="flex flex-wrap gap-2">
              {seoSearchIntents.map((intent) => (
                <span
                  key={intent}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                >
                  {intent}
                  <button
                    type="button"
                    onClick={() => setSeoSearchIntents((current) => current.filter((item) => item !== intent))}
                    className="text-amber-600 hover:text-amber-800"
                    aria-label={`Supprimer ${intent}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={seoIntentInput}
                onChange={(event) => setSeoIntentInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    pushSeoTag(seoIntentInput, setSeoSearchIntents);
                    setSeoIntentInput('');
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Ex. séjour sportif adolescents"
              />
              <button
                type="button"
                onClick={() => {
                  pushSeoTag(seoIntentInput, setSeoSearchIntents);
                  setSeoIntentInput('');
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Ajouter
              </button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggestions intelligentes</p>
            <div className="flex flex-wrap gap-2">
              {seoSuggestions.map((suggestion) => (
                <div key={suggestion} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs">
                  <p className="font-medium text-slate-800">{suggestion}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSeoPrimaryKeyword(suggestion)}
                      className="rounded-md border border-slate-300 px-2 py-1 font-semibold text-slate-700"
                    >
                      Principal
                    </button>
                    <button
                      type="button"
                      onClick={() => pushSeoTag(suggestion, setSeoSecondaryKeywords)}
                      className="rounded-md border border-slate-300 px-2 py-1 font-semibold text-slate-700"
                    >
                      Secondaire
                    </button>
                    <button
                      type="button"
                      onClick={() => pushSeoTag(suggestion, setSeoSearchIntents)}
                      className="rounded-md border border-slate-300 px-2 py-1 font-semibold text-slate-700"
                    >
                      Intention
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              SEO title
              <input
                value={seoTitle}
                onChange={(event) => setSeoTitle(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                placeholder="Laisser vide pour fallback automatique"
              />
              <span className="mt-1 block text-xs text-slate-500">
                {seoGooglePreview.title.length} caractères (recommandé {SEO_TITLE_RECOMMENDED_MIN} à{' '}
                {SEO_TITLE_RECOMMENDED_MAX})
              </span>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Meta description
              <textarea
                value={seoMetaDescription}
                onChange={(event) => setSeoMetaDescription(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                placeholder="Laisser vide pour fallback automatique"
              />
              <span className="mt-1 block text-xs text-slate-500">
                {seoGooglePreview.description.length} caractères (recommandé {SEO_META_RECOMMENDED_MIN} à{' '}
                {SEO_META_RECOMMENDED_MAX})
              </span>
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Intro SEO
            <textarea
              value={seoIntroText}
              onChange={(event) => setSeoIntroText(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              placeholder="Paragraphe d'introduction SEO"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Variante H1 (optionnel)
              <input
                value={seoH1Variant}
                onChange={(event) => setSeoH1Variant(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Slug candidat (sans impact canonique)
              <input
                value={seoSlugCandidate}
                onChange={(event) => setSeoSlugCandidate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Suggestions d’ancres de maillage interne</p>
            <div className="flex flex-wrap gap-2">
              {seoInternalAnchors.map((anchor) => (
                <span
                  key={anchor}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {anchor}
                  <button
                    type="button"
                    onClick={() => setSeoInternalAnchors((current) => current.filter((item) => item !== anchor))}
                    className="text-slate-500 hover:text-slate-800"
                    aria-label={`Supprimer ${anchor}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={seoAnchorInput}
                onChange={(event) => setSeoAnchorInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    pushSeoTag(seoAnchorInput, setSeoInternalAnchors);
                    setSeoAnchorInput('');
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Ajouter une ancre interne"
              />
              <button
                type="button"
                onClick={() => {
                  pushSeoTag(seoAnchorInput, setSeoInternalAnchors);
                  setSeoAnchorInput('');
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Ajouter
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aperçu Google</p>
            <p className="mt-2 text-lg font-medium text-blue-700">{seoGooglePreview.title}</p>
            <p className="text-sm text-emerald-700">{seoGooglePreview.canonicalPath}</p>
            <p className="mt-2 text-sm text-slate-700">{seoGooglePreview.description}</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">Score SEO</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{seoScore ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">Checklist SEO</p>
              <ul className="mt-2 space-y-1 text-sm">
                {seoChecks.length > 0 ? (
                  seoChecks.map((check) => (
                    <li
                      key={`${check.code}-${check.message}`}
                      className={
                        check.level === 'ok'
                          ? 'text-emerald-700'
                          : check.level === 'warning'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                      }
                    >
                      {check.message}
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">Aucune checklist disponible pour le moment.</li>
                )}
              </ul>
            </div>
          </div>

          {seoWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">Avertissements SEO</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {seoWarnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <DraftSessionsEditor
          value={sessionsList}
          onChange={setSessionsList}
          error={fieldErrors.sessions_json}
        />

        {extrasSectionVisible ? (
          <DraftExtraOptionsEditor
            value={extraOptionsList}
            onChange={(next) => {
              setExtraOptionsList(next);
              if (next.length === 0) setExtrasSectionVisible(false);
            }}
            error={fieldErrors.extra_options_json}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setExtrasSectionVisible(true);
                setExtraOptionsList([emptyDraftExtraOptionRecord()]);
              }}
              className="text-sm font-medium text-emerald-700 underline decoration-emerald-600/40 underline-offset-2 hover:text-emerald-800"
            >
              + Ajouter des options supplémentaires
            </button>
            <p className="mt-1 text-xs text-slate-500">Repas, matériel, activités payantes…</p>
          </div>
        )}

        {insuranceSectionVisible ? (
          <DraftInsuranceOptionsEditor
            value={insuranceOptionsList}
            onChange={(next) => {
              setInsuranceOptionsList(next);
              if (next.length === 0) setInsuranceSectionVisible(false);
            }}
            error={fieldErrors.extra_options_json}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-amber-200/80 bg-amber-50/30 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setInsuranceSectionVisible(true);
                setInsuranceOptionsList([emptyDraftInsuranceOptionRecord()]);
              }}
              className="text-sm font-medium text-amber-900 underline decoration-amber-700/40 underline-offset-2 hover:text-amber-950"
            >
              + Ajouter une option d&apos;assurance
            </button>
            <p className="mt-1 text-xs text-slate-600">Montant fixe ou pourcentage (annulation, assistance…)</p>
          </div>
        )}

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
        </div>

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
