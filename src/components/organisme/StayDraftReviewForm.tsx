'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Bus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
  Images,
  Package,
  Percent,
  Plus,
  Search,
  X
} from 'lucide-react';
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
  sanitizeSeoPrimaryKeyword,
  sanitizeSeoTags,
  sanitizeSeoText,
  SEO_META_RECOMMENDED_MAX,
  SEO_META_RECOMMENDED_MIN,
  SEO_TITLE_RECOMMENDED_MAX,
  SEO_TITLE_RECOMMENDED_MIN
} from '@/lib/stay-seo';
import { normalizeStayDraftCategories, STAY_CATEGORY_OPTIONS, stayCategoryLabelToValue } from '@/lib/stay-categories';
import { cn, slugify } from '@/lib/utils';
import { MAX_STAY_SUMMARY_LENGTH } from '@/lib/stay-draft-content';
import { withOrganizerQuery } from '@/lib/organizers';
import {
  defaultAccommodationImportRecord,
  mergeAccommodationImportRecord
} from '@/lib/stay-draft-accommodation-import';
import {
  mergeDraftExtraOptionsJson,
  splitDraftExtraOptionsJson
} from '@/lib/stay-draft-extra-options-split';
import { collapseTransportDraftOptionsJson } from '@/lib/stay-draft-transport-display';
import {
  buildInitialDraftVideoEntries,
  normalizeImportedImageUrlList,
  normalizeImportedVideoUrlList,
  type DraftVideoEntry
} from '@/lib/stay-draft-url-extract';
import {
  draftReviewControlClass,
  draftReviewFieldGroupClass,
  draftReviewSectionClass
} from '@/lib/draft-review-field-styles';
import { buildStayDestinationLabel } from '@/lib/stay-destination';
import type { StayDraftReviewFieldErrors, StayDraftReviewPayload } from '@/types/stay-draft-review';

type DestinationTypeValue = 'fixed_france' | 'fixed_abroad' | 'itinerant';

const DESTINATION_TYPE_OPTIONS: Array<{ value: DestinationTypeValue; label: string }> = [
  { value: 'fixed_france', label: 'Séjour fixe en France' },
  { value: 'fixed_abroad', label: "Séjour fixe à l'étranger" },
  { value: 'itinerant', label: 'Circuit itinérant' }
];

