import {
  buildAccommodationAddressLabel,
  extractAccommodationLocationMeta
} from '@/lib/accommodation-location';
import { draftSessionStableKey } from '@/lib/draft-session-keys';
import { readDraftDestinationFields } from '@/lib/stay-draft-destination';
import { parseTransportOptionsFromJson, type ParsedTransportOption } from '@/lib/publish-stay-draft';
import { extractGoogleMapsEmbedSrcFromInput } from '@/lib/google-maps-iframe';
import { isVideoUrlCandidate } from '@/lib/stay-draft-url-extract';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/supabase';
import type { Stay, StayAccommodation, StaySessionOption, StayTransportOption } from '@/types/stay';
import { slugify } from '@/lib/utils';

type StayDraftRow = Pick<
  Database['public']['Tables']['stay_drafts']['Row'],
  | 'id'
  | 'title'
  | 'summary'
  | 'description'
  | 'location_text'
  | 'region_text'
  | 'ages'
  | 'sessions_json'
  | 'images'
  | 'raw_payload'
  | 'program_text'
  | 'activities_text'
  | 'transport_text'
  | 'transport_mode'
  | 'transport_options_json'
  | 'accommodations_json'
  | 'supervision_text'
  | 'required_documents_text'
>;

const DAY_MS = 86_400_000;

const LIVE_TRANSPORT_MODES = new Set([
  'Aller/Retour similaire',
  'Aller/Retour différencié',
  'Sans transport'
]);

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toNumberOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asSessionRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row)
  );
}

function deriveDaysFromSessionRow(row: Record<string, unknown>): number | null {
  const durationDays = row.duration_days;
  if (typeof durationDays === 'number' && durationDays > 0) return Math.round(durationDays);
  const parsedDuration = Number(durationDays);
  if (Number.isFinite(parsedDuration) && parsedDuration > 0) return Math.round(parsedDuration);

  const start = normalizeString(row.start_date);
  const end = normalizeString(row.end_date);
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.round((endMs - startMs) / DAY_MS)) + 1;
}

export function formatDurationFromDraftSessions(sessions: unknown): string {
  const rows = asSessionRows(sessions);
  if (rows.length === 0) return 'Durée à venir';

  const days = rows
    .map((row) => deriveDaysFromSessionRow(row))
    .filter((value): value is number => value !== null && value > 0);

  if (days.length === 0) return 'Durée à venir';

  const min = Math.min(...days);
  const max = Math.max(...days);
  if (min === max) return min === 1 ? '1 jour' : `${min} jours`;
  return `${min} à ${max} jours`;
}

function formatAgeRange(ages: unknown): string {
  if (!Array.isArray(ages)) return 'Tous âges';
  const numericAges = ages
    .map((age) => Number(age))
    .filter((age) => Number.isFinite(age))
    .sort((a, b) => a - b);
  if (numericAges.length === 0) return 'Tous âges';
  if (numericAges.length === 1) return `${numericAges[0]} ans`;
  return `${numericAges[0]}-${numericAges[numericAges.length - 1]} ans`;
}

function normalizeTransportMode(
  draftMode: string | null,
  hasTransportText: boolean,
  transportOptions: ParsedTransportOption[]
): string {
  const normalized = normalizeString(draftMode);
  if (normalized && LIVE_TRANSPORT_MODES.has(normalized)) {
    return normalized;
  }

  if (transportOptions.length > 0) {
    const hasOneWayOption = transportOptions.some(
      (option) => !option.departureCity || !option.returnCity
    );
    return hasOneWayOption ? 'Aller/Retour différencié' : 'Aller/Retour similaire';
  }

  if (hasTransportText) {
    return 'Aller/Retour similaire';
  }

  return 'Sans transport';
}

function resolveTransportSource(draft: StayDraftRow, rawPayload: Record<string, unknown>): Json | null {
  const rawAiExtracted = toRecord(rawPayload.ai_extracted);
  return (
    (rawPayload.transport_variants as Json | undefined) ??
    (rawPayload.transport_price_debug as Json | undefined) ??
    (rawPayload.transport_matrix as Json | undefined) ??
    draft.transport_options_json ??
    (rawAiExtracted.transport_options_json as Json | undefined) ??
    null
  );
}

