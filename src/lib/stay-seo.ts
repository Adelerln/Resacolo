import type { Stay } from '@/types/stay';

export const SEO_TITLE_RECOMMENDED_MIN = 50;
export const SEO_TITLE_RECOMMENDED_MAX = 60;
export const SEO_META_RECOMMENDED_MIN = 140;
export const SEO_META_RECOMMENDED_MAX = 160;

const MAX_SEO_TAGS = 12;
const SEO_TITLE_BRAND_SUFFIX = ' | Resacolo';

const ACTIVITY_KEYWORDS = [
  'surf',
  'ski',
  'snowboard',
  'equitation',
  'cheval',
  'poney',
  'danse',
  'theatre',
  'manga',
  'anglais',
  'linguistique',
  'escalade',
  'voile',
  'foot',
  'football',
  'basket',
  'tennis',
  'moto',
  'scientifique',
  'science',
  'robotique'
];

const CATEGORY_TO_SEO_BASE: Record<string, string> = {
  mer: 'colonie de vacances mer',
  montagne: 'colonie de vacances montagne',
  campagne: 'colonie de vacances nature',
  artistique: 'colonie artistique',
  equestre: 'colonie équitation',
  linguistique: 'séjour linguistique',
  scientifique: 'séjour scientifique',
  sportif: 'séjour sportif',
  itinerant: 'séjour itinérant',
  etranger: 'colonie de vacances à l’étranger'
};

type StaySeoContext = {
  title: string;
  summary?: string;
  description?: string;
  activitiesText?: string;
  programText?: string;
  location?: string;
  region?: string;
  seasonName?: string;
  ageRange?: string;
  categories?: string[];
};

type StaySeoFields = {
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  targetCity?: string;
  targetRegion?: string;
  searchIntents?: string[];
  title?: string;
  metaDescription?: string;
  introText?: string;
  h1Variant?: string;
  internalLinkAnchorSuggestions?: string[];
  slugCandidate?: string;
  score?: number;
  checks?: Array<{
    code: string;
    level: 'ok' | 'warning' | 'info';
    message: string;
  }>;
  generatedAt?: string;
  generationSource?: string;
};

export type StaySeoInput = StaySeoContext & { seo?: StaySeoFields };

type RelatedStayLink = {
  stayId: string;
  href: string;
  anchorText: string;
  title: string;
};

type SeoWarningCode =
  | 'missing_primary_keyword'
  | 'title_too_short'
  | 'title_too_long'
  | 'meta_too_short'
  | 'meta_too_long'
  | 'keyword_stuffing'
  | 'keyword_incoherent';

export type SeoWarning = {
  code: SeoWarningCode;
  message: string;
};

