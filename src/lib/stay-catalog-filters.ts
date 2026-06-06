import { FILTER_LABELS } from '@/lib/constants';
import { getStayDisplayedPrice } from '@/lib/stay-partner-pricing';
import {
  buildStayDestinationSearchText,
  buildStayPrimaryDestinationFilterLabel
} from '@/lib/stay-destination';
import { staySessionsAppearFullyBooked } from '@/lib/stay-catalog-availability';
import { normalizePaymentAids, paymentAidLabel, type PaymentAidValue } from '@/lib/payment-aids';
import {
  canonicalTransportCityKey,
  formatTransportCityLabel,
  normalizeTransportCityRaw
} from '@/lib/transport-city-normalization';
import { slugify } from '@/lib/utils';
import type { Stay } from '@/types/stay';

export type StayAgeBandValue = '6-9' | '10-13' | '14-17' | '18-25';

export type StayCatalogFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type StayCatalogAgeFilterOption = {
  value: StayAgeBandValue;
  label: string;
  count: number;
};

export type StayCatalogFilterOptions = {
  seasons: StayCatalogFilterOption[];
  categories: StayCatalogFilterOption[];
  ageBands: StayCatalogAgeFilterOption[];
  destinationTypes: StayCatalogFilterOption[];
  destinations: StayCatalogFilterOption[];
  departureCities: StayCatalogFilterOption[];
  paymentAids: StayCatalogFilterOption[];
  organizers: StayCatalogFilterOption[];
};

export type StayCatalogFilterState = {
  q: string;
  seasonIds: string[];
  categories: string[];
  ageBands: StayAgeBandValue[];
  destinationTypes: string[];
  destinations: string[];
  departureCities: string[];
  paymentAids: PaymentAidValue[];
  organizerIds: string[];
  ageMin: number | null;
  ageMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
};

export const STAY_CATALOG_SORT_OPTIONS = [
  { value: 'random', label: 'Aléatoire' },
  { value: 'price-asc', label: 'Tarif croissant' },
  { value: 'price-desc', label: 'Tarif décroissant' }
] as const;

export type StayCatalogSortValue = (typeof STAY_CATALOG_SORT_OPTIONS)[number]['value'];

export const DEFAULT_STAY_CATALOG_SORT: StayCatalogSortValue = 'random';

type AgeBand = {
  value: StayAgeBandValue;
  label: string;
  min: number;
  max: number;
};

type AgeBounds = {
  min: number;
  max: number;
};

const AGE_BANDS: AgeBand[] = [
  { value: '6-9', label: '6-9 ans', min: 6, max: 9 },
  { value: '10-13', label: '10-13 ans', min: 10, max: 13 },
  { value: '14-17', label: '14-17 ans', min: 14, max: 17 },
  { value: '18-25', label: '18-25 ans', min: 18, max: 25 }
];

const SEASON_ORDER = ['hiver', 'printemps', 'ete', 'automne', 'toussaint'];
const CATEGORY_LABELS = FILTER_LABELS.categories as Record<string, string>;
const LEGACY_AGE_ALIAS: Record<string, StayAgeBandValue> = {
  '6-9': '6-9',
  '10-12': '10-13',
  '10-13': '10-13',
  '13-15': '14-17',
  '14-17': '14-17',
  '16-17': '14-17',
  '18-25': '18-25'
};
const STAY_CATALOG_SORT_VALUES = new Set<StayCatalogSortValue>(
  STAY_CATALOG_SORT_OPTIONS.map((option) => option.value)
);
const SEARCH_STOP_WORDS = new Set([
  'a',
  'au',
  'aux',
  'de',
  'des',
  'du',
  'd',
  'la',
  'le',
  'les',
  'un',
  'une',
  'en',
  'et',
  'ou',
  'pour',
  'avec',
  'sur',
  'dans',
  'colonie',
  'colonies',
  'vacance',
  'vacances',
  'sejour',
  'sejours'
]);
type SearchIndexedStay = Stay & { _searchText: string; _locationText: string };
export type StaySearchQuery = {
  tokens: string[];
  locationIntent: string | null;
};

