export type AccommodationLocationMode = 'france' | 'abroad' | 'itinerant';

type AccommodationLocationInput = {
  locationMode?: string | null;
  locationCity?: string | null;
  locationDepartmentCode?: string | null;
  locationCountry?: string | null;
  itinerantZone?: string | null;
};

type AccommodationCenterCoordinatesInput = {
  centerLatitude?: string | number | null;
  centerLongitude?: string | number | null;
};

export type AccommodationCenterCoordinates = {
  centerLatitude: number | null;
  centerLongitude: number | null;
};

const ACCOMMODATION_LOCATION_META_PATTERN =
  /<!--\s*resacolo:accommodation-location:([^\n]*?)\s*-->/i;

function cleanValue(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

function normalizeMode(value?: string | null): AccommodationLocationMode | null {
  if (value === 'france' || value === 'abroad' || value === 'itinerant') return value;
  return null;
}

function decodeMetaPart(value?: string) {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    return cleanValue(decoded);
  } catch {
    return cleanValue(value);
  }
}

function encodeMetaPart(value?: string | null) {
  return encodeURIComponent(value?.trim() ?? '');
}

function normalizeDepartmentCode(value?: string | null) {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;
  return cleaned.toUpperCase().replace(/\s+/g, '');
}

function normalizeCoordinateInput(value?: string | number | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  return String(value ?? '').trim().replace(',', '.');
}

function parseCoordinate(raw: string) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return parsed;
}

export function validateAndParseAccommodationCenterCoordinates(
  input: AccommodationCenterCoordinatesInput
): { value: AccommodationCenterCoordinates; error: string | null } {
  const latitudeRaw = normalizeCoordinateInput(input.centerLatitude);
  const longitudeRaw = normalizeCoordinateInput(input.centerLongitude);
  const latitude = parseCoordinate(latitudeRaw);
  const longitude = parseCoordinate(longitudeRaw);
  const hasLatitude = latitude !== null;
  const hasLongitude = longitude !== null;

  if (hasLatitude !== hasLongitude) {
    return {
      value: { centerLatitude: null, centerLongitude: null },
      error: 'Renseigne latitude et longitude ensemble.'
    };
  }

  if (!hasLatitude && !hasLongitude) {
    return {
      value: { centerLatitude: null, centerLongitude: null },
      error: null
    };
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      value: { centerLatitude: null, centerLongitude: null },
      error: 'Latitude/longitude invalides: utilise des nombres décimaux.'
    };
  }

  if (latitude == null || longitude == null) {
    return {
      value: { centerLatitude: null, centerLongitude: null },
      error: 'Renseigne latitude et longitude ensemble.'
    };
  }

  if (latitude < -90 || latitude > 90) {
    return {
      value: { centerLatitude: null, centerLongitude: null },
      error: 'Latitude invalide: valeur attendue entre -90 et 90.'
    };
  }

  if (longitude < -180 || longitude > 180) {
    return {
      value: { centerLatitude: null, centerLongitude: null },
      error: 'Longitude invalide: valeur attendue entre -180 et 180.'
    };
  }

  return {
    value: { centerLatitude: latitude, centerLongitude: longitude },
    error: null
  };
}

export function normalizeAccommodationLocation(input: AccommodationLocationInput) {
  return {
    locationMode: normalizeMode(input.locationMode),
    locationCity: cleanValue(input.locationCity),
    locationDepartmentCode: normalizeDepartmentCode(input.locationDepartmentCode),
    locationCountry: cleanValue(input.locationCountry),
    itinerantZone: cleanValue(input.itinerantZone)
  };
}

