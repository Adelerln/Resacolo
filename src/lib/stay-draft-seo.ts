import { stayCategoryLabelToValue } from '@/lib/stay-categories';
import {
  buildStayH1Title,
  buildStayIntroText,
  buildStaySeoMetaDescription,
  buildStaySeoSuggestions,
  buildStaySeoTitle,
  buildStaySeoWarnings,
  sanitizeSeoPrimaryKeyword,
  sanitizeSeoTags,
  sanitizeSeoText,
  SEO_META_RECOMMENDED_MAX,
  SEO_META_RECOMMENDED_MIN,
  SEO_TITLE_RECOMMENDED_MAX,
  SEO_TITLE_RECOMMENDED_MIN,
  type SeoWarning
} from '@/lib/stay-seo';
import { slugify } from '@/lib/utils';
import type { Json } from '@/types/supabase';

export const STAY_DRAFT_SEO_GENERATION_SOURCE = 'stay-draft-seo-v1';

type SeoCheckLevel = 'ok' | 'warning' | 'info';

export type StaySeoCheck = {
  code: string;
  level: SeoCheckLevel;
  message: string;
};

export type StayDraftSeoSource = {
  title: string | null;
  summary: string | null;
  description: string | null;
  activities_text: string | null;
  program_text: string | null;
  location_text: string | null;
  region_text: string | null;
  categories: string[] | null;
  ages: number[] | null;
  age_min: number | null;
  age_max: number | null;
  sessions_json: Json | null;
};

export type GeneratedStayDraftSeo = {
  seo_primary_keyword: string | null;
  seo_secondary_keywords: string[];
  seo_target_city: string | null;
  seo_target_region: string | null;
  seo_search_intents: string[];
  seo_title: string | null;
  seo_meta_description: string | null;
  seo_intro_text: string | null;
  seo_h1_variant: string | null;
  seo_internal_link_anchor_suggestions: string[];
  seo_slug_candidate: string | null;
  seo_score: number;
  seo_checks: StaySeoCheck[];
  seo_generated_at: string;
  seo_generation_source: string;
};

function normalizeText(value: string | null | undefined) {
  return sanitizeSeoText(value ?? '');
}

function normalizeForMatch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function includesPhrase(haystack: string, needle: string) {
  if (!needle.trim()) return false;
  return normalizeForMatch(haystack).includes(normalizeForMatch(needle));
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value >= 3 && value <= 25))).sort(
    (a, b) => a - b
  );
}

function formatAgeRange(values: number[] | null | undefined, ageMin: number | null, ageMax: number | null) {
  const normalized = uniqueNumbers(values ?? []);
  if (normalized.length > 0) {
    if (normalized.length === 1) return `${normalized[0]} ans`;
    return `${normalized[0]}-${normalized[normalized.length - 1]} ans`;
  }
  if (Number.isFinite(ageMin) && Number.isFinite(ageMax) && ageMin != null && ageMax != null) {
    if (ageMin === ageMax) return `${ageMin} ans`;
    return `${ageMin}-${ageMax} ans`;
  }
  return '';
}

function readTargetCity(locationText: string) {
  const normalized = normalizeText(locationText);
  if (!normalized) return '';
  const firstChunk = normalized.split(',')[0]?.trim() ?? '';
  return firstChunk;
}

function parseSessionStartDates(sessionsJson: Json | null): Date[] {
  if (!Array.isArray(sessionsJson)) return [];
  return sessionsJson
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const value = (item as Record<string, unknown>).start_date;
      if (typeof value !== 'string') return null;
      const parsed = new Date(value);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    })
    .filter((date): date is Date => Boolean(date));
}