type StayDraftReviewFormProps = {
  draftId: string;
  organizerId: string | null;
  seasonOptions?: Array<{
    id: string;
    name: string;
  }>;
  initialPayload: StayDraftReviewPayload;
  initialStatus: string;
  initialValidatedAt: string | null;
  initialValidatedByUserId: string | null;
  /** Saisie manuelle : masque la carte Statut / validé en tête du tunnel. */
  hideTopStatusCard?: boolean;
  variant?: 'draft' | 'published';
  publishedReviewEndpoint?: string;
  saveSuccessRedirectHref?: string | null;
  linkedAccommodation?: {
    id: string;
    name: string;
    accommodationType: string | null;
  } | null;
  /** Séjour publié : fiches hébergement du catalogue pour remplacer le lien. */
  organizerAccommodationPickerOptions?: Array<{
    id: string;
    name: string;
    accommodationType: string | null;
  }>;
  publishedSessionsStep?: ReactNode;
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

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

const SEASON_CARD_ORDER = ['Hiver', 'Printemps', 'Été', 'Automne', 'Toussaint', "Fin d'année"];

function parseIsoDateAtUtcMidnight(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function seasonNameFromUtcDate(date: Date): string | null {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if ((month === 12 && day >= 15) || (month === 1 && day <= 15)) return "Fin d'année";
  if ((month === 1 && day >= 20) || month === 2 || (month === 3 && day <= 15)) return 'Hiver';
  if ((month === 3 && day >= 20) || month === 4 || (month === 5 && day <= 10)) return 'Printemps';
  if ((month === 6 && day >= 20) || month === 7 || month === 8 || (month === 9 && day <= 10)) return 'Été';
  if (month === 10 || (month === 11 && day <= 10)) return 'Toussaint';

  return null;
}

function normalizeSeasonKey(value: string | null | undefined): string {
  const normalized = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalized) return '';
  if (normalized.includes('fin') && normalized.includes('annee')) return 'fin_annee';
  if (
    normalized.includes('toussaint') ||
    normalized.includes('octobre') ||
    normalized.includes('automne')
  ) {
    return 'toussaint';
  }
  if (normalized.includes('hiver')) return 'hiver';
  if (normalized.includes('printemps')) return 'printemps';
  if (normalized.includes('ete')) return 'ete';
  return normalized;
}

function inferProtectedSeasonNamesFromSessions(sessions: Array<Record<string, unknown>>): string[] {
  const required = new Set<string>();

  for (const session of sessions) {
    const start = parseIsoDateAtUtcMidnight(session.start_date);
    const end = parseIsoDateAtUtcMidnight(session.end_date);
    if (!start || !end) continue;

    const cursor = new Date(start.getTime());
    const limit = end.getTime();
    while (cursor.getTime() <= limit) {
      const seasonName = seasonNameFromUtcDate(cursor);
      if (seasonName) required.add(seasonName);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return Array.from(required);
}

type DraftReviewStepId =
  | 'hebergement'
  | 'sejour'
  | 'photos'
  | 'sessions'
  | 'options'
  | 'transports'
  | 'partenaires'
  | 'seo';

const DRAFT_REVIEW_STEP_ORDER: DraftReviewStepId[] = [
  'hebergement',
  'sejour',
  'photos',
  'sessions',
  'options',
  'transports',
  'partenaires',
  'seo'
];

const DRAFT_REVIEW_STEPS: {
  id: DraftReviewStepId;
  label: string;
  Icon: typeof Building2;
}[] = [
  { id: 'hebergement', label: 'Hébergement', Icon: Building2 },
  { id: 'sejour', label: 'Séjour', Icon: FileText },
  { id: 'photos', label: 'Photos + Liens', Icon: Images },
  { id: 'sessions', label: 'Sessions', Icon: CalendarDays },
  { id: 'options', label: 'Options', Icon: Package },
  { id: 'transports', label: 'Transports', Icon: Bus },
  { id: 'partenaires', label: 'Partenaires', Icon: Percent },
  { id: 'seo', label: 'SEO', Icon: Search }
];

type PublishBlockHint = {
  step: DraftReviewStepId;
  fieldId: string;
  buttonLabel: string;
};

function resolvePublishBlockHint(errorMessage: string | null | undefined): PublishBlockHint | null {
  const normalized = String(errorMessage ?? '').toLowerCase();
  if (!normalized) return null;

  if (
    normalized.includes('validate-region') ||
    (normalized.includes('région') && normalized.includes('obligatoire'))
  ) {
    return {
      step: 'sejour',
      fieldId: 'draft-region-input',
      buttonLabel: 'Aller au champ Région'
    };
  }

  return null;
}

function draftReviewStepIndex(step: DraftReviewStepId, steps: DraftReviewStepId[]): number {
  return steps.indexOf(step);
}

function draftReviewPrevStep(step: DraftReviewStepId, steps: DraftReviewStepId[]): DraftReviewStepId | null {
  const i = draftReviewStepIndex(step, steps);
  return i > 0 ? steps[i - 1]! : null;
}

function draftReviewNextStep(step: DraftReviewStepId, steps: DraftReviewStepId[]): DraftReviewStepId | null {
  const i = draftReviewStepIndex(step, steps);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1]! : null;
}

function firstIncompleteStepFromInitialPayload(
  steps: DraftReviewStepId[],
  initialPayload: StayDraftReviewPayload,
  linkedAccommodation: StayDraftReviewFormProps['linkedAccommodation'],
  isPublishedVariant: boolean
): DraftReviewStepId {
  if (isPublishedVariant) return 'sejour';
  if (!linkedAccommodation && !String(initialPayload.accommodations_json?.title ?? '').trim()) {
    return 'hebergement';
  }
  if (!initialPayload.title.trim()) return 'sejour';
  if ((initialPayload.sessions_json ?? []).length === 0 && steps.includes('sessions')) return 'sessions';
  if ((initialPayload.images ?? []).length === 0 && steps.includes('photos')) return 'photos';
  return linkedAccommodation ? 'sejour' : 'hebergement';
}

export default function StayDraftReviewForm({
  draftId,
  organizerId,
  seasonOptions = [],
  initialPayload,
  initialStatus,
  initialValidatedAt,
  initialValidatedByUserId,
  hideTopStatusCard = false,
  variant = 'draft',
  publishedReviewEndpoint,
  saveSuccessRedirectHref = null,
  linkedAccommodation = null,
  organizerAccommodationPickerOptions = [],
  publishedSessionsStep = null
}: StayDraftReviewFormProps) {
  const router = useRouter();
  const isPublishedVariant = variant === 'published';
  const reviewSteps = useMemo(
    () =>
      isPublishedVariant
        ? DRAFT_REVIEW_STEP_ORDER.filter((step) => step !== 'sessions')
        : DRAFT_REVIEW_STEP_ORDER,
    [isPublishedVariant]
  );
  const visibleReviewSteps = useMemo(
    () => DRAFT_REVIEW_STEPS.filter((step) => reviewSteps.includes(step.id)),
    [reviewSteps]
  );
  const resolvedPublishedReviewEndpoint =
    publishedReviewEndpoint ?? `/api/organizer/stays/${draftId}/review-bundle`;
  const [currentLinkedAccommodation, setCurrentLinkedAccommodation] = useState(linkedAccommodation);
  const [selectedLinkedAccommodationId, setSelectedLinkedAccommodationId] = useState<string | null>(
    () => linkedAccommodation?.id ?? null
  );
  const [isUnlinkingAccommodation, setIsUnlinkingAccommodation] = useState(false);
  const [activeStep, setActiveStep] = useState<DraftReviewStepId>(() =>
    firstIncompleteStepFromInitialPayload(
      reviewSteps,
      initialPayload,
      linkedAccommodation,
      isPublishedVariant
    )
  );
  const [hasCompletedAccommodationGate, setHasCompletedAccommodationGate] = useState(
    () =>
      isPublishedVariant ||
      Boolean(linkedAccommodation) ||
      firstIncompleteStepFromInitialPayload(
        reviewSteps,
        initialPayload,
        linkedAccommodation,
        isPublishedVariant
      ) !== 'hebergement'
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [title, setTitle] = useState(initialPayload.title);
  const [summary, setSummary] = useState(initialPayload.summary);
  const [destinationType, setDestinationType] = useState<DestinationTypeValue | ''>(
    initialPayload.destination_type
  );
  const [destinationCity, setDestinationCity] = useState(initialPayload.destination_city);
  const [destinationPostalCode, setDestinationPostalCode] = useState(initialPayload.destination_postal_code);
  const [destinationDepartmentCode, setDestinationDepartmentCode] = useState(
    initialPayload.destination_department_code
  );
  const [destinationRegion, setDestinationRegion] = useState(initialPayload.destination_region);
  const [destinationCountry, setDestinationCountry] = useState(initialPayload.destination_country);
  const [destinationItineraryLabel, setDestinationItineraryLabel] = useState(
    initialPayload.destination_itinerary_label
  );
  const [destinationCountriesText, setDestinationCountriesText] = useState(
    (initialPayload.destination_countries ?? []).join(', ')
  );
  const [locationText, setLocationText] = useState(initialPayload.location_text);
  const [regionText, setRegionText] = useState(initialPayload.region_text);
  const [, setSelectedSeasonIds] = useState<string[]>(() => initialPayload.season_ids ?? []);
  const [selectedSeasonNames, setSelectedSeasonNames] = useState<string[]>(
    () => initialPayload.season_names ?? []
  );
  const [description, setDescription] = useState(initialPayload.description);
  const [programText, setProgramText] = useState(initialPayload.program_text);
  const [supervisionText, setSupervisionText] = useState(initialPayload.supervision_text);
  const [requiredDocumentsText, setRequiredDocumentsText] = useState(initialPayload.required_documents_text);
  const [transportText, setTransportText] = useState(initialPayload.transport_text);
  const [transportMode, setTransportMode] = useState(initialPayload.transport_mode);
  const [partnerDiscountPercent, setPartnerDiscountPercent] = useState(() =>
    initialPayload.partner_discount_percent != null && Number.isFinite(initialPayload.partner_discount_percent)
      ? String(initialPayload.partner_discount_percent)
      : ''
  );
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
  const [videoEntries, setVideoEntries] = useState<DraftVideoEntry[]>(() =>
    buildInitialDraftVideoEntries({
      video_urls: initialPayload.video_urls,
      accommodation_video_urls: initialPayload.accommodation_video_urls
    })
  );
  const [status, setStatus] = useState(initialStatus);
  const [validatedAt, setValidatedAt] = useState(initialValidatedAt);
  const [validatedByUserId, setValidatedByUserId] = useState(initialValidatedByUserId);
  const [fieldErrors, setFieldErrors] = useState<StayDraftReviewFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [publishBlockHint, setPublishBlockHint] = useState<PublishBlockHint | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [lastAutosaveAt, setLastAutosaveAt] = useState<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosavePayloadSignatureRef = useRef<string>('');
  const initialAutosaveSnapshotRef = useRef<string>('');
  const lastAutosaveStepRef = useRef<DraftReviewStepId | null>(null);

  const [seoPrimaryKeyword, setSeoPrimaryKeyword] = useState(
    sanitizeSeoPrimaryKeyword(initialPayload.seo_primary_keyword)
  );
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
  const [, setSeoGeneratedAt] = useState<string | null>(initialPayload.seo_generated_at ?? null);
  const [, setSeoGenerationSource] = useState<string | null>(
    initialPayload.seo_generation_source ?? null
  );
  const [seoActionState, setSeoActionState] = useState<SeoActionState | null>(null);
  const [seoAdvancedVisible, setSeoAdvancedVisible] = useState(false);

  useEffect(() => {
    setCurrentLinkedAccommodation(linkedAccommodation);
  }, [linkedAccommodation]);

  useEffect(() => {
    if (!isPublishedVariant) return;
    setSelectedLinkedAccommodationId(linkedAccommodation?.id ?? null);
  }, [isPublishedVariant, linkedAccommodation?.id]);

  const seoCategoryValues = useMemo(
    () =>
      selectedCategories
        .map((categoryLabel) => stayCategoryLabelToValue(categoryLabel))
        .filter(
          (value): value is NonNullable<ReturnType<typeof stayCategoryLabelToValue>> => value !== null
        ),
    [selectedCategories]
  );

  const protectedSeasonNames = useMemo(
    () => inferProtectedSeasonNamesFromSessions(sessionsList),
    [sessionsList]
  );

  const protectedSeasonKeys = useMemo(
    () => new Set(protectedSeasonNames.map((seasonName) => normalizeSeasonKey(seasonName))),
    [protectedSeasonNames]
  );

  const normalizedSeasonOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    for (const option of seasonOptions) {
      const key = normalizeSeasonKey(option.name);
      if (!key || map.has(key)) continue;
      map.set(key, option);
    }

    for (const fallbackName of SEASON_CARD_ORDER) {
      const key = normalizeSeasonKey(fallbackName);
      if (!key || map.has(key)) continue;
      map.set(key, { id: key, name: fallbackName });
    }

    return Array.from(map.values()).sort((left, right) => {
      const indexA = SEASON_CARD_ORDER.findIndex(
        (candidate) => normalizeSeasonKey(candidate) === normalizeSeasonKey(left.name)
      );
      const indexB = SEASON_CARD_ORDER.findIndex(
        (candidate) => normalizeSeasonKey(candidate) === normalizeSeasonKey(right.name)
      );
      if (indexA === -1 && indexB === -1) return left.name.localeCompare(right.name, 'fr');
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [seasonOptions]);

  const selectedSeasonKeySet = useMemo(
    () =>
      new Set([
        ...selectedSeasonNames.map((seasonName) => normalizeSeasonKey(seasonName)),
        ...protectedSeasonNames.map((seasonName) => normalizeSeasonKey(seasonName))
      ]),
    [protectedSeasonNames, selectedSeasonNames]
  );

  const seoInput = useMemo(
    () => {
      const destinationLabel =
        buildStayDestinationLabel({
          destinationType,
          destinationCity,
          destinationPostalCode,
          destinationDepartmentCode,
          destinationRegion,
          destinationCountry,
          destinationItineraryLabel,
          destinationCountries: destinationCountriesText
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          locationText,
          regionText
        }) ?? locationText;

      return {
        title,
        summary,
        description,
        activitiesText: description,
        programText,
        location: destinationLabel,
        region: destinationRegion || regionText,
      seasonName: selectedSeasonNames.join(', '),
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
      };
    },
    [
      title,
      summary,
      description,
      programText,
      destinationType,
      destinationCity,
      destinationPostalCode,
      destinationDepartmentCode,
      destinationRegion,
      destinationCountry,
      destinationItineraryLabel,
      destinationCountriesText,
      locationText,
      regionText,
      selectedSeasonNames,
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
  const lightboxUrl =
    lightboxIndex !== null ? imagePreviewUrls[lightboxIndex] ?? null : null;

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

  const persistAutosave = useCallback(async (nextPayload: StayDraftReviewPayload) => {
    if (isPublishedVariant || isSubmitting) return;
    const signature = JSON.stringify(nextPayload);
    if (signature === autosavePayloadSignatureRef.current) return;

    setAutosaveStatus('saving');
    setAutosaveError(null);

    try {
      const response = await fetch(`/api/stay-drafts/${draftId}/autosave`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify({
          organizerId,
          payload: nextPayload
        })
      });

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; updatedAt?: string; error?: string }
        | null;

      if (!response.ok || !data?.success) {
        setAutosaveStatus('error');
        setAutosaveError(data?.error ?? 'Autosave impossible.');
        return;
      }

      autosavePayloadSignatureRef.current = signature;
      setLastAutosaveAt(data.updatedAt ?? new Date().toISOString());
      setAutosaveStatus('saved');
    } catch {
      setAutosaveStatus('error');
      setAutosaveError('Autosave impossible.');
    }
  }, [draftId, isPublishedVariant, isSubmitting, organizerId]);

  const autosaveDraftPayload = buildAutosavePayload();

  useEffect(() => {
    if (isPublishedVariant) return;
    const signature = JSON.stringify(autosaveDraftPayload);
    if (!initialAutosaveSnapshotRef.current) {
      initialAutosaveSnapshotRef.current = signature;
      autosavePayloadSignatureRef.current = signature;
    }
  }, [autosaveDraftPayload, isPublishedVariant]);

  useEffect(() => {
    if (isPublishedVariant || isSubmitting || isGeneratingSeo) return;
    const signature = JSON.stringify(autosaveDraftPayload);
    if (!initialAutosaveSnapshotRef.current) {
      initialAutosaveSnapshotRef.current = signature;
      autosavePayloadSignatureRef.current = signature;
      return;
    }
    if (signature === autosavePayloadSignatureRef.current) return;

    setAutosaveStatus((current) => (current === 'saving' ? current : 'idle'));
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      void persistAutosave(autosaveDraftPayload);
    }, 10000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [autosaveDraftPayload, isGeneratingSeo, isPublishedVariant, isSubmitting, persistAutosave]);

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
    const targetUrl = imagePreviewUrls[index] ?? null;
    setImageUrls((current) => {
      if (!targetUrl) return current;
      const next = [...current];
      const targetIndex = next.indexOf(targetUrl);
      if (targetIndex >= 0) {
        next.splice(targetIndex, 1);
      }
      return next;
    });
    setLightboxIndex((current) => {
      if (current === null) return current;
      if (current === index) {
        return imagePreviewUrls.length <= 1 ? null : current % (imagePreviewUrls.length - 1);
      }
      if (current > index) return current - 1;
      return current;
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
    setVideoEntries((current) => {
      const next = [...current];
      const existing = new Set(next.map((e) => e.url));
      for (const url of extracted) {
        if (!existing.has(url)) {
          next.push({ url, scope: 'stay' });
          existing.add(url);
        }
      }
      return next;
    });
  }

  function removeVideoAt(index: number) {
    setVideoEntries((current) => current.filter((_, i) => i !== index));
  }

  function setVideoEntryScope(index: number, scope: DraftVideoEntry['scope']) {
    setVideoEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, scope } : entry))
    );
  }

  function toggleCategory(categoryLabel: string, checked: boolean) {
    setSelectedCategories((current) => {
      if (checked) {
        return normalizeStayDraftCategories([...current, categoryLabel]).categories;
      }
      return current.filter((value) => value !== categoryLabel);
    });
  }

  function toggleSeason(option: { id: string; name: string }, checked: boolean) {
    const seasonKey = normalizeSeasonKey(option.name);
    if (!seasonKey) return;
    if (!checked && protectedSeasonKeys.has(seasonKey)) return;

    setSelectedSeasonNames((current) => {
      const next = new Map<string, string>(
        current.map((seasonName) => [normalizeSeasonKey(seasonName), seasonName] as const)
      );
      if (checked) next.set(seasonKey, option.name);
      else next.delete(seasonKey);

      return normalizedSeasonOptions
        .filter((candidate) => next.has(normalizeSeasonKey(candidate.name)))
        .map((candidate) => next.get(normalizeSeasonKey(candidate.name)) ?? candidate.name);
    });

    setSelectedSeasonIds((current) => {
      const next = new Set(current);
      if (checked) next.add(option.id);
      else next.delete(option.id);
      return normalizedSeasonOptions
        .filter((candidate) => next.has(candidate.id))
        .map((candidate) => candidate.id);
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
    setSeoPrimaryKeyword(sanitizeSeoPrimaryKeyword(seo.seo_primary_keyword));
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

  function parseDestinationCountries(): string[] {
    return destinationCountriesText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function buildLegacyDestinationCompatibilityFields() {
    const countries = parseDestinationCountries();

    if (destinationType === 'fixed_france') {
      return {
        locationText: destinationCity.trim(),
        regionText: destinationRegion.trim()
      };
    }

    if (destinationType === 'fixed_abroad') {
      return {
        locationText: [destinationCity.trim(), destinationCountry.trim()].filter(Boolean).join(', '),
        regionText: 'Étranger'
      };
    }

    if (destinationType === 'itinerant') {
      return {
        locationText: destinationItineraryLabel.trim() || 'Circuit itinérant',
        regionText: countries.length > 0 ? 'Étranger' : regionText.trim()
      };
    }

    return {
      locationText: locationText.trim(),
      regionText: regionText.trim()
    };
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

    const sessionsPayload = sessionsList.filter((row) => {
      const hasStart = String(row.start_date ?? '').trim().length > 0;
      const hasEnd = String(row.end_date ?? '').trim().length > 0;
      const hasLabel = String(row.label ?? '').trim().length > 0;
      const p = row.price;
      const hasPrice =
        (typeof p === 'number' && Number.isFinite(p)) ||
        (p != null && String(p).trim() !== '' && String(p).trim() !== 'null');
      return hasStart || hasEnd || hasLabel || hasPrice;
    });
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
    const accommodationsParsed = isPublishedVariant
      ? { value: null as Record<string, unknown> | null }
      : currentLinkedAccommodation
        ? { value: null as Record<string, unknown> | null }
        : { value: JSON.parse(JSON.stringify(accommodationImport)) as Record<string, unknown> };
    const imagesPayload = normalizeImportedImageUrlList(
      imageUrls.map((u) => u.trim()).filter(Boolean)
    );
    const stayVideoSource = videoEntries
      .filter((e) => e.scope === 'stay')
      .map((e) => e.url.trim())
      .filter(Boolean);
    const accommodationVideoSource = videoEntries
      .filter((e) => e.scope === 'accommodation')
      .map((e) => e.url.trim())
      .filter(Boolean);
    const videosPayload = normalizeImportedVideoUrlList(stayVideoSource);
    const accommodationVideosPayload = normalizeImportedVideoUrlList(accommodationVideoSource);
    const destinationCountries = parseDestinationCountries();
    const legacyDestination = buildLegacyDestinationCompatibilityFields();

    if (isPublishedVariant) {
      if (
        organizerAccommodationPickerOptions.length > 0 &&
        (!selectedLinkedAccommodationId || !selectedLinkedAccommodationId.trim())
      ) {
        nextErrors.accommodations_json = "Sélectionnez l'hébergement lié au séjour dans le catalogue.";
      }
    } else if (!currentLinkedAccommodation && !String(accommodationImport.title ?? '').trim()) {
      nextErrors.accommodations_json = "Le nom de l'hébergement importé est requis.";
    }

    let partnerDiscountParsed: number | null = null;
    const partnerRaw = partnerDiscountPercent.trim().replace(',', '.');
    if (partnerRaw.length > 0) {
      const pd = Number(partnerRaw);
      if (!Number.isFinite(pd) || pd < 0 || pd > 100) {
        nextErrors.partner_discount_percent =
          'Indiquez un pourcentage entre 0 et 100, ou laissez le champ vide.';
      } else {
        partnerDiscountParsed = pd;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      return { errors: nextErrors };
    }

    const resolvedSeasonNames = normalizedSeasonOptions
      .filter((option) => selectedSeasonKeySet.has(normalizeSeasonKey(option.name)))
      .map((option) => option.name);
    const resolvedSeasonIds = normalizedSeasonOptions
      .filter((option) => selectedSeasonKeySet.has(normalizeSeasonKey(option.name)))
      .map((option) => option.id);

    const payload: StayDraftReviewPayload = {
      title: normalizedTitle,
      season_ids: resolvedSeasonIds,
      season_names: resolvedSeasonNames,
      season_name: resolvedSeasonNames[0] ?? resolvedSeasonNames.join(', '),
      summary,
      destination_type: destinationType,
      destination_city: destinationCity.trim(),
      destination_postal_code: destinationPostalCode.trim(),
      destination_department_code: destinationDepartmentCode.trim(),
      destination_region: destinationRegion.trim(),
      destination_country: destinationCountry.trim(),
      destination_itinerary_label: destinationItineraryLabel.trim(),
      destination_countries: destinationCountries,
      location_text: legacyDestination.locationText,
      region_text: legacyDestination.regionText,
      description,
      activities_text: initialPayload.activities_text,
      required_documents_text: requiredDocumentsText,
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
      accommodation_video_urls: accommodationVideosPayload,
      seo_primary_keyword: sanitizeSeoPrimaryKeyword(seoPrimaryKeyword),
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
      seo_checks: seoChecks,
      partner_discount_percent: partnerDiscountParsed,
      linked_accommodation_id: isPublishedVariant
        ? selectedLinkedAccommodationId?.trim() || null
        : null
    };

    return { payload };
  }

  function buildAutosavePayload(): StayDraftReviewPayload {
    const categories = normalizeStayDraftCategories(selectedCategories).categories;
    const ages = parseCommaSeparatedList(agesText)
      .map((item) => Number(item))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .map((value) => Math.round(value));
    const sessionsPayload = sessionsList.filter((row) => {
      const hasStart = String(row.start_date ?? '').trim().length > 0;
      const hasEnd = String(row.end_date ?? '').trim().length > 0;
      const hasLabel = String(row.label ?? '').trim().length > 0;
      const p = row.price;
      const hasPrice =
        (typeof p === 'number' && Number.isFinite(p)) ||
        (p != null && String(p).trim() !== '' && String(p).trim() !== 'null');
      return hasStart || hasEnd || hasLabel || hasPrice;
    });
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
    const accommodationsParsed = currentLinkedAccommodation
      ? { value: null as Record<string, unknown> | null }
      : { value: JSON.parse(JSON.stringify(accommodationImport)) as Record<string, unknown> };
    const imagesPayload = normalizeImportedImageUrlList(
      imageUrls.map((u) => u.trim()).filter(Boolean)
    );
    const stayVideoSourceAutosave = videoEntries
      .filter((e) => e.scope === 'stay')
      .map((e) => e.url.trim())
      .filter(Boolean);
    const accommodationVideoSourceAutosave = videoEntries
      .filter((e) => e.scope === 'accommodation')
      .map((e) => e.url.trim())
      .filter(Boolean);
    const videosPayload = normalizeImportedVideoUrlList(stayVideoSourceAutosave);
    const accommodationVideosPayload = normalizeImportedVideoUrlList(accommodationVideoSourceAutosave);
    const resolvedSeasonNames = normalizedSeasonOptions
      .filter((option) => selectedSeasonKeySet.has(normalizeSeasonKey(option.name)))
      .map((option) => option.name);
    const resolvedSeasonIds = normalizedSeasonOptions
      .filter((option) => selectedSeasonKeySet.has(normalizeSeasonKey(option.name)))
      .map((option) => option.id);
    const partnerRaw = partnerDiscountPercent.trim().replace(',', '.');
    const partnerParsed = partnerRaw.length > 0 && Number.isFinite(Number(partnerRaw))
      ? Number(partnerRaw)
      : null;
    const destinationCountries = parseDestinationCountries();
    const legacyDestination = buildLegacyDestinationCompatibilityFields();

    return {
      title: title.trim(),
      season_ids: resolvedSeasonIds,
      season_names: resolvedSeasonNames,
      season_name: resolvedSeasonNames[0] ?? resolvedSeasonNames.join(', '),
      summary,
      destination_type: destinationType,
      destination_city: destinationCity.trim(),
      destination_postal_code: destinationPostalCode.trim(),
      destination_department_code: destinationDepartmentCode.trim(),
      destination_region: destinationRegion.trim(),
      destination_country: destinationCountry.trim(),
      destination_itinerary_label: destinationItineraryLabel.trim(),
      destination_countries: destinationCountries,
      location_text: legacyDestination.locationText,
      region_text: legacyDestination.regionText,
      description,
      activities_text: initialPayload.activities_text,
      required_documents_text: requiredDocumentsText,
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
      accommodation_video_urls: accommodationVideosPayload,
      seo_primary_keyword: sanitizeSeoPrimaryKeyword(seoPrimaryKeyword),
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
      seo_checks: seoChecks,
      partner_discount_percent: partnerParsed,
      linked_accommodation_id: null
    };
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
    setPublishBlockHint(null);
    setSuccessMessage(null);

    try {
      const response = isPublishedVariant
        ? await fetch(resolvedPublishedReviewEndpoint, {
            method: 'PATCH',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json'
            },
            body: JSON.stringify({
              organizerId,
              payload: result.payload
            })
          })
        : await fetch(`/api/stay-drafts/${draftId}`, {
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
            saved?: boolean;
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
        setPublishBlockHint(resolvePublishBlockHint(data?.error));
        setGlobalError(
          data?.error ??
            (isPublishedVariant
              ? 'Impossible d’enregistrer les modifications du séjour.'
              : 'Impossible de sauvegarder le brouillon.')
        );
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
        isPublishedVariant
          ? 'Modifications enregistrées.'
          : mode === 'validate'
          ? 'Brouillon validé avec succès.'
          : data?.published
            ? 'Séjour enregistré et publié.'
            : 'Brouillon enregistré avec succès.'
      );
      setPublishBlockHint(null);
      if (!isPublishedVariant) {
        setStatus(data?.draft?.status ?? status);
        setValidatedAt(data?.draft?.validated_at ?? validatedAt);
        setValidatedByUserId(data?.draft?.validated_by_user_id ?? validatedByUserId);
        const signature = JSON.stringify(result.payload);
        autosavePayloadSignatureRef.current = signature;
        initialAutosaveSnapshotRef.current = signature;
        setAutosaveStatus('saved');
        setLastAutosaveAt(new Date().toISOString());
      }

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

      if (mode === 'save' && typeof saveSuccessRedirectHref === 'string' && saveSuccessRedirectHref) {
        // Navigation complète : évite un cache client obsolète sur la liste des séjours
        // (le brouillon serait alors absent de « Brouillons d’import » jusqu’au prochain refresh).
        window.location.assign(saveSuccessRedirectHref);
        return;
      }

      router.refresh();
    } catch {
      setPublishBlockHint(null);
      setGlobalError(
        isPublishedVariant
          ? "Une erreur réseau est survenue pendant l'enregistrement du séjour."
          : "Une erreur réseau est survenue pendant l'enregistrement."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const accommodationGateClosed =
    !isPublishedVariant && !currentLinkedAccommodation && !hasCompletedAccommodationGate;
  const effectiveStep: DraftReviewStepId = accommodationGateClosed ? 'hebergement' : activeStep;
  const effectiveStepIndex = draftReviewStepIndex(effectiveStep, reviewSteps);
  const publishAllowed =
    isPublishedVariant || (!accommodationGateClosed && title.trim().length > 0);
  const showStatusInTopCard = String(status ?? '').trim().toLowerCase() !== 'pending';

  const stepHasError = useMemo(() => {
    const byStep: Record<DraftReviewStepId, boolean> = {
      hebergement: Boolean(fieldErrors.accommodations_json),
      sejour: Boolean(
        fieldErrors.title ||
          fieldErrors.season_ids ||
          fieldErrors.summary ||
          fieldErrors.location_text ||
          fieldErrors.region_text ||
          fieldErrors.description ||
          fieldErrors.program_text ||
          fieldErrors.supervision_text ||
          fieldErrors.required_documents_text ||
          fieldErrors.transport_text ||
          fieldErrors.categories ||
          fieldErrors.ages
      ),
      photos: Boolean(fieldErrors.images || fieldErrors.video_urls),
      sessions: Boolean(fieldErrors.sessions_json),
      options: Boolean(fieldErrors.extra_options_json),
      transports: Boolean(fieldErrors.transport_options_json || fieldErrors.transport_mode),
      partenaires: Boolean(fieldErrors.partner_discount_percent),
      seo: Boolean(
        fieldErrors.seo_primary_keyword ||
          fieldErrors.seo_secondary_keywords ||
          fieldErrors.seo_target_city ||
          fieldErrors.seo_target_region ||
          fieldErrors.seo_search_intents ||
          fieldErrors.seo_title ||
          fieldErrors.seo_meta_description ||
          fieldErrors.seo_intro_text ||
          fieldErrors.seo_h1_variant ||
          fieldErrors.seo_internal_link_anchor_suggestions ||
          fieldErrors.seo_slug_candidate ||
          fieldErrors.seo_score ||
          fieldErrors.seo_checks
      )
    };
    return byStep;
  }, [fieldErrors]);

  const stepIsCompleted = useMemo(() => {
    const completed: Record<DraftReviewStepId, boolean> = {
      hebergement: isPublishedVariant
        ? Boolean(selectedLinkedAccommodationId?.trim()) ||
          organizerAccommodationPickerOptions.length === 0
        : currentLinkedAccommodation
          ? true
          : Boolean(String(accommodationImport.title ?? '').trim()),
      sejour: Boolean(title.trim()),
      photos:
        imagePreviewUrls.length > 0 ||
        videoEntries.some((entry) => entry.url.trim().length > 0),
      sessions: sessionsList.length > 0 || isPublishedVariant,
      options: extraOptionsList.length > 0 || insuranceOptionsList.length > 0,
      transports:
        transportOptionsList.length > 0 ||
        Boolean(transportMode && transportMode !== 'À préciser'),
      partenaires: Boolean(partnerDiscountPercent.trim()),
      seo: hasGeneratedSeo
    };
    return completed;
  }, [
    accommodationImport.title,
    extraOptionsList.length,
    hasGeneratedSeo,
    imagePreviewUrls.length,
    insuranceOptionsList.length,
    isPublishedVariant,
    currentLinkedAccommodation,
    organizerAccommodationPickerOptions.length,
    selectedLinkedAccommodationId,
    partnerDiscountPercent,
    sessionsList.length,
    title,
    transportMode,
    transportOptionsList.length,
    videoEntries
  ]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    if (imagePreviewUrls.length === 0) {
      setLightboxIndex(null);
      return;
    }
    if (lightboxIndex >= imagePreviewUrls.length) {
      setLightboxIndex(imagePreviewUrls.length - 1);
    }
  }, [imagePreviewUrls.length, lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setLightboxIndex(null);
      } else if (event.key === 'ArrowLeft' && imagePreviewUrls.length > 1) {
        event.preventDefault();
        setLightboxIndex((current) => {
          if (current === null) return current;
          return (current - 1 + imagePreviewUrls.length) % imagePreviewUrls.length;
        });
      } else if (event.key === 'ArrowRight' && imagePreviewUrls.length > 1) {
        event.preventDefault();
        setLightboxIndex((current) => {
          if (current === null) return current;
          return (current + 1) % imagePreviewUrls.length;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [imagePreviewUrls.length, lightboxIndex]);

  useEffect(() => {
    if (isPublishedVariant) return;
    if (lastAutosaveStepRef.current === null) {
      lastAutosaveStepRef.current = effectiveStep;
      return;
    }
    if (lastAutosaveStepRef.current === effectiveStep) return;
    lastAutosaveStepRef.current = effectiveStep;
    void persistAutosave(autosaveDraftPayload);
  }, [autosaveDraftPayload, effectiveStep, isPublishedVariant, persistAutosave]);

  function goToDraftStep(step: DraftReviewStepId) {
    if (accommodationGateClosed && step !== 'hebergement') return;
    if (!reviewSteps.includes(step)) return;
    setActiveStep(step);
  }

  function goDraftPrev() {
    if (accommodationGateClosed) return;
    const prev = draftReviewPrevStep(activeStep, reviewSteps);
    if (prev) setActiveStep(prev);
  }

  function goDraftNext() {
    if (accommodationGateClosed) {
      setHasCompletedAccommodationGate(true);
      setActiveStep('sejour');
      return;
    }
    const next = draftReviewNextStep(activeStep, reviewSteps);
    if (next) setActiveStep(next);
  }

  return (
    <div className="space-y-6">
      {!hideTopStatusCard && (showStatusInTopCard || validatedAt || validatedByUserId) ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-3">
            {showStatusInTopCard ? (
              <>
                <span className="text-sm font-medium text-slate-500">Statut :</span>
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {status}
                </span>
              </>
            ) : null}
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
      ) : null}

      {globalError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p>{globalError}</p>
          {publishBlockHint ? (
            <button
              type="button"
              onClick={() => {
                goToDraftStep(publishBlockHint.step);
                window.setTimeout(() => {
                  const target = document.getElementById(publishBlockHint.fieldId) as
                    | HTMLInputElement
                    | HTMLTextAreaElement
                    | null;
                  if (!target) return;
                  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  target.focus();
                }, 30);
              }}
              className="mt-2 inline-flex items-center rounded-md border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
            >
              {publishBlockHint.buttonLabel}
            </button>
          ) : null}
        </div>
      )}
      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}
      {!isPublishedVariant && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Autosave</span>
            {autosaveStatus === 'saving' ? <span>Sauvegarde…</span> : null}
            {autosaveStatus === 'saved' && lastAutosaveAt ? (
              <span>Enregistré à {new Date(lastAutosaveAt).toLocaleTimeString('fr-FR')}</span>
            ) : null}
            {autosaveStatus === 'error' ? (
              <span className="text-rose-700">{autosaveError ?? 'Erreur autosave'}</span>
            ) : null}
            {autosaveStatus === 'idle' ? <span>Modifications non sauvegardées</span> : null}
          </div>
          {autosaveStatus === 'error' ? (
            <button
              type="button"
              onClick={() => void persistAutosave(buildAutosavePayload())}
              className="rounded-md border border-rose-200 px-2.5 py-1 font-semibold text-rose-700"
            >
              Réessayer
            </button>
          ) : null}
        </div>
      )}

      {!currentLinkedAccommodation && accommodationGateClosed && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">Première étape</span> — contrôlez l&apos;hébergement importé, puis
          « Continuer » pour débloquer les étapes suivantes. Aucune donnée n&apos;est envoyée tant que vous
          n&apos;enregistrez pas le brouillon.
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <nav aria-label="Étapes de relecture du brouillon">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">
              Étape {Math.max(1, effectiveStepIndex + 1)} / {visibleReviewSteps.length}
            </p>
          </div>
          <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-between sm:gap-3 sm:overflow-visible">
            {visibleReviewSteps.map(({ id, label, Icon }) => {
              const isActive = effectiveStep === id;
              const stepDisabled = accommodationGateClosed && id !== 'hebergement';
              const isError = stepHasError[id];
              const isCompleted = stepIsCompleted[id];
              return (
                <li key={id} className="snap-start shrink-0 sm:flex-1 sm:min-w-0">
                  <button
                    type="button"
                    disabled={stepDisabled}
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => goToDraftStep(id)}
                    className={cn(
                      'flex h-full min-h-[92px] w-[126px] flex-col items-start justify-between rounded-xl border px-3 py-3 text-left transition sm:w-full',
                      isActive
                        ? 'border-orange-400 bg-orange-50/90 ring-2 ring-orange-200/80'
                        : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white',
                      stepDisabled && 'cursor-not-allowed opacity-40 hover:border-slate-200 hover:bg-slate-50/80'
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <span>{label}</span>
                      </span>
                      {isError ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-400" />
                      )}
                    </span>
                    <span className="flex w-full items-center justify-between gap-2">
                      <Icon
                        className={cn('h-5 w-5 shrink-0', isActive ? 'text-orange-700' : 'text-slate-500')}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'text-[11px] font-semibold',
                          isError ? 'text-amber-700' : isCompleted ? 'text-emerald-700' : 'text-slate-600'
                        )}
                      >
                        {isError ? 'À corriger' : isCompleted ? 'Complétée' : 'À compléter'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-4 border-t border-slate-100 pt-5">
          {isPublishedVariant && effectiveStep !== 'hebergement' ? (
            <div
              className={cn(
                'rounded-2xl px-4 py-3 text-sm',
                currentLinkedAccommodation
                  ? 'border border-sky-200 bg-sky-50 text-sky-900'
                  : 'border border-amber-200 bg-amber-50/70 text-amber-950'
              )}
            >
              {currentLinkedAccommodation ? (
                <>
                  <p className="font-semibold">Hébergement actuellement lié</p>
                  <p className="mt-1">
                    <span className="font-semibold">{currentLinkedAccommodation.name}</span>
                    {currentLinkedAccommodation.accommodationType
                      ? ` (${formatAccommodationType(currentLinkedAccommodation.accommodationType)})`
                      : ''}.
                  </p>
                  <p className="mt-2 text-xs text-sky-800">
                    Pour le remplacer, ouvrez l’étape <span className="font-semibold">Hébergement</span> puis
                    enregistrez le séjour.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Aucun hébergement lié détecté</p>
                  <p className="mt-1">
                    Le séjour reste modifiable, mais aucun lien d’hébergement n’a été retrouvé pour cette fiche.
                  </p>
                  <p className="mt-2 text-xs text-amber-900/90">
                    Associez une fiche catalogue depuis l’étape <span className="font-semibold">Hébergement</span>.
                  </p>
                </>
              )}
            </div>
          ) : null}

          {effectiveStep === 'hebergement' && isPublishedVariant ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Hébergement lié au séjour</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Choisissez une fiche du catalogue organisateur. Les changements sont appliqués lorsque vous
                  enregistrez le séjour.
                </p>
              </div>
              {organizerAccommodationPickerOptions.length === 0 ? (
                <p className="text-sm text-slate-700">
                  Aucun hébergement dans votre catalogue.{' '}
                  <Link
                    href={withOrganizerQuery('/organisme/hebergements/new', organizerId)}
                    className="font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-800"
                  >
                    Créer une fiche hébergement
                  </Link>
                </p>
              ) : (
                <label className="block text-sm font-medium text-slate-700">
                  Fiche catalogue
                  <select
                    value={selectedLinkedAccommodationId ?? ''}
                    onChange={(event) => {
                      const next = event.target.value.trim();
                      setSelectedLinkedAccommodationId(next.length > 0 ? next : null);
                    }}
                    className={draftReviewControlClass({
                      required: true,
                      filled: Boolean(selectedLinkedAccommodationId?.trim()),
                      hasError: Boolean(fieldErrors.accommodations_json)
                    })}
                  >
                    <option value="">— Choisir un hébergement —</option>
                    {organizerAccommodationPickerOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                        {option.accommodationType
                          ? ` (${formatAccommodationType(option.accommodationType)})`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.accommodations_json ? (
                    <span className="mt-1 block text-xs text-rose-600">{fieldErrors.accommodations_json}</span>
                  ) : null}
                </label>
              )}
            </div>
          ) : null}

          {effectiveStep === 'hebergement' && !isPublishedVariant && !currentLinkedAccommodation && (
            <AccommodationImportReviewFields
              value={accommodationImport}
              onChange={setAccommodationImport}
              fieldError={fieldErrors.accommodations_json}
              nameInputClassName={draftReviewControlClass({
                required: true,
                filled: Boolean(String(accommodationImport.title ?? '').trim()),
                hasError: Boolean(fieldErrors.accommodations_json)
              })}
            />
          )}

          {effectiveStep === 'hebergement' && !isPublishedVariant && currentLinkedAccommodation && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
              <p className="font-semibold">Hébergement déjà sélectionné avant import</p>
              <p className="mt-1">
                Le séjour sera rattaché à <span className="font-semibold">{currentLinkedAccommodation.name}</span>
                {currentLinkedAccommodation.accommodationType
                  ? ` (${formatAccommodationType(currentLinkedAccommodation.accommodationType)})`
                  : ''}.
              </p>
              <p className="mt-1 text-sky-800">
                L&apos;IA n&apos;extrait pas de nouvel hébergement pour ce brouillon.
              </p>
              {variant === 'draft' &&
              (String(status ?? '').trim().toLowerCase() === 'pending' ||
                String(status ?? '').trim().toLowerCase() === 'draft' ||
                String(status ?? '').trim().toLowerCase() === 'validated') ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={isUnlinkingAccommodation}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Êtes-vous sûr de vouloir délier cet hébergement de ce brouillon ? Vous pourrez ensuite sélectionner un autre centre."
                        )
                      ) {
                        return;
                      }

                      setIsUnlinkingAccommodation(true);
                      setGlobalError(null);
                      try {
                        const response = await fetch(`/api/stay-drafts/${draftId}/unlink-accommodation`, {
                          method: 'POST',
                          headers: {
                            'content-type': 'application/json',
                            accept: 'application/json'
                          },
                          body: JSON.stringify({ organizerId })
                        });
                        const data = (await response.json().catch(() => null)) as
                          | { success?: boolean; error?: string }
                          | null;

                        if (!response.ok || !data?.success) {
                          setGlobalError(
                            data?.error ?? "Impossible de délier l'hébergement de ce brouillon."
                          );
                          return;
                        }

                        setCurrentLinkedAccommodation(null);
                        setHasCompletedAccommodationGate(false);
                        setActiveStep('hebergement');
                        setSuccessMessage('Hébergement délié du brouillon.');
                        router.refresh();
                      } catch {
                        setGlobalError("Impossible de délier l'hébergement de ce brouillon.");
                      } finally {
                        setIsUnlinkingAccommodation(false);
                      }
                    }}
                    className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-70"
                  >
                    {isUnlinkingAccommodation ? 'Déliaison...' : "Délier l'hébergement"}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {effectiveStep === 'sejour' && (
            <>
        <label className="block text-sm font-medium text-slate-700">
          Titre
          <input
            id="draft-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={draftReviewControlClass({
              required: true,
              filled: Boolean(title.trim()),
              hasError: Boolean(fieldErrors.title)
            })}
          />
          {fieldErrors.title && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.title}</span>}
        </label>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-slate-700">Saisons</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              {normalizedSeasonOptions.map((option) => {
                const seasonKey = normalizeSeasonKey(option.name);
                const checked = selectedSeasonKeySet.has(seasonKey);
                const locked = protectedSeasonKeys.has(seasonKey);
                return (
                  <label
                    key={`${option.id}-${option.name}`}
                    className={cn(
                      'flex min-h-[60px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition',
                      checked
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-white text-slate-700',
                      locked && 'cursor-not-allowed'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked && checked}
                      onChange={(event) => toggleSeason(option, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="font-medium leading-tight">{option.name}</span>
                  </label>
                );
              })}
            </div>
            {fieldErrors.season_ids ? (
              <span className="block text-xs text-rose-600">{fieldErrors.season_ids}</span>
            ) : null}
          </div>
        </section>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Destination du séjour</h3>
            <p className="mt-1 text-xs text-slate-500">
              Cette destination commerciale alimente les filtres du catalogue, les cartes SVG et l&apos;affichage public.
            </p>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Type de destination
            <select
              value={destinationType}
              onChange={(event) => setDestinationType(event.target.value as DestinationTypeValue | '')}
              className={draftReviewControlClass({
                required: false,
                filled: Boolean(destinationType)
              })}
            >
              <option value="">Non renseigné</option>
              {DESTINATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {destinationType === 'fixed_france' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <GoogleMapsCityInput
                key={`${draftId}-destination-france`}
                name="destination_city"
                label="Ville"
                value={destinationCity}
                onValueChange={setDestinationCity}
                showApiHint
                inputClassName={draftReviewControlClass({
                  required: false,
                  filled: Boolean(destinationCity.trim()),
                  omitOuterMargin: true
                })}
              />
              <label className="block text-sm font-medium text-slate-700">
                Code postal
                <input
                  value={destinationPostalCode}
                  onChange={(event) => setDestinationPostalCode(event.target.value)}
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(destinationPostalCode.trim())
                  })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Département
                <input
                  value={destinationDepartmentCode}
                  onChange={(event) => setDestinationDepartmentCode(event.target.value)}
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(destinationDepartmentCode.trim())
                  })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Région
                <input
                  id="draft-region-input"
                  value={destinationRegion}
                  onChange={(event) => setDestinationRegion(event.target.value)}
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(destinationRegion.trim())
                  })}
                />
              </label>
            </div>
          ) : null}

          {destinationType === 'fixed_abroad' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Ville
                <input
                  value={destinationCity}
                  onChange={(event) => setDestinationCity(event.target.value)}
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(destinationCity.trim())
                  })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Pays
                <input
                  value={destinationCountry}
                  onChange={(event) => setDestinationCountry(event.target.value)}
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(destinationCountry.trim())
                  })}
                />
              </label>
            </div>
          ) : null}

          {destinationType === 'itinerant' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Libellé itinéraire
                <input
                  value={destinationItineraryLabel}
                  onChange={(event) => setDestinationItineraryLabel(event.target.value)}
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(destinationItineraryLabel.trim())
                  })}
                  placeholder="Ex. Circuit andalou ou Tour de Bretagne"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Pays du circuit
                <input
                  value={destinationCountriesText}
                  onChange={(event) => setDestinationCountriesText(event.target.value)}
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(destinationCountriesText.trim())
                  })}
                  placeholder="Ex. Espagne, Portugal"
                />
              </label>
            </div>
          ) : null}

          {!destinationType ? (
            <div className="grid gap-4 md:grid-cols-2">
              <GoogleMapsCityInput
                key={draftId}
                name="location_text"
                label="Ville / lieu"
                value={locationText}
                onValueChange={setLocationText}
                showApiHint
                inputClassName={draftReviewControlClass({
                  required: false,
                  filled: Boolean(locationText.trim()),
                  omitOuterMargin: true
                })}
              />
              <label className="block text-sm font-medium text-slate-700">
                Région
                <input
                  id="draft-region-input"
                  value={regionText}
                  onChange={(event) => setRegionText(event.target.value)}
                  className={draftReviewControlClass({
                    required: false,
                    filled: Boolean(regionText.trim())
                  })}
                />
              </label>
            </div>
          ) : null}
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Résumé
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            className={draftReviewControlClass({
              required: false,
              filled: Boolean(summary.trim())
            })}
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
            className={draftReviewControlClass({
              required: false,
              filled: Boolean(description.trim())
            })}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Programme
          <textarea
            value={programText}
            onChange={(event) => setProgramText(event.target.value)}
            rows={6}
            className={draftReviewControlClass({
              required: false,
              filled: Boolean(programText.trim())
            })}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Encadrement
          <textarea
            value={supervisionText}
            onChange={(event) => setSupervisionText(event.target.value)}
            rows={5}
            className={draftReviewControlClass({
              required: false,
              filled: Boolean(supervisionText.trim())
            })}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Documents obligatoires
          <textarea
            value={requiredDocumentsText}
            onChange={(event) => setRequiredDocumentsText(event.target.value)}
            rows={5}
            className={draftReviewControlClass({
              required: false,
              filled: Boolean(requiredDocumentsText.trim())
            })}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Transport
          <textarea
            value={transportText}
            onChange={(event) => setTransportText(event.target.value)}
            rows={4}
            className={draftReviewControlClass({
              required: false,
              filled: Boolean(transportText.trim())
            })}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Préciser en phrases si le trajet se fait en train, en train puis en car, en car, en avion ou sur place.
          </span>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="block text-sm font-medium text-slate-700">
            <span>Catégories (multi-sélection)</span>
            <div
              className={cn(
                'mt-2 grid gap-2 sm:grid-cols-2',
                draftReviewFieldGroupClass({
                  required: false,
                  filled: selectedCategories.length > 0,
                  hasError: Boolean(fieldErrors.categories)
                })
              )}
            >
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
              className={draftReviewControlClass({
                required: false,
                filled: Boolean(agesText.trim()),
                hasError: Boolean(fieldErrors.ages)
              })}
            />
            {fieldErrors.ages && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.ages}</span>}
          </label>
        </div>

            </>
          )}

        {effectiveStep === 'seo' && (
        <section
          className={cn(
            'space-y-4 rounded-2xl',
            draftReviewSectionClass({
              required: false,
              satisfied:
                Boolean(seoPrimaryKeyword.trim()) ||
                Boolean(seoTitle.trim()) ||
                Boolean(seoMetaDescription.trim())
            })
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">SEO du brouillon</h3>
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
              onBlur={() => setSeoPrimaryKeyword((current) => sanitizeSeoPrimaryKeyword(current))}
              className={draftReviewControlClass({
                required: false,
                filled: Boolean(seoPrimaryKeyword.trim())
              })}
              placeholder="Ex. colonie de vacances surf à Biarritz"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Titre SEO
              <input
                value={seoTitle}
                onChange={(event) => setSeoTitle(event.target.value)}
                className={draftReviewControlClass({
                  required: false,
                  filled: Boolean(seoTitle.trim())
                })}
                placeholder="Laisser vide pour fallback automatique"
              />
              <span className="mt-1 block text-xs text-slate-500">
                {seoGooglePreview.title.length} caractères (recommandé {SEO_TITLE_RECOMMENDED_MIN} à{' '}
                {SEO_TITLE_RECOMMENDED_MAX})
              </span>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Méta description
              <textarea
                value={seoMetaDescription}
                onChange={(event) => setSeoMetaDescription(event.target.value)}
                rows={3}
                className={draftReviewControlClass({
                  required: false,
                  filled: Boolean(seoMetaDescription.trim())
                })}
                placeholder="Laisser vide pour fallback automatique"
              />
              <span className="mt-1 block text-xs text-slate-500">
                {seoGooglePreview.description.length} caractères (recommandé {SEO_META_RECOMMENDED_MIN} à{' '}
                {SEO_META_RECOMMENDED_MAX})
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aperçu Google</p>
            <p className="mt-2 text-lg font-medium text-blue-700">{seoGooglePreview.title}</p>
            <p className="text-sm text-emerald-700">{seoGooglePreview.canonicalPath}</p>
            <p className="mt-2 text-sm text-slate-700">{seoGooglePreview.description}</p>
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

          <button
            type="button"
            onClick={() => setSeoAdvancedVisible((current) => !current)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            {seoAdvancedVisible ? 'Masquer les options SEO avancées' : 'Afficher les options SEO avancées'}
          </button>

          {seoAdvancedVisible ? (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Mots-clés secondaires</p>
                <div className="flex flex-wrap gap-2">
                  {seoSecondaryKeywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
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

              {seoSuggestions.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Suggestions intelligentes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {seoSuggestions.map((suggestion) => (
                      <div
                        key={suggestion}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
                      >
                        <p className="font-medium text-slate-800">{suggestion}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSeoPrimaryKeyword(sanitizeSeoPrimaryKeyword(suggestion))}
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
              ) : null}

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
                      className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
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

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">Score SEO</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{seoScore ?? '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
            </div>
          ) : null}
        </section>
        )}

        {effectiveStep === 'sessions' && (
          variant === 'published' && publishedSessionsStep ? (
            <>{publishedSessionsStep}</>
          ) : (
            <DraftSessionsEditor
              value={sessionsList}
              onChange={setSessionsList}
              error={fieldErrors.sessions_json}
              containerClassName={draftReviewSectionClass({
                required: false,
                satisfied: sessionsList.length > 0,
                hasError: Boolean(fieldErrors.sessions_json)
              })}
            />
          )
        )}

        {effectiveStep === 'options' && (
          <>
        {insuranceSectionVisible ? (
          <DraftInsuranceOptionsEditor
            value={insuranceOptionsList}
            onChange={(next) => {
              setInsuranceOptionsList(next);
              if (next.length === 0) setInsuranceSectionVisible(false);
            }}
            error={fieldErrors.extra_options_json}
            containerClassName={draftReviewSectionClass({
              required: false,
              satisfied: insuranceOptionsList.length > 0,
              hasError: Boolean(fieldErrors.extra_options_json)
            })}
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

        {extrasSectionVisible ? (
          <DraftExtraOptionsEditor
            value={extraOptionsList}
            onChange={(next) => {
              setExtraOptionsList(next);
              if (next.length === 0) setExtrasSectionVisible(false);
            }}
            error={fieldErrors.extra_options_json}
            containerClassName={draftReviewSectionClass({
              required: false,
              satisfied: extraOptionsList.length > 0,
              hasError: Boolean(fieldErrors.extra_options_json)
            })}
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
          </>
        )}

        {effectiveStep === 'transports' && (
        <DraftTransportOptionsEditor
          value={transportOptionsList}
          onChange={setTransportOptionsList}
          error={fieldErrors.transport_options_json}
          sessionsJson={sessionsList}
          transportMode={transportMode}
          onTransportModeChange={setTransportMode}
          transportModeError={fieldErrors.transport_mode}
          containerClassName={draftReviewSectionClass({
            required: false,
            satisfied:
              transportOptionsList.length > 0 ||
              Boolean(transportMode && transportMode !== 'À préciser'),
            hasError: Boolean(
              fieldErrors.transport_options_json || fieldErrors.transport_mode
            )
          })}
        />
        )}

        {effectiveStep === 'partenaires' && (
          <section
            className={cn(
              'space-y-3',
              draftReviewSectionClass({
                required: false,
                satisfied: Boolean(partnerDiscountPercent.trim()),
                hasError: Boolean(fieldErrors.partner_discount_percent)
              })
            )}
          >
            <div>
              <h3 className="text-base font-semibold text-slate-900">Partenaires</h3>
              <p className="mt-1 text-sm text-slate-600">
                Réduction accordée aux collectivités partenaires pour ce séjour (facultatif).
              </p>
            </div>
            <label className="block max-w-md">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Remise partenaire concédée (%)
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                inputMode="decimal"
                value={partnerDiscountPercent}
                onChange={(event) => setPartnerDiscountPercent(event.target.value)}
                placeholder="Ex. 5"
                className={draftReviewControlClass({
                  required: false,
                  filled: Boolean(partnerDiscountPercent.trim()),
                  hasError: Boolean(fieldErrors.partner_discount_percent)
                })}
              />
              {fieldErrors.partner_discount_percent ? (
                <span className="mt-1 block text-xs text-rose-600">{fieldErrors.partner_discount_percent}</span>
              ) : (
                <span className="mt-2 block text-xs text-slate-500">
                  Laissez vide si aucune réduction n&apos;est prévue pour les partenaires.
                </span>
              )}
            </label>
          </section>
        )}

        {effectiveStep === 'photos' && (
          <>
        <div
          className={cn(
            'relative space-y-2 p-3 pr-14',
            draftReviewSectionClass({
              required: false,
              satisfied: imagePreviewUrls.length > 0
            })
          )}
        >
          <button
            type="button"
            onClick={addImageFromPrompt}
            className="absolute right-2 top-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-orange-400/90 bg-white text-orange-600 shadow-sm transition hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
            aria-label="Ajouter une image par URL"
          >
            <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </button>
          <p className="text-sm font-medium text-slate-700">Images du séjour</p>
          <p className="text-xs text-slate-500">
            Cliquez sur une vignette pour l&apos;agrandir. Ajoutez une URL avec le bouton d&apos;ajout.
          </p>
          {imagePreviewUrls.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune image — utilisez le bouton rond pour coller une URL https.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {imagePreviewUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="relative">
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(index)}
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

        <div
          className={cn(
            'relative space-y-2 p-3 pr-14',
            draftReviewSectionClass({
              required: false,
              satisfied: videoEntries.some((e) => e.url.trim().length > 0)
            })
          )}
        >
          <button
            type="button"
            onClick={addVideoFromPrompt}
            className="absolute right-2 top-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-orange-400/90 bg-white text-orange-600 shadow-sm transition hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
            aria-label="Ajouter une vidéo par URL"
          >
            <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </button>
          <p className="text-sm font-medium text-slate-700">Liens vidéo repérés</p>
          <p className="text-xs text-slate-500">
            Liens cliquables (YouTube, Vimeo, etc.), y compris extraits d&apos;une page (ex. liens dans du
            JavaScript). À droite de chaque lien, choisissez l&apos;onglet fiche publique :{' '}
            <strong>Séjour</strong> ou <strong>Hébergement</strong>.
          </p>
          {videoEntries.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune vidéo — ajoutez un lien avec le bouton d&apos;ajout.</p>
          ) : (
            <div className="space-y-2">
              {videoEntries.map((entry, index) => (
                <div
                  key={`video-${index}`}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <input
                    type="url"
                    value={entry.url}
                    onChange={(event) => {
                      const value = event.target.value;
                      setVideoEntries((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, url: value } : item
                        )
                      );
                    }}
                    className={cn(
                      draftReviewControlClass({
                        required: false,
                        filled: Boolean(entry.url.trim()),
                        omitOuterMargin: true
                      }),
                      'min-w-0 flex-1 font-mono text-xs'
                    )}
                    spellCheck={false}
                    aria-label={`URL de la vidéo ${index + 1}`}
                  />
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <div
                      className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5"
                      role="group"
                      aria-label="Emplacement sur la fiche publique"
                    >
                      <button
                        type="button"
                        onClick={() => setVideoEntryScope(index, 'stay')}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                          entry.scope === 'stay'
                            ? 'bg-white text-orange-800 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        Séjour
                      </button>
                      <button
                        type="button"
                        onClick={() => setVideoEntryScope(index, 'accommodation')}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-semibold transition',
                          entry.scope === 'accommodation'
                            ? 'bg-white text-orange-800 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        Hébergement
                      </button>
                    </div>
                    {/^https?:\/\//i.test(entry.url.trim()) ? (
                      <a
                        href={entry.url.trim()}
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
          </>
        )}

        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goDraftPrev}
                disabled={accommodationGateClosed || effectiveStepIndex === 0}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Précédent
              </button>
              {effectiveStep !== 'seo' && (
                <button
                  type="button"
                  onClick={() => {
                    if (accommodationGateClosed) {
                      setFieldErrors({});
                      setGlobalError(null);
                    }
                    goDraftNext();
                  }}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  {accommodationGateClosed ? 'Continuer' : 'Suivant'}
                </button>
              )}
              <span className="text-xs font-medium text-slate-500">
                Étape {Math.max(1, effectiveStepIndex + 1)} / {visibleReviewSteps.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => submit('save')}
                disabled={isSubmitting || isGeneratingSeo}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
              >
                {isPublishedVariant ? 'Enregistrer' : 'Enregistrer le brouillon'}
              </button>
              {!isPublishedVariant ? (
                <button
                  type="button"
                  onClick={() => submit('validate')}
                  disabled={!publishAllowed || isSubmitting || isGeneratingSeo}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Valider et publier
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu des images du séjour"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setLightboxIndex(null);
            }}
            className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-900 shadow transition hover:bg-white"
            aria-label="Fermer l'aperçu"
          >
            <X className="h-5 w-5" />
          </button>

          {imagePreviewUrls.length > 1 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setLightboxIndex((current) => {
                  if (current === null) return current;
                  return (current - 1 + imagePreviewUrls.length) % imagePreviewUrls.length;
                });
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-900 shadow transition hover:bg-white"
              aria-label="Image précédente"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}

          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />

          {imagePreviewUrls.length > 1 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setLightboxIndex((current) => {
                  if (current === null) return current;
                  return (current + 1) % imagePreviewUrls.length;
                });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-900 shadow transition hover:bg-white"
              aria-label="Image suivante"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
