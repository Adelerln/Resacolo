import { mapToCanonicalStayRegion } from '@/lib/stay-regions';

export type StayDestinationType = 'fixed_france' | 'fixed_abroad' | 'itinerant';

export type StayDestinationInput = {
  destinationType?: string | null;
  destinationCity?: string | null;
  destinationPostalCode?: string | null;
  destinationDepartmentCode?: string | null;
  destinationRegion?: string | null;
  destinationCountry?: string | null;
  destinationItineraryLabel?: string | null;
  destinationCountries?: string[] | null;
  locationText?: string | null;
  regionText?: string | null;
};

function cleanText(value: string | null | undefined) {
  const normalized = (value ?? '').trim();
  return normalized || null;
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

function normalizeDestinationCountry(value: string | null | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  if (cleaned.toLowerCase() === 'france') return 'France';
  return cleaned;
}

function normalizeForCompare(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }

  return output;
}

export function normalizeStayDestinationType(value: string | null | undefined): StayDestinationType | null {
  if (value === 'fixed_france' || value === 'fixed_abroad' || value === 'itinerant') {
    return value;
  }
  return null;
}

export function normalizeStayDestinationCountries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqStrings(value.filter((item): item is string => typeof item === 'string'));
}

export function normalizeStayDestination(input: StayDestinationInput) {
  const destinationType = normalizeStayDestinationType(input.destinationType);
  let destinationCity = cleanText(input.destinationCity);
  const destinationPostalCode = normalizePostalCode(input.destinationPostalCode);
  const destinationDepartmentCode = normalizeDepartmentCode(input.destinationDepartmentCode);
  const destinationRegion =
    mapToCanonicalStayRegion(cleanText(input.destinationRegion) ?? '') || cleanText(input.destinationRegion);
  const destinationCountry = normalizeDestinationCountry(input.destinationCountry);
  const destinationItineraryLabel = cleanText(input.destinationItineraryLabel);
  const destinationCountries = normalizeStayDestinationCountries(input.destinationCountries);
  const locationText = cleanText(input.locationText);
  const regionText = mapToCanonicalStayRegion(cleanText(input.regionText) ?? '') || cleanText(input.regionText);

  // Avoid storing the same value in both city and country for abroad stays.
  if (
    destinationCity &&
    destinationCountry &&
    normalizeForCompare(destinationCity) === normalizeForCompare(destinationCountry)
  ) {
    destinationCity = null;
  }

  return {
    destinationType,
    destinationCity,
    destinationPostalCode,
    destinationDepartmentCode,
    destinationRegion,
    destinationCountry,
    destinationItineraryLabel,
    destinationCountries,
    locationText,
    regionText
  };
}

export function buildStayDestinationLabel(input: StayDestinationInput) {
  const normalized = normalizeStayDestination(input);

  if (normalized.destinationType === 'fixed_france') {
    if (normalized.destinationCity && normalized.destinationPostalCode) {
      return `${normalized.destinationCity} (${normalized.destinationPostalCode})`;
    }
    if (normalized.destinationCity && normalized.destinationDepartmentCode) {
      return `${normalized.destinationCity} (${normalized.destinationDepartmentCode})`;
    }
    if (normalized.destinationCity) return normalized.destinationCity;
    if (normalized.destinationRegion) return normalized.destinationRegion;
  }

  if (normalized.destinationType === 'fixed_abroad') {
    if (normalized.destinationCity && normalized.destinationCountry) {
      return `${normalized.destinationCity} (${normalized.destinationCountry})`;
    }
    if (normalized.destinationCountry) return normalized.destinationCountry;
    if (normalized.destinationCity) return normalized.destinationCity;
  }

  if (normalized.destinationType === 'itinerant') {
    const countries = normalized.destinationCountries;
    if (normalized.destinationItineraryLabel && countries.length > 0) {
      return `${normalized.destinationItineraryLabel} (${countries.join(', ')})`;
    }
    if (normalized.destinationItineraryLabel) return normalized.destinationItineraryLabel;
    if (countries.length > 0) return `Circuit itinérant (${countries.join(', ')})`;
    return 'Circuit itinérant';
  }

  return normalized.locationText ?? normalized.regionText ?? normalized.destinationCountry ?? null;
}

export function buildStayPrimaryDestinationFilterLabel(input: StayDestinationInput) {
  const normalized = normalizeStayDestination(input);

  if (normalized.destinationType === 'fixed_france') {
    return normalized.destinationRegion ?? normalized.regionText ?? normalized.locationText ?? null;
  }

  if (normalized.destinationType === 'fixed_abroad') {
    return normalized.destinationCountry ?? normalized.locationText ?? null;
  }

  if (normalized.destinationType === 'itinerant') {
    return normalized.destinationItineraryLabel ?? normalized.locationText ?? 'Circuit itinérant';
  }

  return normalized.regionText ?? normalized.locationText ?? null;
}

export function buildStayDestinationSearchText(input: StayDestinationInput) {
  const normalized = normalizeStayDestination(input);
  return uniqStrings([
    normalized.destinationCity,
    normalized.destinationPostalCode,
    normalized.destinationDepartmentCode,
    normalized.destinationRegion,
    normalized.destinationCountry,
    normalized.destinationItineraryLabel,
    ...normalized.destinationCountries,
    normalized.locationText,
    normalized.regionText
  ]).join(' ');
}
