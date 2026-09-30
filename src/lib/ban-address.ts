import { mapToCanonicalStayRegion } from '@/lib/stay-regions';

export type CityAddressSelection = {
  city: string;
  postalCode: string | null;
  /** Code département INSEE (ex. "79", "2A", "971"). */
  department: string | null;
  region: string | null;
  country: string | null;
};

type BanAddressProperties = {
  city?: string;
  name?: string;
  label?: string;
  postcode?: string;
  context?: string;
  /** Présent sur l’API Géoplateforme / BAN récente (parfois approximatif pour les DOM). */
  depcode?: string;
};

function isInseeDepartmentCode(value: string | null | undefined): value is string {
  if (!value) return false;
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  return /^\d{2,3}$/.test(compact) || /^2[AB]$/.test(compact);
}

function normalizeDepartmentCodeCandidate(value: string | null | undefined): string | null {
  if (!isInseeDepartmentCode(value)) return null;
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function parseBanMunicipalitySelection(
  properties: BanAddressProperties | undefined | null
): CityAddressSelection | null {
  if (!properties) return null;

  const city =
    properties.city?.trim() ||
    properties.name?.trim() ||
    properties.label?.split(',')[0]?.trim() ||
    null;
  if (!city) return null;

  const contextParts = (properties.context ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const contextCode = normalizeDepartmentCodeCandidate(contextParts[0] ?? null);
  const contextDepartmentName = contextCode
    ? (contextParts[1] ?? null)
    : (contextParts[0] ?? null);
  const contextRegionName = contextCode
    ? (contextParts[2] ?? null)
    : (contextParts[1] ?? null);

  // Préférer le code du contexte (ex. 971) au depcode API parfois tronqué (ex. 97 pour la Guadeloupe).
  const department =
    contextCode ||
    normalizeDepartmentCodeCandidate(properties.depcode) ||
    null;

  const regionRaw =
    contextRegionName ||
    // DOM / collectivités : contexte à 2 segments « 971, Guadeloupe » → le 2ᵉ segment est la région.
    (contextDepartmentName && !contextRegionName ? contextDepartmentName : null);

  const region =
    mapToCanonicalStayRegion(regionRaw) ??
    (regionRaw?.trim() || null);

  return {
    city,
    postalCode: properties.postcode?.trim() || null,
    department,
    region,
    country: 'France'
  };
}