function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForMatch(value: string) {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(value: string) {
  return normalizeForMatch(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function dedupeKeywords(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = normalizeForMatch(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= MAX_SEO_TAGS) break;
  }
  return output;
}

function stripTrailingSeparator(value: string) {
  return value
    .replace(/\s*[|/-]\s*$/g, '')
    .trim();
}

function stripTrailingBrand(value: string) {
  return value
    .replace(/\s*(?:(?:\||\/|-)\s*)?resacolo\s*$/i, '')
    .trim();
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const truncated = value.slice(0, maxLength - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace < 30) return `${truncated}…`;
  return `${truncated.slice(0, lastSpace)}…`;
}

function withSeoTitleBrandSuffix(value: string) {
  const normalized = stripTrailingSeparator(stripTrailingBrand(normalizeWhitespace(value)));
  const base = normalized || 'Séjour enfants et adolescents';
  const maxBaseLength = Math.max(1, SEO_TITLE_RECOMMENDED_MAX - SEO_TITLE_BRAND_SUFFIX.length);
  const truncatedBase = stripTrailingSeparator(truncateAtWord(base, maxBaseLength));
  return `${truncatedBase}${SEO_TITLE_BRAND_SUFFIX}`;
}

function includesPhrase(haystack: string, needle: string) {
  if (!needle) return false;
  return normalizeForMatch(haystack).includes(normalizeForMatch(needle));
}

function firstDestinationToken(input: StaySeoInput) {
  const targetCity = normalizeWhitespace(input.seo?.targetCity);
  if (targetCity) return targetCity;
  const location = normalizeWhitespace(input.location);
  if (location) {
    const firstChunk = location.split(',')[0]?.trim();
    if (firstChunk) return firstChunk;
  }
  const targetRegion = normalizeWhitespace(input.seo?.targetRegion);
  if (targetRegion) return targetRegion;
  const region = normalizeWhitespace(input.region);
  if (region) return region;
  return '';
}

function findActivityKeyword(input: StaySeoInput) {
  const content = normalizeForMatch(
    `${input.activitiesText ?? ''} ${input.programText ?? ''} ${input.title ?? ''}`
  );
  for (const keyword of ACTIVITY_KEYWORDS) {
    if (content.includes(keyword)) return keyword;
  }
  return '';
}

function deriveAudienceLabel(ageRange: string | undefined) {
  const range = normalizeWhitespace(ageRange);
  const numbers = range.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
  if (numbers.length === 0) return '';
  const max = Math.max(...numbers);
  return max >= 13 ? 'adolescents' : 'enfants';
}

function buildSeoBaseLabel(input: StaySeoInput) {
  const categories = input.categories ?? [];
  const firstCategory = categories[0] ?? '';
  return CATEGORY_TO_SEO_BASE[firstCategory] ?? 'colonie de vacances';
}

function buildFallbackTitle(input: StaySeoInput) {
  const primaryKeyword = normalizeWhitespace(input.seo?.primaryKeyword);
  const stayTitle = normalizeWhitespace(input.title);
  const destination = firstDestinationToken(input);
  const parts: string[] = [];

  if (primaryKeyword) {
    parts.push(primaryKeyword);
    if (stayTitle && !includesPhrase(primaryKeyword, stayTitle)) {
      parts.push(stayTitle);
    }
  } else if (stayTitle) {
    parts.push(stayTitle);
  }

  if (destination && !includesPhrase(parts.join(' '), destination)) {
    parts.push(destination);
  }

  let value = stripTrailingSeparator(parts.filter(Boolean).join(' | '));
  if (!value) {
    value = 'Séjour enfants et adolescents';
  }
  return value;
}

function buildFallbackMetaDescription(input: StaySeoInput) {
  const primaryKeyword = normalizeWhitespace(input.seo?.primaryKeyword);
  const secondaryKeywords = dedupeKeywords(input.seo?.secondaryKeywords ?? []);
  const destination = firstDestinationToken(input);
  const audience = deriveAudienceLabel(input.ageRange);
  const season = normalizeWhitespace(input.seasonName);
  const summary = normalizeWhitespace(input.summary);
  const description = normalizeWhitespace(input.description);

  const sentences: string[] = [];
  if (summary) {
    sentences.push(summary);
  } else if (description) {
    sentences.push(description);
  }

  if (primaryKeyword && !includesPhrase(sentences.join(' '), primaryKeyword)) {
    sentences.push(`Découvrez ${primaryKeyword}.`);
  }

  if (destination && !includesPhrase(sentences.join(' '), destination)) {
    sentences.push(`Destination: ${destination}.`);
  }

  if (audience && !includesPhrase(sentences.join(' '), audience)) {
    sentences.push(`Pour les ${audience}.`);
  }

  if (season && !includesPhrase(sentences.join(' '), season)) {
    sentences.push(`Disponible sur la saison ${season.toLowerCase()}.`);
  }

  const firstSecondary = secondaryKeywords.find((keyword) => !includesPhrase(sentences.join(' '), keyword));
  if (firstSecondary) {
    sentences.push(`Idéal pour ${firstSecondary}.`);
  }

  if (sentences.length === 0) {
    sentences.push('Découvrez ce séjour pensé pour les enfants et adolescents avec activités encadrées.');
  }

  const composed = sentences.join(' ').replace(/\s+/g, ' ').trim();
  return truncateAtWord(composed, SEO_META_RECOMMENDED_MAX);
}

function countPhraseOccurrences(haystack: string, phrase: string) {
  const normalizedHaystack = normalizeForMatch(haystack);
  const normalizedPhrase = normalizeForMatch(phrase);
  if (!normalizedPhrase) return 0;

  let count = 0;
  let index = 0;
  while (index <= normalizedHaystack.length - normalizedPhrase.length) {
    const foundAt = normalizedHaystack.indexOf(normalizedPhrase, index);
    if (foundAt === -1) break;
    count += 1;
    index = foundAt + normalizedPhrase.length;
  }
  return count;
}

function isPrimaryKeywordCoherent(input: StaySeoInput) {
  const primaryKeyword = normalizeWhitespace(input.seo?.primaryKeyword);
  if (!primaryKeyword) return true;

  const tokens = tokenize(primaryKeyword).filter((token) => token.length >= 4);
  if (tokens.length === 0) return true;

  const content = normalizeForMatch(
    [
      input.title,
      input.summary,
      input.description,
      input.activitiesText,
      input.programText,
      input.location,
      input.region,
      input.seasonName,
      input.ageRange,
      ...(input.categories ?? [])
    ]
      .filter(Boolean)
      .join(' ')
  );

  const matched = tokens.filter((token) => content.includes(token)).length;
  return matched >= Math.max(1, Math.floor(tokens.length / 2));
}

function contextualAnchorText(current: Stay, candidate: Stay) {
  const candidateKeyword = normalizeWhitespace(candidate.seo?.primaryKeyword);
  const candidateTitle = normalizeWhitespace(candidate.title);
  const candidateRegion = normalizeWhitespace(candidate.seo?.targetRegion || candidate.region);
  const candidateCity = normalizeWhitespace(candidate.seo?.targetCity || candidate.location);
  const currentRegion = normalizeWhitespace(current.seo?.targetRegion || current.region);

  if (candidateKeyword) {
    if (candidateRegion && candidateRegion === currentRegion) {
      return `${candidateKeyword} en ${candidateRegion}`;
    }
    return candidateKeyword;
  }

  if (candidateCity) {
    return `${candidateTitle} à ${candidateCity}`;
  }

  if (candidateRegion) {
    return `${candidateTitle} en ${candidateRegion}`;
  }

  return candidateTitle;
}

function sanitizeSeoContext(input: StaySeoInput): StaySeoInput {
  const secondaryKeywords = dedupeKeywords(input.seo?.secondaryKeywords ?? []);
  const searchIntents = dedupeKeywords(input.seo?.searchIntents ?? []);
  const internalLinkAnchorSuggestions = dedupeKeywords(input.seo?.internalLinkAnchorSuggestions ?? []);

  return {
    ...input,
    title: normalizeWhitespace(input.title),
    summary: normalizeWhitespace(input.summary),
    description: normalizeWhitespace(input.description),
    activitiesText: normalizeWhitespace(input.activitiesText),
    programText: normalizeWhitespace(input.programText),
    location: normalizeWhitespace(input.location),
    region: normalizeWhitespace(input.region),
    seasonName: normalizeWhitespace(input.seasonName),
    ageRange: normalizeWhitespace(input.ageRange),
    categories: dedupeKeywords(input.categories ?? []),
    seo: {
      primaryKeyword: normalizeWhitespace(input.seo?.primaryKeyword) || undefined,
      secondaryKeywords,
      targetCity: normalizeWhitespace(input.seo?.targetCity) || undefined,
      targetRegion: normalizeWhitespace(input.seo?.targetRegion) || undefined,
      searchIntents,
      title: normalizeWhitespace(input.seo?.title) || undefined,
      metaDescription: normalizeWhitespace(input.seo?.metaDescription) || undefined,
      introText: normalizeWhitespace(input.seo?.introText) || undefined,
      h1Variant: normalizeWhitespace(input.seo?.h1Variant) || undefined,
      internalLinkAnchorSuggestions,
      slugCandidate: normalizeWhitespace(input.seo?.slugCandidate) || undefined,
      score: Number.isFinite(input.seo?.score) ? Math.round(Number(input.seo?.score)) : undefined,
      checks: Array.isArray(input.seo?.checks) ? input.seo?.checks : undefined,
      generatedAt: normalizeWhitespace(input.seo?.generatedAt) || undefined,
      generationSource: normalizeWhitespace(input.seo?.generationSource) || undefined
    }
  };
}

export function sanitizeSeoText(value: FormDataEntryValue | string | null | undefined) {
  return normalizeWhitespace(typeof value === 'string' ? value : String(value ?? ''));
}

export function sanitizeSeoTags(values: Array<FormDataEntryValue | string | null | undefined>) {
  return dedupeKeywords(values.map((value) => sanitizeSeoText(value)));
}

export function buildStaySeoTitle(input: StaySeoInput) {
  const sanitized = sanitizeSeoContext(input);
  if (sanitized.seo?.title) {
    return withSeoTitleBrandSuffix(sanitized.seo.title);
  }
  return withSeoTitleBrandSuffix(buildFallbackTitle(sanitized));
}

export function buildStaySeoMetaDescription(input: StaySeoInput) {
  const sanitized = sanitizeSeoContext(input);
  if (sanitized.seo?.metaDescription) {
    return truncateAtWord(sanitized.seo.metaDescription, SEO_META_RECOMMENDED_MAX);
  }
  return buildFallbackMetaDescription(sanitized);
}

export function buildStaySeoKeywords(input: StaySeoInput) {
  const sanitized = sanitizeSeoContext(input);
  return dedupeKeywords([
    sanitized.seo?.primaryKeyword ?? '',
    ...(sanitized.seo?.secondaryKeywords ?? []),
    ...(sanitized.seo?.searchIntents ?? [])
  ]);
}

export function buildStaySeoSuggestions(input: StaySeoInput) {
  const sanitized = sanitizeSeoContext(input);
  const destination = firstDestinationToken(sanitized);
  const region = normalizeWhitespace(sanitized.seo?.targetRegion || sanitized.region);
  const audience = deriveAudienceLabel(sanitized.ageRange);
  const season = normalizeWhitespace(sanitized.seasonName).toLowerCase();
  const activity = findActivityKeyword(sanitized);
  const seoBase = buildSeoBaseLabel(sanitized);

  const suggestions = dedupeKeywords([
    `${seoBase}${activity ? ` ${activity}` : ''}${destination ? ` à ${destination}` : ''}`,
    `${seoBase}${season ? ` ${season}` : ''}${region ? ` en ${region}` : ''}`,
    `${seoBase}${audience ? ` ${audience}` : ''}${destination ? ` à ${destination}` : ''}`,
    `séjour ${activity || 'thématique'}${audience ? ` ${audience}` : ''}${destination ? ` à ${destination}` : ''}`,
    `colonie de vacances${season ? ` ${season}` : ''}${region ? ` ${region}` : ''}`
  ]);

  return suggestions.slice(0, 8);
}

export function buildStaySeoWarnings(input: StaySeoInput): SeoWarning[] {
  const sanitized = sanitizeSeoContext(input);
  const title = buildStaySeoTitle(sanitized);
  const metaDescription = buildStaySeoMetaDescription(sanitized);
  const primaryKeyword = sanitized.seo?.primaryKeyword ?? '';
  const warnings: SeoWarning[] = [];

  if (!primaryKeyword) {
    warnings.push({
      code: 'missing_primary_keyword',
      message: 'Le mot-clé principal est recommandé pour orienter le référencement de cette fiche.'
    });
  }

  if (title.length < SEO_TITLE_RECOMMENDED_MIN) {
    warnings.push({
      code: 'title_too_short',
      message: `Le title SEO est un peu court (${title.length} caractères). Vise ${SEO_TITLE_RECOMMENDED_MIN}-${SEO_TITLE_RECOMMENDED_MAX}.`
    });
  } else if (title.length > SEO_TITLE_RECOMMENDED_MAX) {
    warnings.push({
      code: 'title_too_long',
      message: `Le title SEO est trop long (${title.length} caractères). Vise ${SEO_TITLE_RECOMMENDED_MIN}-${SEO_TITLE_RECOMMENDED_MAX}.`
    });
  }

  if (metaDescription.length < SEO_META_RECOMMENDED_MIN) {
    warnings.push({
      code: 'meta_too_short',
      message: `La meta description est courte (${metaDescription.length} caractères). Vise ${SEO_META_RECOMMENDED_MIN}-${SEO_META_RECOMMENDED_MAX}.`
    });
  } else if (metaDescription.length > SEO_META_RECOMMENDED_MAX) {
    warnings.push({
      code: 'meta_too_long',
      message: `La meta description est trop longue (${metaDescription.length} caractères). Vise ${SEO_META_RECOMMENDED_MIN}-${SEO_META_RECOMMENDED_MAX}.`
    });
  }

  if (primaryKeyword) {
    const repeatedCount = countPhraseOccurrences(`${title} ${metaDescription}`, primaryKeyword);
    if (repeatedCount > 2) {
      warnings.push({
        code: 'keyword_stuffing',
        message: 'Le mot-clé principal est répété plusieurs fois dans le title/meta. Réduis la répétition.'
      });
    }
    if (!isPrimaryKeywordCoherent(sanitized)) {
      warnings.push({
        code: 'keyword_incoherent',
        message:
          'Le mot-clé principal semble peu cohérent avec le contenu réel du séjour (titre, description, destination, activités).'
      });
    }
  }

  return warnings;
}

export function buildStaySeoGooglePreview(input: StaySeoInput, canonicalPath: string) {
  return {
    title: buildStaySeoTitle(input),
    description: buildStaySeoMetaDescription(input),
    canonicalPath: normalizeWhitespace(canonicalPath)
  };
}

export function buildStayH1Title(input: StaySeoInput) {
  const sanitized = sanitizeSeoContext(input);
  const baseTitle = sanitized.title || 'Séjour';
  const h1Variant = sanitized.seo?.h1Variant ?? '';
  if (h1Variant && isPrimaryKeywordCoherent({ ...sanitized, seo: { ...sanitized.seo, primaryKeyword: h1Variant } })) {
    return truncateAtWord(h1Variant, 96);
  }
  const primaryKeyword = sanitized.seo?.primaryKeyword ?? '';
  if (!primaryKeyword) return baseTitle;
  if (includesPhrase(baseTitle, primaryKeyword)) return baseTitle;
  if (!isPrimaryKeywordCoherent(sanitized)) return baseTitle;

  const destination = firstDestinationToken(sanitized);
  if (!destination || !includesPhrase(primaryKeyword, destination)) {
    return baseTitle;
  }

  return truncateAtWord(`${baseTitle} - ${primaryKeyword}`, 96);
}

export function buildStayIntroText(input: StaySeoInput) {
  const sanitized = sanitizeSeoContext(input);
  if (sanitized.seo?.introText) {
    return sanitized.seo.introText;
  }
  const summary = sanitized.summary || sanitized.description || '';
  const primaryKeyword = sanitized.seo?.primaryKeyword ?? '';
  const destination = firstDestinationToken(sanitized);
  const searchIntent = sanitized.seo?.searchIntents?.[0] ?? '';
  let intro = summary;

  if (!intro) {
    intro = `Découvrez ${primaryKeyword || sanitized.title}.`;
  }

  if (primaryKeyword && !includesPhrase(intro, primaryKeyword) && isPrimaryKeywordCoherent(sanitized)) {
    intro = `${intro} Ce séjour répond à la recherche ${primaryKeyword}.`;
  }

  if (destination && !includesPhrase(intro, destination)) {
    intro = `${intro} Destination: ${destination}.`;
  }

  if (searchIntent && !includesPhrase(intro, searchIntent)) {
    intro = `${intro} Idéal pour ${searchIntent}.`;
  }

  return intro.replace(/\s+/g, ' ').trim();
}

export function buildRelatedStayLinks(current: Stay, stays: Stay[], getHref: (stay: Stay) => string): RelatedStayLink[] {
  const currentRegion = normalizeWhitespace(current.seo?.targetRegion || current.region);
  const currentCategories = new Set(current.categories);

  const scored = stays
    .filter((stay) => stay.id !== current.id)
    .map((stay) => {
      let score = 0;
      const stayRegion = normalizeWhitespace(stay.seo?.targetRegion || stay.region);
      if (stayRegion && currentRegion && stayRegion === currentRegion) {
        score += 4;
      }
      const sharedCategories = stay.categories.filter((category) => currentCategories.has(category)).length;
      score += sharedCategories * 2;
      if (stay.seasonId === current.seasonId) {
        score += 1;
      }
      if (stay.priceFrom != null && current.priceFrom != null) {
        const diff = Math.abs(stay.priceFrom - current.priceFrom);
        if (diff <= 150) score += 1;
      }
      return { stay, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return left.stay.title.localeCompare(right.stay.title, 'fr');
    })
    .slice(0, 4);

  return scored.map(({ stay }) => ({
    stayId: stay.id,
    href: getHref(stay),
    anchorText: contextualAnchorText(current, stay),
    title: stay.title
  }));
}