export const EMPTY_STAY_CATALOG_FILTERS: StayCatalogFilterState = {
  q: '',
  seasonIds: [],
  categories: [],
  ageBands: [],
  destinationTypes: [],
  destinations: [],
  departureCities: [],
  paymentAids: [],
  organizerIds: [],
  ageMin: null,
  ageMax: null,
  priceMin: null,
  priceMax: null
};

function cleanText(value: string | null | undefined) {
  return (value ?? '').trim();
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function uniq<TValue>(values: TValue[]) {
  return Array.from(new Set(values));
}

function fnv1aHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function isFinitePositivePrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function stayPriceForSort(stay: Stay) {
  const displayedPrice = getStayDisplayedPrice(stay);
  return isFinitePositivePrice(displayedPrice) ? displayedPrice : null;
}

function compareFallbackStable(left: Stay, right: Stay) {
  const titleDelta = compareLabel(left.title, right.title);
  if (titleDelta !== 0) return titleDelta;
  return left.id.localeCompare(right.id, 'fr', { sensitivity: 'base' });
}

function toDestinationValue(label: string) {
  const candidate = slugify(label);
  if (candidate) return candidate;
  return normalizeCatalogText(label).replace(/\s+/g, '-');
}

function compareLabel(left: string, right: string) {
  return left.localeCompare(right, 'fr', { sensitivity: 'base' });
}

function seasonRank(label: string) {
  const normalized = normalizeCatalogText(label);
  const index = SEASON_ORDER.findIndex((value) => normalized.includes(value));
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function getCategoryLabel(value: string) {
  const direct = CATEGORY_LABELS[value];
  if (direct) return direct;
  const title = value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(' ');
  return title || value;
}

function extractStayAgeBounds(stay: Stay): AgeBounds | null {
  const rawMin = typeof stay.ageMin === 'number' && Number.isFinite(stay.ageMin) ? stay.ageMin : null;
  const rawMax = typeof stay.ageMax === 'number' && Number.isFinite(stay.ageMax) ? stay.ageMax : null;

  if (rawMin != null && rawMax != null) {
    return { min: Math.min(rawMin, rawMax), max: Math.max(rawMin, rawMax) };
  }

  if (rawMin != null) {
    return { min: rawMin, max: 25 };
  }

  if (rawMax != null) {
    return { min: 3, max: rawMax };
  }

  const ageRangeText = typeof stay.ageRange === 'string' ? stay.ageRange : '';
  const numbers = (ageRangeText.match(/\d{1,2}/g) ?? [])
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));

  if (numbers.length === 0) return null;
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0] };

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers)
  };
}

function agesOverlap(left: AgeBounds, right: AgeBounds) {
  return left.min <= right.max && left.max >= right.min;
}

function stayDestinationLabel(stay: Stay) {
  return buildStayPrimaryDestinationFilterLabel({
    destinationType: stay.destinationType,
    destinationRegion: stay.destinationRegion,
    destinationCountry: stay.destinationCountry,
    destinationItineraryLabel: stay.destinationItineraryLabel,
    locationText: stay.location,
    regionText: stay.region
  });
}

function stayDestinationTypeValue(stay: Stay) {
  const normalized = cleanText(stay.destinationType);
  if (normalized === 'fixed_france' || normalized === 'fixed_abroad' || normalized === 'itinerant') {
    return normalized;
  }
  if (stay.categories.includes('itinerant')) return 'itinerant';
  if (stay.categories.includes('etranger')) return 'fixed_abroad';
  return 'fixed_france';
}

function getStayDepartureCities(stay: Stay) {
  const cityByKey = new Map<string, string>();
  for (const session of stay.bookingOptions?.sessions ?? []) {
    for (const option of session.transportOptions ?? []) {
      const city = normalizeTransportCityRaw(option.departureCity);
      if (!city) continue;
      const key = canonicalTransportCityKey(city);
      if (!key) continue;
      // Keep a stable, readable label while deduping case/accents variants.
      if (!cityByKey.has(key)) cityByKey.set(key, formatTransportCityLabel(city));
    }
  }
  return Array.from(cityByKey.values());
}

