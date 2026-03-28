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

export function normalizeStayRegion(value: FormDataEntryValue | string | null | undefined): StayRegion | null {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return null;
  }

  return STAY_REGION_SET.has(normalizedValue) ? (normalizedValue as StayRegion) : null;
}

export function isMissingRegionTextColumnError(message: string | null | undefined) {
  return (message ?? '').toLowerCase().includes('region_text');
}
