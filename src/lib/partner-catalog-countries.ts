import { resolveDepartmentCodeFromFrenchName } from '@/lib/french-department-codes';
import { resolveStayDestination } from '@/lib/stay-destination-resolver';
import { mapToCanonicalStayRegion } from '@/lib/stay-regions';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';

type StayCountrySource = {
  destination_type?: string | null;
  destination_country?: string | null;
  destination_countries?: string[] | null;
  destination_city?: string | null;
  destination_region?: string | null;
  region_text?: string | null;
  location_text?: string | null;
  destination_itinerary_label?: string | null;
};

function isFranceCountryLabel(label: string) {
  return label.trim().toLocaleLowerCase('fr') === 'france';
}

function collectFrenchPlaceDenylist(stays: StayCountrySource[]) {
  const denylist = new Set<string>();

  for (const stay of stays) {
    const city = String(stay.destination_city ?? '').trim();
    if (city) {
      denylist.add(countryLabelKey(city));
    }

    const locationCity = String(stay.location_text ?? '')
      .split(',')[0]
      ?.trim();
    if (locationCity && !isFranceCountryLabel(locationCity)) {
      denylist.add(countryLabelKey(locationCity));
    }

    const destinationType = stay.destination_type;
    const rawCountry = String(stay.destination_country ?? '').trim();
    if (
      rawCountry &&
      !isFranceCountryLabel(rawCountry) &&
      destinationType !== 'fixed_abroad' &&
      destinationType !== 'itinerant'
    ) {
      denylist.add(countryLabelKey(rawCountry));
    }

    if (destinationType !== 'fixed_abroad' && destinationType !== 'itinerant') {
      for (const label of stay.destination_countries ?? []) {
        const cleaned = String(label ?? '').trim();
        if (cleaned && !isFranceCountryLabel(cleaned)) {
          denylist.add(countryLabelKey(cleaned));
        }
      }
    }

    const resolved = resolveStayDestination({
      destinationType: stay.destination_type,
      destinationCountry: stay.destination_country,
      destinationCountries: stay.destination_countries,
      destinationCity: stay.destination_city,
      destinationRegion: stay.destination_region,
      regionText: stay.region_text,
      locationText: stay.location_text,
      destinationItineraryLabel: stay.destination_itinerary_label
    });

    if (resolved.destinationType === 'fixed_france' || resolved.destinationRegion) {
      for (const candidate of [
        stay.destination_country,
        stay.destination_city,
        stay.location_text?.split(',')[0]
      ]) {
        const label = String(candidate ?? '').trim();
        if (!label || isFranceCountryLabel(label)) continue;
        denylist.add(countryLabelKey(label));
      }
    }
  }

  return denylist;
}

export function isCatalogCountryLabel(label: string, denylist?: ReadonlySet<string>) {
  const trimmed = label.trim();
  if (!trimmed) return false;
  if (isFranceCountryLabel(trimmed)) return true;

  const key = countryLabelKey(trimmed);
  if (denylist?.has(key)) return false;

  const canonicalRegion = mapToCanonicalStayRegion(trimmed);
  if (canonicalRegion && canonicalRegion !== 'Étranger') return false;
  if (trimmed === 'Étranger') return false;
  if (resolveDepartmentCodeFromFrenchName(trimmed)) return false;
  if (/^le\s+/i.test(trimmed)) return false;

  return true;
}

export function extractCatalogCountryLabelsFromStay(
  stay: StayCountrySource,
  denylist?: ReadonlySet<string>
) {
  const resolved = resolveStayDestination({
    destinationType: stay.destination_type,
    destinationCountry: stay.destination_country,
    destinationCountries: stay.destination_countries,
    destinationCity: stay.destination_city,
    destinationRegion: stay.destination_region,
    regionText: stay.region_text,
    locationText: stay.location_text,
    destinationItineraryLabel: stay.destination_itinerary_label
  });

  if (resolved.destinationType === 'fixed_france') {
    return ['France'];
  }

  if (resolved.destinationRegion && !resolved.destinationType) {
    return ['France'];
  }

  if (resolved.destinationType !== 'fixed_abroad' && resolved.destinationType !== 'itinerant') {
    return [];
  }

  const labels: string[] = [];
  const cityKey = countryLabelKey(resolved.destinationCity ?? '');

  if (resolved.destinationCountry) {
    const countryKey = countryLabelKey(resolved.destinationCountry);
    if (
      countryKey !== cityKey &&
      isCatalogCountryLabel(resolved.destinationCountry, denylist)
    ) {
      labels.push(resolved.destinationCountry);
    }
  }

  for (const country of resolved.destinationCountries) {
    const countryKey = countryLabelKey(country);
    if (countryKey === cityKey) continue;
    if (isCatalogCountryLabel(country, denylist)) {
      labels.push(country);
    }
  }

  return mergeCountryLabels(labels);
}