function resolveAccommodationSource(draft: StayDraftRow, rawPayload: Record<string, unknown>): Json | null {
  const rawAiExtracted = toRecord(rawPayload.ai_extracted);
  return draft.accommodations_json ?? (rawAiExtracted.accommodations_json as Json | undefined) ?? null;
}

function readDraftAccommodationPreviewId(rawPayload: Record<string, unknown>): string | null {
  const preview = rawPayload.draft_accommodation_preview;
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) return null;
  const id = (preview as Record<string, unknown>).accommodation_id;
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function mapTransportOptionsForSession(
  sessionIndex: number,
  sessionRows: Record<string, unknown>[],
  parsedOptions: ParsedTransportOption[]
): StayTransportOption[] {
  const sessionKey = draftSessionStableKey(sessionRows[sessionIndex] ?? {}, sessionIndex);
  const output: StayTransportOption[] = [];

  parsedOptions.forEach((option, optionIndex) => {
    const excluded = new Set(option.excludedSessionKeys ?? []);
    if (excluded.has(sessionKey)) return;

    output.push({
      id: `draft-transport-${sessionIndex + 1}-${optionIndex + 1}`,
      departureCity: option.departureCity,
      returnCity: option.returnCity,
      amount: option.amountCents / 100
    });
  });

  return output;
}

function buildPreviewSessions(
  sessions: unknown,
  parsedTransportOptions: ParsedTransportOption[]
): StaySessionOption[] {
  const rows = asSessionRows(sessions);
  return rows
    .map<StaySessionOption | null>((row, index) => {
      const start = normalizeString(row.start_date);
      const end = normalizeString(row.end_date);
      if (!start || !end) return null;

      return {
        id: `draft-session-${index + 1}`,
        startDate: start,
        endDate: end,
        price: toNumberOrNull(row.price),
        status: normalizeString(row.availability).toLowerCase() === 'full' ? 'FULL' : 'OPEN',
        transportOptions: mapTransportOptionsForSession(index, rows, parsedTransportOptions)
      };
    })
    .filter((row): row is StaySessionOption => row !== null);
}

function mapAccommodationJsonToStay(
  value: Json | null,
  locationHint: string | null
): StayAccommodation | null {
  const object = toRecord(value);
  if (Object.keys(object).length === 0) return null;

  const title =
    normalizeString(object.title) ||
    normalizeString(object.nom) ||
    normalizeString(object.name) ||
    normalizeString(object.nom_hebergement) ||
    'Hébergement';

  const description = normalizeString(object.description);
  const bedInfo = normalizeString(object.bed_info ?? object.sleeping_info);
  const bathroomInfo = normalizeString(object.bathroom_info ?? object.sanitary_info);
  const cateringInfo = normalizeString(object.catering_info ?? object.food_info);
  const accessibilityInfo = normalizeString(object.accessibility_info ?? object.pmr_info);

  const accommodationType =
    normalizeString(object.accommodation_type) ||
    (Array.isArray(object.accommodation_types)
      ? normalizeString(object.accommodation_types.find((item) => typeof item === 'string'))
      : '') ||
    null;

  const addressText = normalizeString(object.address_text ?? object.street ?? object.street_address) || null;
  const postalCode = normalizeString(object.postal_code ?? object.postalCode) || null;
  const city = normalizeString(object.city ?? object.location_city ?? locationHint) || null;
  const departmentCode = normalizeString(object.department_code ?? object.location_department_code) || null;
  const regionText = normalizeString(object.region_text ?? object.region) || null;
  const country = normalizeString(object.country ?? object.location_country) || null;

  const locationMeta = extractAccommodationLocationMeta(description, {
    addressText,
    postalCode,
    city,
    departmentCode,
    regionText,
    country
  });

  const imageUrls = Array.from(
    new Set([
      ...readStringArray(object.image_urls),
      ...readStringArray(object.images),
      ...readStringArray(object.photos)
    ].filter((url) => !isVideoUrlCandidate(url)))
  );

  const videoUrls = Array.from(
    new Set([
      ...readStringArray(object.video_urls),
      ...readStringArray(object.videos)
    ].filter((url) => isVideoUrlCandidate(url)))
  );

  const mapEmbedSrc =
    extractGoogleMapsEmbedSrcFromInput(
      normalizeString(object.map_iframe_html ?? object.map_embed_src ?? object.google_maps_embed)
    ) || null;

  return {
    id: 'draft-accommodation',
    name: title,
    accommodationType,
    locationLabel:
      buildAccommodationAddressLabel({
        postalCode,
        city,
        departmentCode,
        regionText,
        country
      }) ?? locationMeta.locationLabel,
    mapEmbedSrc,
    addressText,
    postalCode,
    city,
    departmentCode,
    regionText,
    country,
    description: locationMeta.description ?? description,
    bedInfo,
    bathroomInfo,
    cateringInfo,
    accessibilityInfo,
    imageUrls,
    videoUrls: videoUrls.length > 0 ? videoUrls : undefined
  };
}

