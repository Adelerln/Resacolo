import { parseAccommodationType } from '@/components/organisme/accommodation-type';

export type AccommodationLocationMode = 'france' | 'abroad' | 'itinerant';

export type AccommodationStructuredLocation = AccommodationAddressInput & {
  locationMode?: string | null;
  itinerantZone?: string | null;
  accommodationType?: string | null;
};

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

export type AccommodationAddressInput = {
  addressText?: string | null;
  postalCode?: string | null;
  city?: string | null;
  departmentCode?: string | null;
  regionText?: string | null;
  country?: string | null;
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

export function normalizeAccommodationLocationMode(
  value?: string | null
): AccommodationLocationMode | null {
  if (value === 'france' || value === 'abroad' || value === 'itinerant') return value;
  return null;
}

function normalizeMode(value?: string | null): AccommodationLocationMode | null {
  return normalizeAccommodationLocationMode(value);
}

export function isItinerantAccommodationType(value?: string | null) {
  return parseAccommodationType(value).baseType === 'mixte';
}

export function resolveAccommodationLocationMode(input: {
  accommodationType?: string | null;
  locationMode?: string | null;
  country?: string | null;
  city?: string | null;
  addressText?: string | null;
  legacyLocationMode?: string | null;
}): AccommodationLocationMode | null {
  const explicitMode = normalizeMode(input.locationMode);
  if (explicitMode) return explicitMode;

  if (isItinerantAccommodationType(input.accommodationType)) {
    return 'itinerant';
  }

  const legacyMode = normalizeMode(input.legacyLocationMode);
  if (legacyMode) return legacyMode;

  const country = cleanValue(input.country)?.toLowerCase();
  if (country && country !== 'france') {
    return 'abroad';
  }

  if (cleanValue(input.city) || cleanValue(input.addressText) || country === 'france') {
    return 'france';
  }

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

function isInseeDepartmentCode(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  return /^\d{2,3}$/.test(compact) || /^2[AB]$/.test(compact);
}

export function formatFrenchPlaceName(value: string) {
  const lower = value.toLocaleLowerCase('fr-FR');
  return lower.replace(/(^|[\s\-'])(\p{L})/gu, (_, separator: string, letter: string) => {
    return separator + letter.toLocaleUpperCase('fr-FR');
  });
}

function normalizeDepartmentCode(value?: string | null) {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;
  const compact = cleaned.replace(/\s+/g, '');
  if (isInseeDepartmentCode(compact)) {
    return compact.toUpperCase();
  }
  return formatFrenchPlaceName(cleaned);
}

function normalizePostalCode(value?: string | null) {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;
  return cleaned.replace(/\s+/g, '');
}

function normalizeCity(value?: string | null) {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;
  return formatFrenchPlaceName(cleaned);
}

function normalizeCountry(value?: string | null) {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;
  if (cleaned.toLowerCase() === 'france') return 'France';
  return cleaned;
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

export function normalizeAccommodationAddress(input: AccommodationAddressInput) {
  return {
    addressText: cleanValue(input.addressText),
    postalCode: normalizePostalCode(input.postalCode),
    city: normalizeCity(input.city),
    departmentCode: normalizeDepartmentCode(input.departmentCode),
    regionText: cleanValue(input.regionText),
    country: normalizeCountry(input.country)
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
    if (normalized.locationCountry && normalized.locationCountry.toLowerCase() !== 'france') {
      return `${normalized.itinerantZone} (${normalized.locationCountry})`;
    }
    return normalized.itinerantZone;
  }

  return null;
}

export function buildAccommodationAddressLabel(input: AccommodationAddressInput) {
  const normalized = normalizeAccommodationAddress(input);
  const country = normalized.country;
  const isFrance = !country || country.toLowerCase() === 'france';

  if (normalized.city && isFrance && normalized.departmentCode) {
    return `${normalized.city} (${normalized.departmentCode})`;
  }

  if (normalized.city && normalized.postalCode) {
    return `${normalized.city} (${normalized.postalCode})`;
  }

  if (normalized.city && country) {
    return `${normalized.city} (${country})`;
  }

  if (normalized.city) return normalized.city;
  if (normalized.regionText) return normalized.regionText;
  if (country) return country;
  return null;
}

export function buildAccommodationLocationDisplayLabel(input: AccommodationStructuredLocation) {
  const normalizedAddress = normalizeAccommodationAddress(input);
  const locationMode = resolveAccommodationLocationMode({
    accommodationType: input.accommodationType,
    locationMode: input.locationMode,
    country: normalizedAddress.country,
    city: normalizedAddress.city,
    addressText: normalizedAddress.addressText
  });
  const itinerantZone = cleanValue(input.itinerantZone) ?? normalizedAddress.regionText;

  if (locationMode === 'itinerant') {
    return buildAccommodationLocationLabel({
      locationMode: 'itinerant',
      itinerantZone,
      locationCountry: normalizedAddress.country
    });
  }

  if (locationMode === 'france') {
    return (
      buildAccommodationLocationLabel({
        locationMode: 'france',
        locationCity: normalizedAddress.city,
        locationDepartmentCode: normalizedAddress.departmentCode
      }) ?? buildAccommodationAddressLabel(normalizedAddress)
    );
  }

  if (locationMode === 'abroad') {
    return (
      buildAccommodationLocationLabel({
        locationMode: 'abroad',
        locationCity: normalizedAddress.city,
        locationCountry: normalizedAddress.country
      }) ?? buildAccommodationAddressLabel(normalizedAddress)
    );
  }

  return buildAccommodationAddressLabel(normalizedAddress);
}

export function validateAccommodationLocation(input: AccommodationLocationInput) {
  const normalized = normalizeAccommodationLocation(input);

  if (!normalized.locationMode) return null;

  if (normalized.locationMode === 'france') {
    if (!normalized.locationCity || !normalized.locationDepartmentCode) {
      return 'Renseigne la ville et le département pour un hébergement fixe en France.';
    }
    return null;
  }

  if (normalized.locationMode === 'abroad') {
    if (!normalized.locationCity || !normalized.locationCountry) {
      return 'Renseigne la ville et le pays pour un hébergement fixe à l’étranger.';
    }
    return null;
  }

  if (!normalized.itinerantZone) {
    return 'Renseigne le libellé du circuit pour un hébergement itinérant.';
  }

  if (!normalized.locationCountry) {
    return 'Renseigne le pays du circuit (France ou pays étranger).';
  }

  return null;
}

export function readAccommodationAddressFromFormData(
  formData: FormData,
  options?: { locationMode?: AccommodationLocationMode | null }
) {
  const locationMode = options?.locationMode ?? null;
  const hideStreetAddress = locationMode === 'itinerant';

  return {
    addressText: hideStreetAddress ? '' : String(formData.get('address_text') ?? '').trim(),
    postalCode: hideStreetAddress ? '' : String(formData.get('postal_code') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    departmentCode:
      locationMode === 'abroad' || locationMode === 'itinerant'
        ? ''
        : String(formData.get('department_code') ?? '').trim(),
    regionText:
      locationMode === 'itinerant'
        ? ''
        : String(formData.get('region_text') ?? '').trim(),
    country: String(formData.get('country') ?? '').trim()
  } satisfies AccommodationAddressInput;
}

export function readAccommodationLocationFromFormData(formData: FormData) {
  const accommodationType = String(formData.get('accommodation_type') ?? '').trim();
  const requestedMode = normalizeMode(String(formData.get('location_mode') ?? '').trim());
  const locationMode =
    isItinerantAccommodationType(accommodationType) ? 'itinerant' : requestedMode;
  const address = readAccommodationAddressFromFormData(formData, { locationMode });

  return {
    accommodationType,
    locationMode,
    itinerantZone:
      locationMode === 'itinerant' ? String(formData.get('itinerant_zone') ?? '').trim() : '',
    address
  };
}

export function validateAccommodationFormLocation(input: {
  accommodationType?: string | null;
  locationMode?: string | null;
  itinerantZone?: string | null;
  address?: AccommodationAddressInput;
}) {
  const accommodationType = String(input.accommodationType ?? '').trim();
  const isItinerantType = isItinerantAccommodationType(accommodationType);
  const locationMode = resolveAccommodationLocationMode({
    accommodationType,
    locationMode: input.locationMode
  });

  if (!locationMode) {
    return 'Choisissez un mode de localisation.';
  }

  if (isItinerantType && locationMode !== 'itinerant') {
    return 'Le type « Itinérant (circuit) » impose un circuit itinérant.';
  }

  if (!isItinerantType && locationMode === 'itinerant') {
    return 'Seul le type « Itinérant (circuit) » peut être itinérant.';
  }

  const normalizedAddress = normalizeAccommodationAddress(input.address ?? {});
  const locationError = validateAccommodationLocation({
    locationMode,
    locationCity: normalizedAddress.city,
    locationDepartmentCode: normalizedAddress.departmentCode,
    locationCountry: normalizedAddress.country,
    itinerantZone: input.itinerantZone
  });
  if (locationError) return locationError;

  if (locationMode === 'france' && normalizedAddress.postalCode && !normalizedAddress.city) {
    return 'Renseigne la ville quand un code postal est saisi.';
  }

  return null;
}

export function validateAccommodationAddress(
  input: AccommodationAddressInput,
  options?: { locationMode?: AccommodationLocationMode | null; accommodationType?: string | null }
) {
  return validateAccommodationFormLocation({
    accommodationType: options?.accommodationType,
    locationMode: options?.locationMode,
    itinerantZone: null,
    address: input
  });
}

export function extractAccommodationLocationMeta(
  description?: string | null,
  structured?: AccommodationStructuredLocation | null
) {
  const raw = description ?? '';
  const match = raw.match(ACCOMMODATION_LOCATION_META_PATTERN);
  const [mode = '', city = '', departmentCode = '', country = '', legacyItinerantZone = ''] =
    match?.[1]?.split('|') ?? [];

  const legacyMeta = normalizeAccommodationLocation({
    locationMode: decodeMetaPart(mode),
    locationCity: decodeMetaPart(city),
    locationDepartmentCode: decodeMetaPart(departmentCode),
    locationCountry: decodeMetaPart(country),
    itinerantZone: decodeMetaPart(legacyItinerantZone)
  });
  const normalizedAddress = normalizeAccommodationAddress(structured ?? {});
  const resolvedLocationMode = resolveAccommodationLocationMode({
    accommodationType: structured?.accommodationType,
    locationMode: structured?.locationMode,
    country: normalizedAddress.country,
    city: normalizedAddress.city,
    addressText: normalizedAddress.addressText,
    legacyLocationMode: legacyMeta.locationMode
  });
  const resolvedItinerantZone =
    cleanValue(structured?.itinerantZone) ??
    legacyMeta.itinerantZone ??
    (resolvedLocationMode === 'itinerant' ? normalizedAddress.regionText : null);

  return {
    description: raw.replace(ACCOMMODATION_LOCATION_META_PATTERN, '').trim() || null,
    locationMode: resolvedLocationMode,
    locationCity: legacyMeta.locationCity,
    locationDepartmentCode: legacyMeta.locationDepartmentCode,
    locationCountry: legacyMeta.locationCountry,
    itinerantZone: resolvedItinerantZone,
    addressText: normalizedAddress.addressText,
    postalCode: normalizedAddress.postalCode,
    city: normalizedAddress.city,
    departmentCode: normalizedAddress.departmentCode,
    regionText: normalizedAddress.regionText,
    country: normalizedAddress.country,
    locationLabel: buildAccommodationLocationDisplayLabel({
      accommodationType: structured?.accommodationType,
      locationMode: resolvedLocationMode,
      itinerantZone: resolvedItinerantZone,
      ...normalizedAddress
    })
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