function getDestinationTypeLabel(value: string) {
  if (value === 'fixed_france') return 'Séjour fixe en France';
  if (value === 'fixed_abroad') return "Séjour fixe à l'étranger";
  if (value === 'itinerant') return 'Circuit itinérant';
  return value;
}

function readParamList(searchParams: URLSearchParams, keys: string[]) {
  const rawValues: string[] = [];
  for (const key of keys) {
    const all = searchParams.getAll(key);
    all.forEach((item) => {
      item
        .split(',')
        .map((chunk) => normalizeSpaces(chunk))
        .filter(Boolean)
        .forEach((chunk) => rawValues.push(chunk));
    });
  }
  return rawValues;
}

function resolveValuesFromOptions(rawValues: string[], options: StayCatalogFilterOption[]) {
  if (rawValues.length === 0) return [];

  const valueByNormalized = new Map<string, string>();
  const labelByNormalized = new Map<string, string>();

  options.forEach((option) => {
    const normalizedValue = normalizeCatalogText(option.value);
    const normalizedLabel = normalizeCatalogText(option.label);
    if (normalizedValue) valueByNormalized.set(normalizedValue, option.value);
    if (normalizedLabel) labelByNormalized.set(normalizedLabel, option.value);
  });

  const resolved = new Set<string>();

  rawValues.forEach((rawValue) => {
    const normalized = normalizeCatalogText(rawValue);
    if (!normalized) return;

    const directValue = valueByNormalized.get(normalized) ?? labelByNormalized.get(normalized);
    if (directValue) {
      resolved.add(directValue);
    }
  });

  return options.map((option) => option.value).filter((value) => resolved.has(value));
}

function resolveAgeBandValues(rawValues: string[], options: StayCatalogAgeFilterOption[]) {
  if (rawValues.length === 0) return [];

  const available = new Set(options.map((option) => option.value));
  const resolved = new Set<StayAgeBandValue>();

  rawValues.forEach((rawValue) => {
    const normalized = normalizeCatalogText(rawValue);
    if (!normalized) return;

    const fromAlias = LEGACY_AGE_ALIAS[normalized];
    if (fromAlias && available.has(fromAlias)) {
      resolved.add(fromAlias);
      return;
    }

    options.forEach((option) => {
      if (normalizeCatalogText(option.label) === normalized || option.value === normalized) {
        resolved.add(option.value);
      }
    });
  });

  return options.map((option) => option.value).filter((value) => resolved.has(value));
}

function collectLegacyPeriodSeasons(rawValues: string[], options: StayCatalogFilterOption[]) {
  if (rawValues.length === 0) return [];
  const matches = new Set<string>();

  rawValues.forEach((rawValue) => {
    const normalized = normalizeCatalogText(rawValue);
    if (!normalized) return;

    options.forEach((option) => {
      const normalizedLabel = normalizeCatalogText(option.label);
      if (normalizedLabel.includes(normalized) || normalized.includes(normalizedLabel)) {
        matches.add(option.value);
      }
    });
  });

  return options.map((option) => option.value).filter((value) => matches.has(value));
}

function buildStateKeyValues(values: string[]) {
  return [...values].sort(compareLabel).join('|');
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseRangeNumber(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCatalogText(value: string) {
  return normalizeSpaces(
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s-]/g, ' ')
      .toLowerCase()
  );
}

export function getSearchTokens(q: string) {
  return uniq(
    normalizeCatalogText(q)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !SEARCH_STOP_WORDS.has(token))
  );
}

function extractLocationIntent(q: string) {
  const normalized = normalizeCatalogText(q);
  if (!normalized) return null;

  const patterns = [
    /\b(?:pres de|proche de)\s+(.+)$/,
    /\b(?:dans)\s+(?:les|la|le|l)\s+(.+)$/,
    /\b(?:dans)\s+(.+)$/,
    /\b(?:a|au|aux)\s+(.+)$/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const intent = normalizeSpaces(match[1]).replace(/^(les|la|le|l)\s+/, '').trim();
    if (intent.length >= 2) return intent;
  }

  return null;
}

