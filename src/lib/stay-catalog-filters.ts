import { FILTER_LABELS } from '@/lib/constants';
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
  destinations: StayCatalogFilterOption[];
  organizers: StayCatalogFilterOption[];
};

export type StayCatalogFilterState = {
  q: string;
  seasonIds: string[];
  categories: string[];
  ageBands: StayAgeBandValue[];
  destinations: string[];
  organizerIds: string[];
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

export const EMPTY_STAY_CATALOG_FILTERS: StayCatalogFilterState = {
  q: '',
  seasonIds: [],
  categories: [],
  ageBands: [],
  destinations: [],
  organizerIds: []
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
  return isFinitePositivePrice(stay.priceFrom) ? stay.priceFrom : null;
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

  const numbers = (stay.ageRange.match(/\d{1,2}/g) ?? [])
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
  const region = cleanText(stay.region);
  if (region) return region;
  return cleanText(stay.location);
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
      return;
    }

    options.forEach((option) => {
      const normalizedLabel = normalizeCatalogText(option.label);
      const normalizedValue = normalizeCatalogText(option.value);
      if (
        normalizedLabel.includes(normalized) ||
        normalized.includes(normalizedLabel) ||
        normalizedValue.includes(normalized)
      ) {
        resolved.add(option.value);
      }
    });
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

export function normalizeCatalogText(value: string) {
  return normalizeSpaces(
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s-]/g, ' ')
      .toLowerCase()
  );
}

export function stayCatalogFilterStateKey(state: StayCatalogFilterState) {
  return [
    normalizeCatalogText(state.q),
    buildStateKeyValues(state.seasonIds),
    buildStateKeyValues(state.categories),
    buildStateKeyValues(state.ageBands),
    buildStateKeyValues(state.destinations),
    buildStateKeyValues(state.organizerIds)
  ].join('::');
}

export function countActiveStayCatalogFilters(state: StayCatalogFilterState) {
  const hasQuery = normalizeCatalogText(state.q).length > 0 ? 1 : 0;
  return (
    hasQuery +
    state.seasonIds.length +
    state.categories.length +
    state.ageBands.length +
    state.destinations.length +
    state.organizerIds.length
  );
}

export function buildStayCatalogFilterOptions(stays: Stay[]): StayCatalogFilterOptions {
  const seasonCounts = new Map<string, { label: string; count: number }>();
  const categoryCounts = new Map<string, { label: string; count: number }>();
  const destinationCounts = new Map<string, { label: string; count: number }>();
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

    uniq(stay.categories.map((value) => normalizeSpaces(String(value).toLowerCase())))
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

  const destinations = Array.from(destinationCounts.entries())
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
    destinations,
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

  return {
    q,
    seasonIds: seasons,
    categories,
    ageBands,
    destinations,
    organizerIds
  };
}

export function serializeStayCatalogFiltersToSearchParams(state: StayCatalogFilterState) {
  const params = new URLSearchParams();

  const query = normalizeSpaces(state.q);
  if (query) params.set('q', query);
  if (state.seasonIds.length > 0) params.set('season', uniq(state.seasonIds).join(','));
  if (state.categories.length > 0) params.set('categories', uniq(state.categories).join(','));
  if (state.ageBands.length > 0) params.set('ages', uniq(state.ageBands).join(','));
  if (state.destinations.length > 0) params.set('destinations', uniq(state.destinations).join(','));
  if (state.organizerIds.length > 0) params.set('organizers', uniq(state.organizerIds).join(','));

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

  sorted.sort((left, right) => {
    const leftRank = fnv1aHash(`${seed}:${left.id}:${left.slug}`);
    const rightRank = fnv1aHash(`${seed}:${right.id}:${right.slug}`);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return compareFallbackStable(left, right);
  });

  return sorted;
}

export function applyStayCatalogFilters(stays: Stay[], state: StayCatalogFilterState) {
  const queryTokens = normalizeCatalogText(state.q).split(' ').filter(Boolean);

  return stays.filter((stay) => {
    if (state.seasonIds.length > 0 && !state.seasonIds.includes(stay.seasonId)) {
      return false;
    }

    if (
      state.categories.length > 0 &&
      !stay.categories.some((category) => state.categories.includes(category))
    ) {
      return false;
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

    if (state.destinations.length > 0) {
      const destinationLabel = stayDestinationLabel(stay);
      const destinationValue = destinationLabel ? toDestinationValue(destinationLabel) : '';
      if (!destinationValue || !state.destinations.includes(destinationValue)) {
        return false;
      }
    }

    if (state.organizerIds.length > 0) {
      if (!state.organizerIds.includes(stay.organizerId)) {
        return false;
      }
    }

    if (queryTokens.length > 0) {
      const searchable = normalizeCatalogText(
        [
          stay.title,
          stay.summary,
          stay.description,
          stay.location,
          stay.region,
          stay.activitiesText ?? '',
          stay.programText ?? '',
          stay.transportText ?? '',
          stay.organizer.name
        ].join(' ')
      );

      const isMatch = queryTokens.every((token) => searchable.includes(token));
      if (!isMatch) {
        return false;
      }
    }

    return true;
  });
}