export function buildAccommodationLocationLabel(input: AccommodationLocationInput) {
  const normalized = normalizeAccommodationLocation(input);

  if (normalized.locationMode === 'france') {
    if (!normalized.locationCity || !normalized.locationDepartmentCode) return null;
    return `${normalized.locationCity} (${normalized.locationDepartmentCode})`;
  }

  if (normalized.locationMode === 'abroad') {
    if (!normalized.locationCity || !normalized.locationCountry) return null;
    return `${normalized.locationCity} (${normalized.locationCountry})`;
  }

  if (normalized.locationMode === 'itinerant') {
    if (!normalized.itinerantZone) return null;
    return `Itinérant : ${normalized.itinerantZone}`;
  }

  return null;
}

export function validateAccommodationLocation(input: AccommodationLocationInput) {
  const normalized = normalizeAccommodationLocation(input);

  if (!normalized.locationMode) return null;

  if (normalized.locationMode === 'france') {
    if (!normalized.locationCity || !normalized.locationDepartmentCode) {
      return 'Renseigne la ville et le numéro de département pour un hébergement en France.';
    }
    return null;
  }

  if (normalized.locationMode === 'abroad') {
    if (!normalized.locationCity || !normalized.locationCountry) {
      return 'Renseigne la ville et le pays pour un hébergement à l’étranger.';
    }
    return null;
  }

  if (!normalized.itinerantZone) {
    return 'Renseigne la zone du circuit pour un hébergement itinérant.';
  }

  return null;
}

export function extractAccommodationLocationMeta(description?: string | null) {
  const raw = description ?? '';
  const match = raw.match(ACCOMMODATION_LOCATION_META_PATTERN);
  const [mode = '', city = '', departmentCode = '', country = '', itinerantZone = ''] =
    match?.[1]?.split('|') ?? [];

  const normalized = normalizeAccommodationLocation({
    locationMode: decodeMetaPart(mode),
    locationCity: decodeMetaPart(city),
    locationDepartmentCode: decodeMetaPart(departmentCode),
    locationCountry: decodeMetaPart(country),
    itinerantZone: decodeMetaPart(itinerantZone)
  });

  return {
    description: raw.replace(ACCOMMODATION_LOCATION_META_PATTERN, '').trim() || null,
    ...normalized,
    locationLabel: buildAccommodationLocationLabel(normalized)
  };
}

export function embedAccommodationLocationMeta(
  description: string | null | undefined,
  input: AccommodationLocationInput
) {
  const cleanedDescription = (description ?? '').replace(ACCOMMODATION_LOCATION_META_PATTERN, '').trim();
  const normalized = normalizeAccommodationLocation(input);
  const locationLabel = buildAccommodationLocationLabel(normalized);

  if (!normalized.locationMode || !locationLabel) {
    return cleanedDescription || null;
  }

  const meta = `<!-- resacolo:accommodation-location:${[
    encodeMetaPart(normalized.locationMode),
    encodeMetaPart(normalized.locationCity),
    encodeMetaPart(normalized.locationDepartmentCode),
    encodeMetaPart(normalized.locationCountry),
    encodeMetaPart(normalized.itinerantZone)
  ].join('|')} -->`;

  return cleanedDescription ? `${cleanedDescription}\n${meta}` : meta;
}

const ACCESSIBILITY_PMR_STOCK_PHRASE = 'Repéré comme accessible aux personnes à mobilité réduite (PMR).';

export function stripStockPmrPhraseFromAccessibility(text: string | null | undefined) {
  return (text ?? '')
    .replace(
      /\s*Repéré comme accessible aux personnes à mobilité réduite \(PMR\)\.?\s*/gi,
      ' '
    )
    .trim();
}

export function buildAccessibilityInfoFromForm(formData: FormData): string | null {
  const pmr = formData.get('pmr_accessible') === 'on';
  const extra = String(formData.get('accessibility_extra') ?? '').trim();
  if (pmr && extra) return `${extra} ${ACCESSIBILITY_PMR_STOCK_PHRASE}`;
  if (pmr) return ACCESSIBILITY_PMR_STOCK_PHRASE;
  if (extra) return extra;
  return null;
}