export function parseSearchQuery(q: string): StaySearchQuery {
  return {
    tokens: getSearchTokens(q),
    locationIntent: extractLocationIntent(q)
  };
}

export function buildStaySearchIndex(stay: Stay): SearchIndexedStay {
  const locationText = normalizeCatalogText(
    [
      // Equivalent of requested fields with existing domain model keys.
      stay.destinationCity,
      stay.location,
      stay.displayLocation,
      stay.region,
      stayDestinationLabel(stay),
      stay.destinationRegion,
      stay.destinationCountry
    ]
      .filter(Boolean)
      .join(' ')
  );

  return {
    ...stay,
    _searchText: normalizeCatalogText(
      [
        stay.title,
        stay.summary,
        stay.description,
        stay.location,
        stay.destinationCity,
        stay.region,
        stayDestinationLabel(stay),
        buildStayDestinationSearchText({
          destinationType: stay.destinationType,
          destinationCity: stay.destinationCity,
          destinationPostalCode: stay.destinationPostalCode,
          destinationDepartmentCode: stay.destinationDepartmentCode,
          destinationRegion: stay.destinationRegion,
          destinationCountry: stay.destinationCountry,
          destinationItineraryLabel: stay.destinationItineraryLabel,
          destinationCountries: stay.destinationCountries,
          locationText: stay.location,
          regionText: stay.region
        }),
        stay.activitiesText ?? '',
        stay.programText ?? '',
        stay.transportText ?? '',
        stay.categories.join(' '),
        stay.organizer.name,
        stay.ageRange,
        stay.ageMin != null ? `${stay.ageMin} ans` : '',
        stay.ageMax != null ? `${stay.ageMax} ans` : ''
      ]
        .filter(Boolean)
        .join(' ')
    ),
    _locationText: locationText
  };
}

export function stayCatalogFilterStateKey(state: StayCatalogFilterState) {
  return [
    normalizeCatalogText(state.q),
    buildStateKeyValues(state.seasonIds),
    buildStateKeyValues(state.categories),
    buildStateKeyValues(state.ageBands),
    buildStateKeyValues(state.destinationTypes),
    buildStateKeyValues(state.destinations),
    buildStateKeyValues(state.departureCities),
    buildStateKeyValues(state.paymentAids),
    buildStateKeyValues(state.organizerIds),
    `${state.ageMin ?? ''}-${state.ageMax ?? ''}`,
    `${state.priceMin ?? ''}-${state.priceMax ?? ''}`
  ].join('::');
}

export function countActiveStayCatalogFilters(state: StayCatalogFilterState) {
  const hasQuery = normalizeCatalogText(state.q).length > 0 ? 1 : 0;
  const hasAgeRange = state.ageMin != null || state.ageMax != null ? 1 : 0;
  const hasPriceRange = state.priceMin != null || state.priceMax != null ? 1 : 0;
  return (
    hasQuery +
    state.seasonIds.length +
    state.categories.length +
    state.ageBands.length +
    state.destinationTypes.length +
    state.destinations.length +
    state.departureCities.length +
    state.paymentAids.length +
    state.organizerIds.length +
    hasAgeRange +
    hasPriceRange
  );
}

