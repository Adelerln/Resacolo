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
