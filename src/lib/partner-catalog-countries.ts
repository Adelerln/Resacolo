import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';

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

export function extractCountriesFromStay(input: {
  destination_country: string | null;
  destination_countries: string[] | null;
}) {
  const labels: string[] = [];
  const primary = String(input.destination_country ?? '').trim();
  if (primary) labels.push(primary);
  for (const country of input.destination_countries ?? []) {
    const label = String(country ?? '').trim();
    if (label) labels.push(label);
  }
  return mergeCountryLabels(labels);
}

export async function listSiteStayCountryLabels() {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('stays')
    .select('destination_country, destination_countries')
    .eq('status', 'PUBLISHED');

  if (error) {
    throw new Error(`Impossible de charger les pays des séjours : ${error.message}`);
  }

  const labels: string[] = [];
  for (const stay of data ?? []) {
    labels.push(...extractCountriesFromStay(stay));
  }
  return mergeCountryLabels(labels);
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
  rules: PartnerCatalogRules
) {
  return mergeCountryLabels(
    siteCountries,
    rules.blockingRules.countriesAllowed,
    rules.blockingRules.countriesExcluded
  );
}

export function applyCountryDecision(
  rules: PartnerCatalogRules,
  country: string,
  decision: 'allowed' | 'excluded'
): PartnerCatalogRules {
  const label = country.trim();
  if (!label) return rules;

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
      countriesAllowed: mergeCountryLabels(countriesAllowed),
      countriesExcluded: mergeCountryLabels(countriesExcluded)
    },
    meta: {
      knownSiteCountries: mergeCountryLabels(getKnownSiteCountries(rules), [label])
    }
  };
}

export function syncKnownSiteCountriesWithRules(
  rules: PartnerCatalogRules,
  siteCountries: string[]
): PartnerCatalogRules {
  return {
    ...rules,
    meta: {
      knownSiteCountries: mergeCountryLabels(
        getKnownSiteCountries(rules),
        siteCountries,
        rules.blockingRules.countriesAllowed,
        rules.blockingRules.countriesExcluded
      )
    }
  };
}