export function buildStayCatalogFilterOptions(stays: Stay[]): StayCatalogFilterOptions {
  const seasonCounts = new Map<string, { label: string; count: number }>();
  const categoryCounts = new Map<string, { label: string; count: number }>();
  const destinationTypeCounts = new Map<string, { label: string; count: number }>();
  const destinationCounts = new Map<string, { label: string; count: number }>();
  const departureCityCounts = new Map<string, { label: string; count: number }>();
  const paymentAidCounts = new Map<string, { label: string; count: number }>();
  const organizerCounts = new Map<string, { label: string; count: number }>();
  const ageBandCounts = new Map<StayAgeBandValue, number>(
    AGE_BANDS.map((band) => [band.value, 0])
  );

  stays.forEach((stay) => {
    if (stay.seasonId) {
      const current = seasonCounts.get(stay.seasonId);
      if (current) {
        current.count += 1;
      } else {
        seasonCounts.set(stay.seasonId, {
          label: cleanText(stay.seasonName) || 'Saison non précisée',
          count: 1
        });
      }
    }

    uniq((stay.categories ?? []).map((value) => normalizeSpaces(String(value).toLowerCase())))
      .filter(Boolean)
      .forEach((category) => {
        const current = categoryCounts.get(category);
        if (current) {
          current.count += 1;
        } else {
          categoryCounts.set(category, {
            label: getCategoryLabel(category),
            count: 1
          });
        }
      });

    const destinationType = stayDestinationTypeValue(stay);
    const currentDestinationType = destinationTypeCounts.get(destinationType);
    if (currentDestinationType) {
      currentDestinationType.count += 1;
    } else {
      destinationTypeCounts.set(destinationType, {
        label: getDestinationTypeLabel(destinationType),
        count: 1
      });
    }

    const destinationLabel = stayDestinationLabel(stay);
    if (destinationLabel) {
      const destinationValue = toDestinationValue(destinationLabel);
      const current = destinationCounts.get(destinationValue);
      if (current) {
        current.count += 1;
      } else {
        destinationCounts.set(destinationValue, {
          label: destinationLabel,
          count: 1
        });
      }
    }

    getStayDepartureCities(stay).forEach((city) => {
      const key = canonicalTransportCityKey(city);
      if (!key) return;
      const value = toDestinationValue(key);
      const current = departureCityCounts.get(value);
      if (current) {
        current.count += 1;
      } else {
        departureCityCounts.set(value, {
          label: formatTransportCityLabel(city),
          count: 1
        });
      }
    });

    normalizePaymentAids(stay.paymentAids).forEach((aid) => {
      const current = paymentAidCounts.get(aid);
      if (current) {
        current.count += 1;
      } else {
        paymentAidCounts.set(aid, { label: paymentAidLabel(aid), count: 1 });
      }
    });

    const organizerLabel = cleanText(stay.organizer.name) || 'Organisateur';
    const organizerValue = cleanText(stay.organizerId) || toDestinationValue(organizerLabel);
    const currentOrganizer = organizerCounts.get(organizerValue);
    if (currentOrganizer) {
      currentOrganizer.count += 1;
    } else {
      organizerCounts.set(organizerValue, {
        label: organizerLabel,
        count: 1
      });
    }

    const ageBounds = extractStayAgeBounds(stay);
    if (ageBounds) {
      AGE_BANDS.forEach((band) => {
        if (agesOverlap(ageBounds, band)) {
          ageBandCounts.set(band.value, (ageBandCounts.get(band.value) ?? 0) + 1);
        }
      });
    }
  });

  const seasons = Array.from(seasonCounts.entries())
    .map(([value, data]) => ({
      value,
      label: data.label,
      count: data.count
    }))
    .sort((left, right) => {
      const rankDelta = seasonRank(left.label) - seasonRank(right.label);
      if (rankDelta !== 0) return rankDelta;
      return compareLabel(left.label, right.label);
    });

  const categories = Array.from(categoryCounts.entries())
    .map(([value, data]) => ({
      value,
      label: data.label,
      count: data.count
    }))
    .sort((left, right) => compareLabel(left.label, right.label));

  const destinationTypes = Array.from(destinationTypeCounts.entries())
    .map(([value, data]) => ({
      value,
      label: data.label,
      count: data.count
    }))
    .sort((left, right) => compareLabel(left.label, right.label));

  const destinations = Array.from(destinationCounts.entries())
    .map(([value, data]) => ({
      value,
      label: data.label,
      count: data.count
    }))
    .sort((left, right) => compareLabel(left.label, right.label));

  const departureCities = Array.from(departureCityCounts.entries())
    .map(([value, data]) => ({
      value,
      label: data.label,
      count: data.count
    }))
    .sort((left, right) => compareLabel(left.label, right.label));

  const paymentAids = Array.from(paymentAidCounts.entries())
    .map(([value, data]) => ({
      value,
      label: data.label,
      count: data.count
    }))
    .sort((left, right) => compareLabel(left.label, right.label));

  const organizers = Array.from(organizerCounts.entries())
    .map(([value, data]) => ({
      value,
      label: data.label,
      count: data.count
    }))
    .sort((left, right) => compareLabel(left.label, right.label));

  const ageBands = AGE_BANDS.map((band) => ({
    value: band.value,
    label: band.label,
    count: ageBandCounts.get(band.value) ?? 0
  })).filter((option) => option.count > 0);

  return {
    seasons,
    categories,
    ageBands,
    destinationTypes,
    destinations,
    departureCities,
    paymentAids,
    organizers
  };
}

