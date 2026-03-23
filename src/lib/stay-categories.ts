export const STAY_CATEGORY_OPTIONS = [
  { value: 'mer', label: 'Séjour à la mer' },
  { value: 'montagne', label: 'Séjour à la montagne' },
  { value: 'campagne', label: 'Séjour à la campagne' },
  { value: 'artistique', label: 'Séjour artistique' },
  { value: 'equestre', label: 'Séjour équestre' },
  { value: 'linguistique', label: 'Séjour linguistique' },
  { value: 'scientifique', label: 'Séjour scientifique' },
  { value: 'sportif', label: 'Séjour sportif' },
  { value: 'itinerant', label: 'Séjour itinérant' },
  { value: 'etranger', label: "Séjour à l'étranger" }
] as const;

export const STAY_CATEGORY_VALUES = STAY_CATEGORY_OPTIONS.map((option) => option.value);

export function normalizeStayCategories(values: string[]) {
  const allowed = new Set(STAY_CATEGORY_VALUES);
  return Array.from(new Set(values.filter((value): value is (typeof STAY_CATEGORY_VALUES)[number] => allowed.has(value as (typeof STAY_CATEGORY_VALUES)[number]))));
}