export function countryLabelKey(label: string) {
  return label.trim().toLocaleLowerCase('fr');
}

export function mergeCountryLabels(...lists: Array<string[] | undefined | null>) {
  const map = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list ?? []) {
      const label = String(raw ?? '').trim();
      if (!label) continue;
      const key = countryLabelKey(label);
      if (!map.has(key)) map.set(key, label);
    }
  }
  return Array.from(map.values()).sort((left, right) =>
    left.localeCompare(right, 'fr', { sensitivity: 'base' })
  );
}

export function extractCountriesFromStay(input: StayCountrySource) {
  return extractCatalogCountryLabelsFromStay(input);
}

export async function listSiteStayCountryLabels() {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('stays')
    .select(
      'destination_type, destination_country, destination_countries, destination_city, destination_region, region_text, location_text, destination_itinerary_label'
    )
    .eq('status', 'PUBLISHED');

  if (error) {
    throw new Error(`Impossible de charger les pays des séjours : ${error.message}`);
  }

  const stays = data ?? [];
  const denylist = collectFrenchPlaceDenylist(stays);
  const labels: string[] = [];

  for (const stay of stays) {
    labels.push(...extractCatalogCountryLabelsFromStay(stay, denylist));
  }

  return mergeCountryLabels(labels.filter((label) => isCatalogCountryLabel(label, denylist)));
}

export function getKnownSiteCountries(rules: PartnerCatalogRules) {
  return mergeCountryLabels(rules.meta?.knownSiteCountries ?? []);
}

export function findNewSiteCountries(siteCountries: string[], knownSiteCountries: string[]) {
  const known = new Set(knownSiteCountries.map(countryLabelKey));
  return siteCountries.filter((country) => !known.has(countryLabelKey(country)));
}

export function buildCatalogCountryOptions(
  siteCountries: string[],
  _rules: PartnerCatalogRules
) {
  return mergeCountryLabels(siteCountries.filter((label) => isCatalogCountryLabel(label)));
}

export function applyCountryDecision(
  rules: PartnerCatalogRules,
  country: string,
  decision: 'allowed' | 'excluded'
): PartnerCatalogRules {
  const label = country.trim();
  if (!label || !isCatalogCountryLabel(label)) return rules;

  const key = countryLabelKey(label);
  const countriesAllowed = rules.blockingRules.countriesAllowed.filter(
    (entry) => countryLabelKey(entry) !== key
  );
  const countriesExcluded = rules.blockingRules.countriesExcluded.filter(
    (entry) => countryLabelKey(entry) !== key
  );

  if (decision === 'allowed') {
    countriesAllowed.push(label);
  } else {
    countriesExcluded.push(label);
  }

  return {
    ...rules,
    blockingRules: {
      ...rules.blockingRules,
      countriesAllowed: mergeCountryLabels(countriesAllowed.filter(isCatalogCountryLabel)),
      countriesExcluded: mergeCountryLabels(countriesExcluded.filter(isCatalogCountryLabel))
    },
    meta: {
      knownSiteCountries: mergeCountryLabels(getKnownSiteCountries(rules).filter(isCatalogCountryLabel), [
        label
      ])
    }
  };
}

export function syncKnownSiteCountriesWithRules(
  rules: PartnerCatalogRules,
  siteCountries: string[]
): PartnerCatalogRules {
  const cleanedSiteCountries = mergeCountryLabels(
    siteCountries.filter((label) => isCatalogCountryLabel(label))
  );

  return {
    ...rules,
    blockingRules: {
      ...rules.blockingRules,
      countriesAllowed: rules.blockingRules.countriesAllowed.filter((label) =>
        cleanedSiteCountries.some((country) => countryLabelKey(country) === countryLabelKey(label))
      ),
      countriesExcluded: rules.blockingRules.countriesExcluded.filter((label) =>
        cleanedSiteCountries.some((country) => countryLabelKey(country) === countryLabelKey(label))
      )
    },
    meta: {
      knownSiteCountries: cleanedSiteCountries
    }
  };
}