export function parseStayCatalogFiltersFromSearchParams(
  searchParams: URLSearchParams,
  options: StayCatalogFilterOptions
): StayCatalogFilterState {
  const q = normalizeSpaces(searchParams.get('q') ?? '');

  const seasons = resolveValuesFromOptions(
    [
      ...readParamList(searchParams, ['season', 'seasons', 'seasonId']),
      ...collectLegacyPeriodSeasons(readParamList(searchParams, ['periods']), options.seasons)
    ],
    options.seasons
  );

  const categories = resolveValuesFromOptions(
    readParamList(searchParams, ['categories', 'category']),
    options.categories
  );

  const ageBands = resolveAgeBandValues(
    readParamList(searchParams, ['ages', 'age', 'audiences']),
    options.ageBands
  );

  const destinationTypes = resolveValuesFromOptions(
    readParamList(searchParams, ['destinationTypes', 'destination_type', 'destinationType']),
    options.destinationTypes
  );

  const destinations = resolveValuesFromOptions(
    [
      ...readParamList(searchParams, ['destinations', 'destination']),
      ...readParamList(searchParams, ['region'])
    ],
    options.destinations
  );

  const organizerIds = resolveValuesFromOptions(
    readParamList(searchParams, ['organizers', 'organizer']),
    options.organizers
  );

  const departureCities = resolveValuesFromOptions(
    readParamList(searchParams, ['departureCities', 'departureCity', 'departures', 'departure']),
    options.departureCities
  );
  const paymentAids = resolveValuesFromOptions(
    readParamList(searchParams, ['paymentAids', 'paymentAid']),
    options.paymentAids
  ) as PaymentAidValue[];

  const ageMinRaw = parseRangeNumber(searchParams.get('ageMin') ?? searchParams.get('age_min'));
  const ageMaxRaw = parseRangeNumber(searchParams.get('ageMax') ?? searchParams.get('age_max'));
  const priceMinRaw = parseRangeNumber(searchParams.get('priceMin') ?? searchParams.get('price_min'));
  const priceMaxRaw = parseRangeNumber(searchParams.get('priceMax') ?? searchParams.get('price_max'));

  return {
    q,
    seasonIds: seasons,
    categories,
    ageBands,
    destinationTypes,
    destinations,
    departureCities,
    paymentAids,
    organizerIds,
    ageMin: ageMinRaw != null ? clampNumber(ageMinRaw, 0, 99) : null,
    ageMax: ageMaxRaw != null ? clampNumber(ageMaxRaw, 0, 99) : null,
    priceMin: priceMinRaw != null ? Math.max(0, priceMinRaw) : null,
    priceMax: priceMaxRaw != null ? Math.max(0, priceMaxRaw) : null
  };
}