async function loadPreviewAccommodations(
  draft: StayDraftRow,
  organizerId: string,
  rawPayload: Record<string, unknown>
): Promise<StayAccommodation[]> {
  const previewAccommodationId = readDraftAccommodationPreviewId(rawPayload);
  const supabase = getServerSupabaseClient();

  if (previewAccommodationId) {
    const { data: accommodation } = await supabase
      .from('accommodations')
      .select(
        'id,name,description,bed_info,bathroom_info,catering_info,accessibility_info,accommodation_type,address_text,postal_code,city,department_code,region_text,country,map_iframe_html,ai_extracted_data'
      )
      .eq('id', previewAccommodationId)
      .eq('organizer_id', organizerId)
      .maybeSingle();

    if (accommodation) {
      const { data: mediaRows } = await supabase
        .from('accommodation_media')
        .select('url')
        .eq('accommodation_id', accommodation.id)
        .order('position', { ascending: true });

      const mediaUrls = (mediaRows ?? [])
        .map((row) => row.url?.trim())
        .filter((url): url is string => Boolean(url));

      const imageUrls = Array.from(
        new Set(mediaUrls.filter((url) => !isVideoUrlCandidate(url)))
      );
      const videoUrls = Array.from(
        new Set(mediaUrls.filter((url) => isVideoUrlCandidate(url)))
      );

      const locationMeta = extractAccommodationLocationMeta(accommodation.description, {
        addressText: accommodation.address_text,
        postalCode: accommodation.postal_code,
        city: accommodation.city,
        departmentCode: accommodation.department_code,
        regionText: accommodation.region_text,
        country: accommodation.country
      });

      return [
        {
          id: accommodation.id,
          name: accommodation.name,
          accommodationType: accommodation.accommodation_type,
          mapEmbedSrc: extractGoogleMapsEmbedSrcFromInput(accommodation.map_iframe_html ?? ''),
          locationLabel:
            buildAccommodationAddressLabel({
              postalCode: accommodation.postal_code,
              city: accommodation.city,
              departmentCode: accommodation.department_code,
              regionText: accommodation.region_text,
              country: accommodation.country
            }) ?? locationMeta.locationLabel,
          addressText: accommodation.address_text,
          postalCode: accommodation.postal_code,
          city: accommodation.city,
          departmentCode: accommodation.department_code,
          regionText: accommodation.region_text,
          country: accommodation.country,
          description: locationMeta.description ?? accommodation.description ?? '',
          bedInfo: accommodation.bed_info?.trim() ?? '',
          bathroomInfo: accommodation.bathroom_info?.trim() ?? '',
          cateringInfo: accommodation.catering_info?.trim() ?? '',
          accessibilityInfo: accommodation.accessibility_info?.trim() ?? '',
          imageUrls,
          videoUrls: videoUrls.length > 0 ? videoUrls : undefined
        }
      ];
    }
  }

  const accommodationSource = resolveAccommodationSource(draft, rawPayload);
  const mapped = mapAccommodationJsonToStay(accommodationSource, draft.location_text);
  return mapped ? [mapped] : [];
}

function readGalleryImages(images: Json | null, rawPayload: Record<string, unknown>): string[] {
  const fromDraft = readStringArray(images);
  const fromPayload = readStringArray(rawPayload.import_image_urls ?? rawPayload.image_urls);
  return Array.from(new Set([...fromDraft, ...fromPayload]));
}

function readVideoUrls(rawPayload: Record<string, unknown>): string[] {
  return Array.from(
    new Set([
      ...readStringArray(rawPayload.video_urls),
      ...readStringArray(rawPayload.stay_video_urls),
      ...readStringArray(rawPayload.accommodation_video_urls)
    ].filter((url) => isVideoUrlCandidate(url)))
  );
}

