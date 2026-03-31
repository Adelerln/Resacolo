export const STAY_REGION_OPTIONS = [
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Guadeloupe',
  'Guyane',
  'Hauts-de-France',
  'Île-de-France',
  'La Réunion',
  'Martinique',
  'Mayotte',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Côte d'Azur",
  'Étranger'
] as const;

export type StayRegion = (typeof STAY_REGION_OPTIONS)[number];

const STAY_REGION_SET = new Set<string>(STAY_REGION_OPTIONS);
const STAY_REGION_KEY_TO_VALUE = new Map(
  STAY_REGION_OPTIONS.map((region) => [simplifyForMatch(region), region])
);

const STAY_REGION_ALIASES: Array<{ key: string; region: StayRegion }> = [
  { key: 'bourgogne', region: 'Bourgogne-Franche-Comté' },
  { key: 'franche comte', region: 'Bourgogne-Franche-Comté' },
  { key: 'paca', region: "Provence-Alpes-Côte d'Azur" },
  { key: 'cote d azur', region: "Provence-Alpes-Côte d'Azur" },
  { key: 'provence alpes cote d azur', region: "Provence-Alpes-Côte d'Azur" },
  { key: 'ile de france', region: 'Île-de-France' },
  { key: 'idf', region: 'Île-de-France' },
  { key: 'rhone alpes', region: 'Auvergne-Rhône-Alpes' },
  { key: 'auvergne rhone alpes', region: 'Auvergne-Rhône-Alpes' },
  { key: 'pays de loire', region: 'Pays de la Loire' },
  { key: 'centre val de loire', region: 'Centre-Val de Loire' },
  { key: 'nord pas de calais', region: 'Hauts-de-France' },
  { key: 'picardie', region: 'Hauts-de-France' },
  { key: 'alsace', region: 'Grand Est' },
  { key: 'lorraine', region: 'Grand Est' },
  { key: 'champagne ardenne', region: 'Grand Est' },
  { key: 'languedoc roussillon', region: 'Occitanie' },
  { key: 'midi pyrenees', region: 'Occitanie' },
  { key: 'aquitaine', region: 'Nouvelle-Aquitaine' },
  { key: 'limousin', region: 'Nouvelle-Aquitaine' },
  { key: 'poitou charentes', region: 'Nouvelle-Aquitaine' },
  { key: 'dom tom', region: 'Étranger' },
  { key: 'outre mer', region: 'Étranger' }
];

function simplifyForMatch(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function mapToCanonicalStayRegion(
  value: FormDataEntryValue | string | null | undefined
): StayRegion | null {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) return null;

  if (STAY_REGION_SET.has(normalizedValue)) {
    return normalizedValue as StayRegion;
  }

  const key = simplifyForMatch(normalizedValue);
  if (!key) return null;

  const direct = STAY_REGION_KEY_TO_VALUE.get(key);
  if (direct) return direct;

  const aliasExact = STAY_REGION_ALIASES.find((alias) => alias.key === key);
  if (aliasExact) return aliasExact.region;

  const aliasIncludes = STAY_REGION_ALIASES.find(
    (alias) => key.includes(alias.key) || alias.key.includes(key)
  );
  if (aliasIncludes) return aliasIncludes.region;

  const canonicalIncludes = STAY_REGION_OPTIONS.find((region) => {
    const regionKey = simplifyForMatch(region);
    return key.includes(regionKey) || regionKey.includes(key);
  });

  return canonicalIncludes ?? null;
}

export function normalizeStayRegion(value: FormDataEntryValue | string | null | undefined): StayRegion | null {
  return mapToCanonicalStayRegion(value);
}

export function isMissingRegionTextColumnError(message: string | null | undefined) {
  return (message ?? '').toLowerCase().includes('region_text');
}
