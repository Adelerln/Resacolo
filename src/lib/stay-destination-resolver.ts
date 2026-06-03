import { mapToCanonicalStayRegion } from '@/lib/stay-regions';
import { normalizeStayDestinationCountries, type StayDestinationType } from '@/lib/stay-destination';

type DestinationResolutionInput = {
  destinationType?: string | null;
  destinationCity?: string | null;
  destinationPostalCode?: string | null;
  destinationDepartmentCode?: string | null;
  destinationRegion?: string | null;
  destinationCountry?: string | null;
  destinationCountries?: string[] | null;
  destinationItineraryLabel?: string | null;
  regionText?: string | null;
  locationText?: string | null;
};

export type ResolvedStayDestination = {
  destinationType: StayDestinationType | null;
  destinationCity: string | null;
  destinationPostalCode: string | null;
  destinationDepartmentCode: string | null;
  destinationRegion: string | null;
  destinationCountry: string | null;
  destinationCountries: string[];
  destinationItineraryLabel: string | null;
};

const COUNTRY_ALIASES: Array<{ key: string; label: string }> = [
  { key: 'usa', label: 'États-Unis' },
  { key: 'etats unis', label: 'États-Unis' },
  { key: 'united states', label: 'États-Unis' },
  { key: 'uk', label: 'Royaume-Uni' },
  { key: 'united kingdom', label: 'Royaume-Uni' },
  { key: 'angleterre', label: 'Royaume-Uni' },
  { key: 'japon', label: 'Japon' },
  { key: 'indonesie', label: 'Indonésie' },
  { key: 'tanzanie', label: 'Tanzanie' },
  { key: 'ouzbekistan', label: 'Ouzbékistan' },
  { key: 'espagne', label: 'Espagne' },
  { key: 'italie', label: 'Italie' },
  { key: 'portugal', label: 'Portugal' },
  { key: 'grece', label: 'Grèce' },
  { key: 'irlande', label: 'Irlande' },
  { key: 'canada', label: 'Canada' },
  { key: 'maroc', label: 'Maroc' },
  { key: 'tunisie', label: 'Tunisie' },
  { key: 'senegal', label: 'Sénégal' },
  { key: 'thailande', label: 'Thaïlande' },
  { key: 'vietnam', label: 'Vietnam' }
];

function cleanText(value: string | null | undefined) {
  const cleaned = (value ?? '').trim();
  return cleaned || null;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isFranceLike(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized === 'france';
}

function normalizeCountryLabel(value: string | null | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  if (isFranceLike(cleaned)) return 'France';
  return cleaned;
}

function normalizePostalCode(value: string | null | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  return cleaned.replace(/\s+/g, '');
}

function normalizeDepartmentCode(value: string | null | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  return cleaned.toUpperCase().replace(/\s+/g, '');
}

function dedupeCountries(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeCountryLabel(value);
    if (!normalized || isFranceLike(normalized)) continue;
    const key = normalizeText(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

export function extractCountryFromText(value: string | null | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const normalized = normalizeText(cleaned);
  if (!normalized) return null;

  for (const alias of COUNTRY_ALIASES) {
    if (normalized.includes(alias.key)) {
      return alias.label;
    }
  }

  const commaParts = cleaned
    .split(',')
    .map((part) => cleanText(part))
    .filter((part): part is string => Boolean(part));
  const commaLast = commaParts.at(-1);
  if (commaLast && !isFranceLike(commaLast) && !/^\d{2,3}[a-z]?$/i.test(commaLast)) {
    return commaLast;
  }

  const parenMatch = cleaned.match(/\(([^()]+)\)\s*$/);
  if (parenMatch?.[1]) {
    const inside = cleanText(parenMatch[1]);
    if (inside && !isFranceLike(inside) && !/^\d{2,3}[a-z]?$/i.test(inside)) {
      return inside;
    }
  }

  return null;
}

export function resolveStayDestination(input: DestinationResolutionInput): ResolvedStayDestination {
  const canonicalRegion =
    mapToCanonicalStayRegion(cleanText(input.destinationRegion) ?? '') ??
    mapToCanonicalStayRegion(cleanText(input.regionText) ?? '');
  const structuredCountry = normalizeCountryLabel(input.destinationCountry);
  const structuredCountries = dedupeCountries(normalizeStayDestinationCountries(input.destinationCountries));
  const countryFromLocation = extractCountryFromText(input.locationText);
  const destinationItineraryLabel = cleanText(input.destinationItineraryLabel);

  let destinationType: StayDestinationType | null =
    input.destinationType === 'fixed_france' ||
    input.destinationType === 'fixed_abroad' ||
    input.destinationType === 'itinerant'
      ? input.destinationType
      : null;

  if (!destinationType) {
    if (canonicalRegion && canonicalRegion !== 'Étranger') {
      destinationType = 'fixed_france';
    } else if (structuredCountries.length > 0 || (structuredCountry && !isFranceLike(structuredCountry)) || countryFromLocation) {
      destinationType = destinationItineraryLabel ? 'itinerant' : 'fixed_abroad';
    }
  }

  const destinationCity = cleanText(input.destinationCity);
  const destinationPostalCode = normalizePostalCode(input.destinationPostalCode);
  const destinationDepartmentCode = normalizeDepartmentCode(input.destinationDepartmentCode);

  if (destinationType === 'fixed_france') {
    return {
      destinationType,
      destinationCity,
      destinationPostalCode,
      destinationDepartmentCode,
      destinationRegion: canonicalRegion && canonicalRegion !== 'Étranger' ? canonicalRegion : null,
      destinationCountry: 'France',
      destinationCountries: [],
      destinationItineraryLabel: null
    };
  }

  if (destinationType === 'itinerant') {
    const countries = dedupeCountries([...structuredCountries, structuredCountry, countryFromLocation]);
    return {
      destinationType,
      destinationCity: null,
      destinationPostalCode: null,
      destinationDepartmentCode: null,
      destinationRegion: null,
      destinationCountry: countries[0] ?? null,
      destinationCountries: countries,
      destinationItineraryLabel: destinationItineraryLabel ?? cleanText(input.locationText)
    };
  }

  if (destinationType === 'fixed_abroad') {
    const resolvedCountry =
      (structuredCountry && !isFranceLike(structuredCountry) ? structuredCountry : null) ??
      structuredCountries[0] ??
      countryFromLocation;
    return {
      destinationType,
      destinationCity,
      destinationPostalCode: null,
      destinationDepartmentCode: null,
      destinationRegion: null,
      destinationCountry: resolvedCountry ?? null,
      destinationCountries: [],
      destinationItineraryLabel: null
    };
  }

  return {
    destinationType: null,
    destinationCity,
    destinationPostalCode,
    destinationDepartmentCode,
    destinationRegion: canonicalRegion && canonicalRegion !== 'Étranger' ? canonicalRegion : null,
    destinationCountry:
      structuredCountry && !isFranceLike(structuredCountry)
        ? structuredCountry
        : structuredCountries[0] ?? countryFromLocation ?? null,
    destinationCountries: structuredCountries,
    destinationItineraryLabel
  };
}