function inferSeasonName(sessionsJson: Json | null) {
  const dates = parseSessionStartDates(sessionsJson);
  if (dates.length === 0) return '';

  const counts = new Map<string, number>();
  for (const date of dates) {
    const month = date.getUTCMonth() + 1;
    const season =
      month === 10
        ? 'toussaint'
        : month >= 12 || month <= 2
          ? 'hiver'
          : month >= 3 && month <= 5
            ? 'printemps'
            : month >= 6 && month <= 8
              ? 'été'
              : 'automne';
    counts.set(season, (counts.get(season) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((left, right) => {
    if (left[1] !== right[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0], 'fr');
  });

  return sorted[0]?.[0] ?? '';
}

function deriveCategoryValues(categories: string[] | null | undefined) {
  const values = (categories ?? [])
    .map((category) => stayCategoryLabelToValue(category))
    .filter(
      (value): value is NonNullable<ReturnType<typeof stayCategoryLabelToValue>> => value !== null
    );
  return sanitizeSeoTags(values);
}

function pickFallbackSeoCategory(categoryValues: string[]) {
  const thematicPriority = [
    'artistique',
    'linguistique',
    'scientifique',
    'sportif',
    'equestre',
    'itinerant'
  ];
  for (const category of thematicPriority) {
    if (categoryValues.includes(category)) return category;
  }
  return categoryValues[0] ?? '';
}

function buildInternalAnchorSuggestions(input: {
  primaryKeyword: string;
  categoryValues: string[];
  targetCity: string;
  targetRegion: string;
  ageRange: string;
  seasonName: string;
}) {
  const baseByCategory: Record<string, string> = {
    mer: 'colonies de vacances à la mer',
    montagne: 'colonies de vacances à la montagne',
    campagne: 'colonies de vacances nature',
    artistique: 'séjours artistiques pour jeunes',
    equestre: 'colonies de vacances équitation',
    linguistique: 'séjours linguistiques pour adolescents',
    scientifique: 'séjours scientifiques pour jeunes',
    sportif: 'séjours sportifs pour adolescents',
    itinerant: 'séjours itinérants pour adolescents',
    etranger: "colonies de vacances à l'étranger"
  };

  const categoryBase = input.categoryValues[0] ? baseByCategory[input.categoryValues[0]] : '';
  const suggestions = sanitizeSeoTags([
    categoryBase,
    input.targetCity ? `colonies de vacances à ${input.targetCity}` : '',
    input.targetRegion ? `colonies de vacances en ${input.targetRegion}` : '',
    input.seasonName ? `colonies de vacances ${input.seasonName}` : '',
    input.ageRange ? `séjours pour ${input.ageRange}` : '',
    input.primaryKeyword
  ]);

  return suggestions.slice(0, 6);
}

function buildDraftSeoChecks(input: {
  title: string;
  metaDescription: string;
  primaryKeyword: string;
  warnings: SeoWarning[];
  hasLocationPrecision: boolean;
}) {
  const checks: StaySeoCheck[] = [];

  checks.push({
    code: 'has_primary_keyword',
    level: input.primaryKeyword ? 'ok' : 'warning',
    message: input.primaryKeyword
      ? 'Mot-clé principal défini.'
      : 'Mot-clé principal absent: ajoute une expression principale.'
  });

  checks.push({
    code: 'title_length',
    level:
      input.title.length >= SEO_TITLE_RECOMMENDED_MIN && input.title.length <= SEO_TITLE_RECOMMENDED_MAX
        ? 'ok'
        : 'warning',
    message: `Longueur du title: ${input.title.length} caractères (recommandé ${SEO_TITLE_RECOMMENDED_MIN}-${SEO_TITLE_RECOMMENDED_MAX}).`
  });

  checks.push({
    code: 'meta_length',
    level:
      input.metaDescription.length >= SEO_META_RECOMMENDED_MIN &&
      input.metaDescription.length <= SEO_META_RECOMMENDED_MAX
        ? 'ok'
        : 'warning',
    message: `Longueur de la meta description: ${input.metaDescription.length} caractères (recommandé ${SEO_META_RECOMMENDED_MIN}-${SEO_META_RECOMMENDED_MAX}).`
  });

  checks.push({
    code: 'primary_in_title',
    level:
      input.primaryKeyword && includesPhrase(input.title, input.primaryKeyword)
        ? 'ok'
        : input.primaryKeyword
          ? 'warning'
          : 'info',
    message:
      input.primaryKeyword && includesPhrase(input.title, input.primaryKeyword)
        ? 'Le mot-clé principal apparaît dans le title.'
        : 'Le mot-clé principal n’apparaît pas clairement dans le title.'
  });

  checks.push({
    code: 'location_precision',
    level: input.hasLocationPrecision ? 'ok' : 'info',
    message: input.hasLocationPrecision
      ? 'Localisation cible détectée (ville ou région).'
      : 'Ville/région manquante: le SEO géographique est moins précis.'
  });

  for (const warning of input.warnings) {
    checks.push({
      code: warning.code,
      level: 'warning',
      message: warning.message
    });
  }

  let score = 100;
  for (const check of checks) {
    if (check.level !== 'warning') continue;
    if (check.code === 'has_primary_keyword') score -= 20;
    else if (check.code === 'primary_in_title') score -= 10;
    else if (check.code === 'title_length' || check.code === 'meta_length') score -= 8;
    else if (check.code === 'keyword_stuffing') score -= 15;
    else if (check.code === 'keyword_incoherent') score -= 20;
    else score -= 6;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return { checks, score };
}

export function generateStayDraftSeo(source: StayDraftSeoSource): GeneratedStayDraftSeo {
  const title = normalizeText(source.title);
  const summary = normalizeText(source.summary);
  const description = normalizeText(source.description);
  const activitiesText = normalizeText(source.activities_text);
  const programText = normalizeText(source.program_text);
  const location = normalizeText(source.location_text);
  const region = normalizeText(source.region_text);
  const targetCity = readTargetCity(location);
  const targetRegion = region;
  const seasonName = inferSeasonName(source.sessions_json);
  const ageRange = formatAgeRange(source.ages, source.age_min, source.age_max);
  const categoryValues = deriveCategoryValues(source.categories);

  const context = {
    title,
    summary,
    description,
    activitiesText,
    programText,
    location,
    region,
    seasonName,
    ageRange,
    categories: categoryValues
  };

  const keywordSuggestions = buildStaySeoSuggestions({
    ...context,
    seo: {
      targetCity,
      targetRegion
    }
  });

  const categoryFallbackKeywordMap: Record<string, string> = {
    mer: 'colonie de vacances mer',
    montagne: 'colonie de vacances montagne',
    campagne: 'colonie de vacances nature',
    artistique: 'séjour artistique',
    equestre: 'colonie de vacances équitation',
    linguistique: 'séjour linguistique',
    scientifique: 'séjour scientifique',
    sportif: 'séjour sportif',
    itinerant: 'séjour itinérant',
    etranger: "colonie de vacances à l'étranger"
  };

  const fallbackPrimaryKeyword = sanitizeSeoTags([
    title,
    location ? `séjour à ${targetCity || location}` : '',
    (() => {
      const fallbackCategory = pickFallbackSeoCategory(categoryValues);
      return fallbackCategory ? categoryFallbackKeywordMap[fallbackCategory] ?? '' : '';
    })()
  ])[0];

  const primaryKeyword = sanitizeSeoPrimaryKeyword(keywordSuggestions[0] || fallbackPrimaryKeyword || '');
  const secondaryKeywords = sanitizeSeoTags([
    ...keywordSuggestions.slice(1),
    targetCity ? `colonie de vacances ${targetCity}` : '',
    targetRegion ? `colonie de vacances ${targetRegion}` : '',
    seasonName ? `colonie de vacances ${seasonName}` : '',
    ageRange ? `séjour ${ageRange}` : ''
  ]).slice(0, 10);
  const searchIntents = sanitizeSeoTags([
    ...secondaryKeywords,
    targetCity && primaryKeyword ? `${primaryKeyword} ${targetCity}` : ''
  ]).slice(0, 6);

  const seoInput = {
    ...context,
    seo: {
      primaryKeyword,
      secondaryKeywords,
      targetCity,
      targetRegion,
      searchIntents
    }
  };

  const seoTitle = buildStaySeoTitle(seoInput);
  const seoMetaDescription = buildStaySeoMetaDescription(seoInput);
  const seoIntroText = buildStayIntroText({
    ...seoInput,
    seo: {
      ...seoInput.seo,
      introText: ''
    }
  });
  const seoH1VariantCandidate = buildStayH1Title({
    ...seoInput,
    seo: {
      ...seoInput.seo,
      h1Variant: ''
    }
  });
  const seoH1Variant = seoH1VariantCandidate !== title ? seoH1VariantCandidate : '';

  const internalLinkAnchorSuggestions = buildInternalAnchorSuggestions({
    primaryKeyword,
    categoryValues,
    targetCity,
    targetRegion,
    ageRange,
    seasonName
  });

  const warnings = buildStaySeoWarnings({
    ...seoInput,
    seo: {
      ...seoInput.seo,
      title: seoTitle,
      metaDescription: seoMetaDescription
    }
  });

  const { checks, score } = buildDraftSeoChecks({
    title: seoTitle,
    metaDescription: seoMetaDescription,
    primaryKeyword,
    warnings,
    hasLocationPrecision: Boolean(targetCity || targetRegion)
  });

  const now = new Date().toISOString();

  return {
    seo_primary_keyword: primaryKeyword || null,
    seo_secondary_keywords: secondaryKeywords,
    seo_target_city: targetCity || null,
    seo_target_region: targetRegion || null,
    seo_search_intents: searchIntents,
    seo_title: seoTitle || null,
    seo_meta_description: seoMetaDescription || null,
    seo_intro_text: seoIntroText || null,
    seo_h1_variant: seoH1Variant || null,
    seo_internal_link_anchor_suggestions: internalLinkAnchorSuggestions,
    seo_slug_candidate: slugify(primaryKeyword || title) || null,
    seo_score: score,
    seo_checks: checks,
    seo_generated_at: now,
    seo_generation_source: STAY_DRAFT_SEO_GENERATION_SOURCE
  };
}
