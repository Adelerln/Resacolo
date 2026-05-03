import { mapToCanonicalStayRegion } from '@/lib/stay-regions';
import type { Stay } from '@/types/stay';

export const FRANCE_REGION_ID_BY_CANONICAL_NAME: Record<string, string> = {
  'Hauts-de-France': 'FRHDF',
  'Grand Est': 'FRGES',
  "Provence-Alpes-Côte d'Azur": 'FRPAC',
  'Auvergne-Rhône-Alpes': 'FRARA',
  'Bourgogne-Franche-Comté': 'FRBFC',
  Occitanie: 'FROCC',
  'Pays de la Loire': 'FRPDL',
  Bretagne: 'FRBRE',
  Normandie: 'FRNOR',
  Corse: 'FR20R',
  'Nouvelle-Aquitaine': 'FRNAQ',
  'Centre-Val de Loire': 'FRCVL',
  'Île-de-France': 'FRIDF'
};

type HomeDestinationAvailability = {
  activeFranceRegionIds: string[];
  activeCountryNames: string[];
  hasFranceDestinations: boolean;
};

function cleanText(value: string | null | undefined) {
  return (value ?? '').trim();
}

function normalizeText(value: string | null | undefined) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isFranceLikeCountry(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized === 'france';
}

function extractCountryFromLocationCandidate(value: string | null | undefined) {
  const candidate = cleanText(value);
  if (!candidate) return null;

  const parenthesisMatch = candidate.match(/\(([^()]+)\)\s*$/);
  if (parenthesisMatch) {
    const inside = cleanText(parenthesisMatch[1]);
    if (inside && !/^\d{2,3}[a-z]?$/i.test(inside)) {
      return inside;
    }
  }

  const commaParts = candidate
    .split(',')
    .map((part) => cleanText(part))
    .filter(Boolean);
  if (commaParts.length >= 2) {
    return commaParts.at(-1) ?? null;
  }

  const dashParts = candidate
    .split(/\s[-–]\s/)
    .map((part) => cleanText(part))
    .filter(Boolean);
  if (dashParts.length >= 2) {
    return dashParts.at(-1) ?? null;
  }

  return null;
}

function extractForeignCountry(stay: Stay) {
  const accommodationLabels = (stay.accommodations ?? [])
    .map((accommodation) => cleanText(accommodation.locationLabel))
    .filter(Boolean);
  const candidates = [stay.displayLocation, stay.location, ...accommodationLabels];

  for (const candidate of candidates) {
    const country = extractCountryFromLocationCandidate(candidate);
    if (country && !isFranceLikeCountry(country)) {
      return country;
    }
  }

  return null;
}

export function deriveHomeDestinationAvailability(stays: Stay[]): HomeDestinationAvailability {
  const activeFranceRegionIds = new Set<string>();
  const activeCountryNames = new Set<string>();
  let hasFranceDestinations = false;

  for (const stay of stays) {
    const canonicalRegion = mapToCanonicalStayRegion(stay.destinationRegion ?? stay.region);

    if (stay.destinationType === 'fixed_france' && canonicalRegion && canonicalRegion !== 'Étranger') {
      hasFranceDestinations = true;

      const regionId = FRANCE_REGION_ID_BY_CANONICAL_NAME[canonicalRegion];
      if (regionId) {
        activeFranceRegionIds.add(regionId);
      }
      continue;
    }

    const countries =
      stay.destinationType === 'itinerant'
        ? stay.destinationCountries ?? []
        : stay.destinationCountry
          ? [stay.destinationCountry]
          : [];

    for (const country of countries) {
      const cleaned = country.trim();
      if (cleaned && cleaned.toLowerCase() !== 'france') {
        activeCountryNames.add(cleaned);
      }
    }
  }

  return {
    activeFranceRegionIds: Array.from(activeFranceRegionIds),
    activeCountryNames: Array.from(activeCountryNames),
    hasFranceDestinations
  };
}