export function serializeStayCatalogFiltersToSearchParams(state: StayCatalogFilterState) {
  const params = new URLSearchParams();

  const query = normalizeSpaces(state.q);
  if (query) params.set('q', query);
  if (state.seasonIds.length > 0) params.set('season', uniq(state.seasonIds).join(','));
  if (state.categories.length > 0) params.set('categories', uniq(state.categories).join(','));
  if (state.ageBands.length > 0) params.set('ages', uniq(state.ageBands).join(','));
  if (state.destinationTypes.length > 0) {
    params.set('destinationTypes', uniq(state.destinationTypes).join(','));
  }
  if (state.destinations.length > 0) params.set('destinations', uniq(state.destinations).join(','));
  if (state.departureCities.length > 0) params.set('departureCities', uniq(state.departureCities).join(','));
  if (state.paymentAids.length > 0) params.set('paymentAids', uniq(state.paymentAids).join(','));
  if (state.organizerIds.length > 0) params.set('organizers', uniq(state.organizerIds).join(','));
  if (state.ageMin != null) params.set('ageMin', String(state.ageMin));
  if (state.ageMax != null) params.set('ageMax', String(state.ageMax));
  if (state.priceMin != null) params.set('priceMin', String(state.priceMin));
  if (state.priceMax != null) params.set('priceMax', String(state.priceMax));

  return params;
}

function normalizeSortRawValue(value: string | null): StayCatalogSortValue {
  const normalized = normalizeCatalogText(value ?? '').replace(/\s+/g, '-');
  if (!normalized) return DEFAULT_STAY_CATALOG_SORT;
  if (normalized === 'aleatoire') return 'random';
  if (normalized === 'tarif-croissant' || normalized === 'prix-croissant' || normalized === 'croissant') {
    return 'price-asc';
  }
  if (
    normalized === 'tarif-decroissant' ||
    normalized === 'prix-decroissant' ||
    normalized === 'decroissant'
  ) {
    return 'price-desc';
  }
  return STAY_CATALOG_SORT_VALUES.has(normalized as StayCatalogSortValue)
    ? (normalized as StayCatalogSortValue)
    : DEFAULT_STAY_CATALOG_SORT;
}

export function parseStayCatalogSortFromSearchParams(searchParams: URLSearchParams): StayCatalogSortValue {
  return normalizeSortRawValue(searchParams.get('sort') ?? searchParams.get('tri'));
}

export function applyStayCatalogSort(
  stays: Stay[],
  sort: StayCatalogSortValue,
  options?: { randomSeed?: number | null }
) {
  const safeSort = STAY_CATALOG_SORT_VALUES.has(sort) ? sort : DEFAULT_STAY_CATALOG_SORT;
  const sorted = [...stays];

  if (safeSort === 'price-asc' || safeSort === 'price-desc') {
    sorted.sort((left, right) => {
      const leftPrice = stayPriceForSort(left);
      const rightPrice = stayPriceForSort(right);

      if (leftPrice == null && rightPrice == null) return compareFallbackStable(left, right);
      if (leftPrice == null) return 1;
      if (rightPrice == null) return -1;

      const delta = safeSort === 'price-asc' ? leftPrice - rightPrice : rightPrice - leftPrice;
      if (delta !== 0) return delta;

      return compareFallbackStable(left, right);
    });
    return sorted;
  }

  const seed = options?.randomSeed;
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return sorted;
  }

  const byRandomRank = (left: Stay, right: Stay) => {
    const leftRank = fnv1aHash(`${seed}:${left.id}:${left.slug}`);
    const rightRank = fnv1aHash(`${seed}:${right.id}:${right.slug}`);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return compareFallbackStable(left, right);
  };

  const available: Stay[] = [];
  const fullyBooked: Stay[] = [];

  for (const stay of sorted) {
    if (staySessionsAppearFullyBooked(stay.bookingOptions?.sessions)) {
      fullyBooked.push(stay);
    } else {
      available.push(stay);
    }
  }

  available.sort(byRandomRank);
  fullyBooked.sort(byRandomRank);

  return [...available, ...fullyBooked];
}

