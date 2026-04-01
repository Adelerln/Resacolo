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

export type StayCategoryValue = (typeof STAY_CATEGORY_OPTIONS)[number]['value'];
export type StayCategoryLabel = (typeof STAY_CATEGORY_OPTIONS)[number]['label'];

export const STAY_CATEGORY_VALUES = STAY_CATEGORY_OPTIONS.map(
  (option) => option.value
) as StayCategoryValue[];
export const STAY_CATEGORY_LABELS = STAY_CATEGORY_OPTIONS.map(
  (option) => option.label
) as StayCategoryLabel[];

export const STAY_CATEGORY_VALUE_TO_LABEL = Object.fromEntries(
  STAY_CATEGORY_OPTIONS.map((option) => [option.value, option.label])
) as Record<StayCategoryValue, StayCategoryLabel>;

export const STAY_CATEGORY_LABEL_TO_VALUE = Object.fromEntries(
  STAY_CATEGORY_OPTIONS.map((option) => [option.label, option.value])
) as Record<StayCategoryLabel, StayCategoryValue>;

type NormalizeStayDraftCategoriesResult = {
  categories: StayCategoryLabel[];
  rejected: string[];
};

const CATEGORY_SPLIT_REGEX = /[\n,;|/+]+/g;

const DRAFT_CATEGORY_ALIASES: Record<string, StayCategoryValue> = {
  mer: 'mer',
  maritime: 'mer',
  plage: 'mer',
  nautique: 'mer',
  montagne: 'montagne',
  alpin: 'montagne',
  ski: 'montagne',
  campagne: 'campagne',
  nature: 'campagne',
  rural: 'campagne',
  artistique: 'artistique',
  art: 'artistique',
  arts: 'artistique',
  'arts plastiques': 'artistique',
  musique: 'artistique',
  danse: 'artistique',
  theatre: 'artistique',
  equestre: 'equestre',
  equitation: 'equestre',
  cheval: 'equestre',
  poney: 'equestre',
  linguistique: 'linguistique',
  langue: 'linguistique',
  scientifique: 'scientifique',
  science: 'scientifique',
  sciences: 'scientifique',
  sportif: 'sportif',
  sport: 'sportif',
  multisports: 'sportif',
  itinerant: 'itinerant',
  itinerance: 'itinerant',
  'road trip': 'itinerant',
  circuit: 'itinerant',
  etranger: 'etranger',
  international: 'etranger'
};

function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeCategoryKey(value: string | null | undefined): string {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const CATEGORY_VALUE_KEY_TO_VALUE = new Map<string, StayCategoryValue>(
  STAY_CATEGORY_VALUES.map((value) => [normalizeCategoryKey(value), value])
);

const CATEGORY_LABEL_KEY_TO_VALUE = new Map<string, StayCategoryValue>(
  STAY_CATEGORY_OPTIONS.map((option) => [normalizeCategoryKey(option.label), option.value])
);

function dedupeByNormalizedKey(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = normalizeCategoryKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function splitCategoryChunks(value: string): string[] {
  return value
    .split(CATEGORY_SPLIT_REGEX)
    .map((chunk) => normalizeWhitespace(chunk))
    .filter(Boolean);
}

export function normalizeStayCategories(values: string[]): StayCategoryValue[] {
  const seen = new Set<StayCategoryValue>();
  const output: StayCategoryValue[] = [];

  for (const value of values) {
    const key = normalizeCategoryKey(value);
    if (!key) continue;
    const canonical = CATEGORY_VALUE_KEY_TO_VALUE.get(key);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    output.push(canonical);
  }

  return output;
}

export function stayCategoryValueToLabel(value: string): StayCategoryLabel | null {
  const canonicalValue = normalizeStayCategories([value])[0];
  if (!canonicalValue) return null;
  return STAY_CATEGORY_VALUE_TO_LABEL[canonicalValue];
}

export function stayCategoryLabelToValue(value: string): StayCategoryValue | null {
  const key = normalizeCategoryKey(value);
  if (!key) return null;
  return (
    CATEGORY_LABEL_KEY_TO_VALUE.get(key) ??
    CATEGORY_VALUE_KEY_TO_VALUE.get(key) ??
    DRAFT_CATEGORY_ALIASES[key] ??
    null
  );
}

export function normalizeStayDraftCategories(
  values: string[] | null | undefined
): NormalizeStayDraftCategoriesResult {
  const categories: StayCategoryLabel[] = [];
  const rejected: string[] = [];
  const seen = new Set<StayCategoryLabel>();

  for (const rawValue of values ?? []) {
    if (typeof rawValue !== 'string') continue;
    const chunks = splitCategoryChunks(rawValue);

    for (const chunk of chunks) {
      const value = stayCategoryLabelToValue(chunk);
      if (!value) {
        rejected.push(chunk);
        continue;
      }

      const label = STAY_CATEGORY_VALUE_TO_LABEL[value];
      if (seen.has(label)) continue;
      seen.add(label);
      categories.push(label);
    }
  }

  return {
    categories,
    rejected: dedupeByNormalizedKey(rejected)
  };
}
