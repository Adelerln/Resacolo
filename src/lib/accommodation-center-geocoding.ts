import { validateAndParseAccommodationCenterCoordinates } from '@/lib/accommodation-location';

type AccommodationCenterCandidateInput = {
  title?: string | null;
  locationMode?: string | null;
  locationCity?: string | null;
  locationDepartmentCode?: string | null;
  locationCountry?: string | null;
  geocodingQuery?: string | null;
  draftLocationText?: string | null;
  draftRegionText?: string | null;
  centerLatitude?: string | number | null;
  centerLongitude?: string | number | null;
};

export type AccommodationCenterCoordinatesResolution = {
  centerLatitude: number | null;
  centerLongitude: number | null;
  source: 'provided' | 'ban' | 'nominatim' | 'none';
  queryUsed: string | null;
  confidence: number | null;
};

type BanResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number];
    };
    properties?: {
      score?: number;
    };
  }>;
};

type NominatimResponse = Array<{
  lat?: string;
  lon?: string;
  importance?: number;
}>;

const GEOCODING_TIMEOUT_MS = 3500;

function normalizeText(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function dedupeQueries(queries: Array<string | null | undefined>, limit = 4): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const query of queries) {
    const normalized = normalizeText(query);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= limit) break;
  }

  return output;
}

function isLikelyFrance(input: AccommodationCenterCandidateInput): boolean {
  const locationMode = normalizeText(input.locationMode)?.toLowerCase();
  if (locationMode === 'france') return true;

  const country = normalizeText(input.locationCountry)?.toLowerCase();
  if (country && country.includes('france')) return true;

  return Boolean(normalizeText(input.locationDepartmentCode));
}

function buildCountrySuffix(input: AccommodationCenterCandidateInput): string {
  if (isLikelyFrance(input)) return 'France';
  const country = normalizeText(input.locationCountry);
  return country ?? '';
}

function buildGeocodingQueries(input: AccommodationCenterCandidateInput): string[] {
  const city = normalizeText(input.locationCity);
  const departmentCode = normalizeText(input.locationDepartmentCode);
  const title = normalizeText(input.title);
  const draftLocationText = normalizeText(input.draftLocationText);
  const draftRegionText = normalizeText(input.draftRegionText);
  const explicit = normalizeText(input.geocodingQuery);
  const countrySuffix = buildCountrySuffix(input);
  const countryWithPrefix = countrySuffix ? `, ${countrySuffix}` : '';

  return dedupeQueries([
    explicit,
    city && departmentCode
      ? `${city} ${departmentCode}${countryWithPrefix}`
      : null,
    city ? `${city}${countryWithPrefix}` : null,
    city && title ? `${title}, ${city}${countryWithPrefix}` : null,
    draftLocationText && countrySuffix && !draftLocationText.toLowerCase().includes(countrySuffix.toLowerCase())
      ? `${draftLocationText}, ${countrySuffix}`
      : draftLocationText,
    draftRegionText && countrySuffix ? `${draftRegionText}, ${countrySuffix}` : draftRegionText
  ]);
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs = GEOCODING_TIMEOUT_MS
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeWithBan(query: string): Promise<AccommodationCenterCoordinatesResolution | null> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&autocomplete=0&limit=1`;
  const data = await fetchJsonWithTimeout<BanResponse>(url, {
    headers: { Accept: 'application/json' }
  });
  const best = data?.features?.[0];
  const coordinates = best?.geometry?.coordinates;
  const score = best?.properties?.score ?? null;

  if (!coordinates || coordinates.length !== 2) {
    return null;
  }

  const latitude = coordinates[1];
  const longitude = coordinates[0];
  const parsed = validateAndParseAccommodationCenterCoordinates({
    centerLatitude: latitude,
    centerLongitude: longitude
  });
  if (parsed.error || parsed.value.centerLatitude == null || parsed.value.centerLongitude == null) {
    return null;
  }

  return {
    centerLatitude: parsed.value.centerLatitude,
    centerLongitude: parsed.value.centerLongitude,
    source: 'ban',
    queryUsed: query,
    confidence: typeof score === 'number' ? score : null
  };
}

async function geocodeWithNominatim(
  query: string
): Promise<AccommodationCenterCoordinatesResolution | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const rows = await fetchJsonWithTimeout<NominatimResponse>(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'fr',
      'User-Agent': 'ResacoloImporter/1.0 (contact@resacolo.fr)'
    }
  });
  const best = rows?.[0];
  if (!best) return null;

  const parsed = validateAndParseAccommodationCenterCoordinates({
    centerLatitude: best.lat ?? null,
    centerLongitude: best.lon ?? null
  });
  if (parsed.error || parsed.value.centerLatitude == null || parsed.value.centerLongitude == null) {
    return null;
  }

  return {
    centerLatitude: parsed.value.centerLatitude,
    centerLongitude: parsed.value.centerLongitude,
    source: 'nominatim',
    queryUsed: query,
    confidence: Number.isFinite(best.importance) ? Number(best.importance) : null
  };
}

export async function resolveAccommodationCenterCoordinates(
  input: AccommodationCenterCandidateInput
): Promise<AccommodationCenterCoordinatesResolution> {
  const parsedProvided = validateAndParseAccommodationCenterCoordinates({
    centerLatitude: input.centerLatitude,
    centerLongitude: input.centerLongitude
  });
  if (
    !parsedProvided.error &&
    parsedProvided.value.centerLatitude != null &&
    parsedProvided.value.centerLongitude != null
  ) {
    return {
      centerLatitude: parsedProvided.value.centerLatitude,
      centerLongitude: parsedProvided.value.centerLongitude,
      source: 'provided',
      queryUsed: null,
      confidence: 1
    };
  }

  const queries = buildGeocodingQueries(input);
  if (queries.length === 0) {
    return {
      centerLatitude: null,
      centerLongitude: null,
      source: 'none',
      queryUsed: null,
      confidence: null
    };
  }

  for (const query of queries) {
    const isFranceQuery = isLikelyFrance(input) || /france/i.test(query);

    if (isFranceQuery) {
      const ban = await geocodeWithBan(query);
      if (ban && (ban.confidence == null || ban.confidence >= 0.35)) {
        return ban;
      }
    }

    const nominatim = await geocodeWithNominatim(query);
    if (nominatim) {
      return nominatim;
    }
  }

  return {
    centerLatitude: null,
    centerLongitude: null,
    source: 'none',
    queryUsed: queries[0] ?? null,
    confidence: null
  };
}