export function applyStayCatalogFilters(
  stays: Stay[],
  state: StayCatalogFilterState,
  preParsedQuery?: StaySearchQuery
) {
  const searchQuery = preParsedQuery ?? parseSearchQuery(state.q);
  const queryTokens = searchQuery.tokens;
  const locationIntent = searchQuery.locationIntent;
  const searchableTextForStay = (stay: Stay) => {
    const indexed = stay as SearchIndexedStay;
    if (typeof indexed._searchText === 'string') return indexed._searchText;
    return buildStaySearchIndex(stay)._searchText;
  };
  const locationTextForStay = (stay: Stay) => {
    const indexed = stay as SearchIndexedStay;
    if (typeof indexed._locationText === 'string') return indexed._locationText;
    return buildStaySearchIndex(stay)._locationText;
  };

  const matchesNonTextFilters = (stay: Stay) => {
    if (state.seasonIds.length > 0 && !state.seasonIds.includes(stay.seasonId)) {
      return false;
    }

    if (
      state.categories.length > 0 &&
      !stay.categories.some((category) => state.categories.includes(category))
    ) {
      return false;
    }

    if (state.destinationTypes.length > 0) {
      const destinationType = stayDestinationTypeValue(stay);
      if (!state.destinationTypes.includes(destinationType)) {
        return false;
      }
    }

    if (state.ageBands.length > 0) {
      const ageBounds = extractStayAgeBounds(stay);
      if (!ageBounds) return false;

      const matchesAgeBand = state.ageBands.some((bandValue) => {
        const band = AGE_BANDS.find((item) => item.value === bandValue);
        if (!band) return false;
        return agesOverlap(ageBounds, band);
      });

      if (!matchesAgeBand) {
        return false;
      }
    }

    if (state.ageMin != null || state.ageMax != null) {
      const ageBounds = extractStayAgeBounds(stay);
      if (!ageBounds) return false;
      const range: AgeBounds = {
        min: state.ageMin != null ? state.ageMin : 0,
        max: state.ageMax != null ? state.ageMax : 99
      };
      if (!agesOverlap(ageBounds, range)) {
        return false;
      }
    }

    if (state.priceMin != null || state.priceMax != null) {
      const price = stayPriceForSort(stay);
      if (price == null) return false;
      if (state.priceMin != null && price < state.priceMin) return false;
      if (state.priceMax != null && price > state.priceMax) return false;
    }

    if (state.destinations.length > 0) {
      const destinationLabel = stayDestinationLabel(stay);
      const destinationValue = destinationLabel ? toDestinationValue(destinationLabel) : '';
      if (!destinationValue || !state.destinations.includes(destinationValue)) {
        return false;
      }
    }

    if (state.departureCities.length > 0) {
      const departureValues = getStayDepartureCities(stay)
        .map((city) => canonicalTransportCityKey(city))
        .filter(Boolean)
        .map(toDestinationValue);
      if (!departureValues.some((value) => state.departureCities.includes(value))) {
        return false;
      }
    }

    if (state.paymentAids.length > 0) {
      const stayPaymentAids = normalizePaymentAids(stay.paymentAids);
      if (!stayPaymentAids.some((aid) => state.paymentAids.includes(aid))) {
        return false;
      }
    }

    if (state.organizerIds.length > 0) {
      if (!state.organizerIds.includes(stay.organizerId)) {
        return false;
      }
    }

    return true;
  };

  const strictResults: Stay[] = [];
  const fallbackResults: Stay[] = [];
  const canUseFallback = !locationIntent && queryTokens.length >= 2;

  for (const stay of stays) {
    if (!matchesNonTextFilters(stay)) continue;

    if (locationIntent) {
      if (locationTextForStay(stay).includes(locationIntent)) {
        strictResults.push(stay);
      }
      continue;
    }

    if (queryTokens.length === 0) {
      strictResults.push(stay);
      continue;
    }

    const searchable = searchableTextForStay(stay);
    let matchedCount = 0;
    for (const token of queryTokens) {
      if (searchable.includes(token)) {
        matchedCount += 1;
      } else if (!canUseFallback) {
        matchedCount = -1;
        break;
      }
    }

    if (matchedCount === queryTokens.length) {
      strictResults.push(stay);
      continue;
    }

    if (canUseFallback && matchedCount > 0) {
      fallbackResults.push(stay);
    }
  }

  if (locationIntent || queryTokens.length === 0 || strictResults.length > 0) {
    return strictResults;
  }

  return canUseFallback ? fallbackResults : strictResults;
}