export async function buildStayPreviewFromDraft(draft: StayDraftRow, organizerId: string): Promise<Stay> {
  const rawPayload = toRecord(draft.raw_payload);
  const destination = readDraftDestinationFields(rawPayload);
  const title = normalizeString(draft.title) || 'Séjour sans titre';
  const slug = slugify(title) || `draft-${draft.id}`;
  const locationLabel =
    normalizeString(destination.destinationCity) ||
    normalizeString(destination.destinationCountry) ||
    normalizeString(draft.location_text) ||
    normalizeString(draft.region_text) ||
    'Lieu à préciser';

  const ageRangeLabel = formatAgeRange(draft.ages);
  const ageRangeMatch = ageRangeLabel.match(/(\d+)(?:-(\d+))?/);
  const ageMin = ageRangeMatch?.[1] ? Number(ageRangeMatch[1]) : null;
  const ageMax = ageRangeMatch?.[2] ? Number(ageRangeMatch[2]) : ageMin;

  const durationLabel = formatDurationFromDraftSessions(draft.sessions_json);
  const galleryImages = readGalleryImages(draft.images, rawPayload);
  const coverUrl = galleryImages[0] ?? null;

  const transportSource = resolveTransportSource(draft, rawPayload);
  const parsedTransportOptions = parseTransportOptionsFromJson(transportSource);
  const transportMode = normalizeTransportMode(
    draft.transport_mode,
    Boolean(normalizeString(draft.transport_text)),
    parsedTransportOptions
  );
  const previewSessions = buildPreviewSessions(draft.sessions_json, parsedTransportOptions);
  const accommodations = await loadPreviewAccommodations(draft, organizerId, rawPayload);
  const videoUrls = readVideoUrls(rawPayload);

  const accommodationDescription = accommodations
    .map((item) => [item.name, item.description].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');

  return {
    id: draft.id,
    title,
    slug,
    canonicalSlug: slug,
    legacySlugs: [],
    summary: normalizeString(draft.summary),
    description: normalizeString(draft.description),
    seasonId: 'draft',
    seasonName: '',
    organizerId,
    organizer: {
      name: 'Organisateur',
      website: '',
      slug: undefined,
      logoUrl: undefined
    },
    location: locationLabel,
    displayLocation: locationLabel,
    region: normalizeString(draft.region_text),
    country: destination.destinationCountry ?? '',
    destinationType: destination.destinationType ?? null,
    destinationCity: destination.destinationCity,
    destinationPostalCode: destination.destinationPostalCode,
    destinationDepartmentCode: destination.destinationDepartmentCode,
    destinationRegion: destination.destinationRegion,
    destinationCountry: destination.destinationCountry,
    destinationItineraryLabel: destination.destinationItineraryLabel,
    destinationCountries: destination.destinationCountries,
    ageMin,
    ageMax,
    ageRange: ageRangeLabel,
    duration: durationLabel,
    priceFrom: null,
    period: [],
    categories: [],
    highlights: [],
    activitiesText: normalizeString(draft.activities_text),
    programText: normalizeString(draft.program_text),
    transportText: normalizeString(draft.transport_text),
    coverImage: coverUrl ?? undefined,
    galleryImages,
    videoUrls,
    filters: {
      categories: [],
      audiences: [],
      durations: [],
      periods: [],
      priceRange: null,
      transport: []
    },
    bookingOptions: {
      transportMode,
      sessions: previewSessions,
      insuranceOptions: [],
      extraOptions: []
    },
    centerLocations: [],
    accommodations,
    rawContext: {
      presentation: normalizeString(draft.description),
      activites: normalizeString(draft.activities_text),
      programme: normalizeString(draft.program_text),
      hebergement: accommodationDescription,
      encadrement: normalizeString(draft.supervision_text),
      documents_obligatoires: normalizeString(draft.required_documents_text),
      transport: normalizeString(draft.transport_text),
      region: normalizeString(draft.region_text),
      destination_type: destination.destinationType ?? '',
      destination_region: destination.destinationRegion ?? '',
      destination_country: destination.destinationCountry ?? '',
      destination_itinerary_label: destination.destinationItineraryLabel ?? ''
    },
    updatedAt: new Date().toISOString()
  };
}
