import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { createHash } from 'crypto';
import iconv from 'iconv-lite';
import { draftSessionStableKey } from '@/lib/draft-session-keys';
import { STAY_REGION_OPTIONS } from '@/lib/stay-regions';
import {
  extractVideoUrlsFromArbitraryString,
  isVideoUrlCandidate
} from '@/lib/stay-draft-url-extract';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_TEXT_SCAN_LENGTH = 140_000;
const MAX_RAW_TEXT_LENGTH = 35_000;
const MAX_IMAGES = 8;
const MAX_ACTIVITIES = 12;
const MAX_SECTION_TEXT_LENGTH = 8_000;
const MAX_SESSION_SNIPPET_LENGTH = 400;
const MAX_SUMMARY_BLOCK_LENGTH = 2_200;
const MAX_TRANSPORT_VARIANT_FETCHES = 80;
const MAX_IMAGE_CANDIDATES = 48;
const MAX_IMAGE_ANALYSIS = 20;
const IMAGE_ANALYSIS_CONCURRENCY = 4;
const IMAGE_SELECTION_MIN = 4;
const IMAGE_FETCH_TIMEOUT_MS = 8_000;
const IMAGE_FETCH_MAX_BYTES = 6 * 1024 * 1024;
const IMAGE_MIN_WIDTH = 420;
const IMAGE_MIN_HEIGHT = 260;
const IMAGE_MIN_AREA = 420 * 260;
const IMAGE_MIN_BYTES = 18_000;

const NON_FOREIGN_REGIONS = STAY_REGION_OPTIONS.filter((region) => region !== 'Étranger');

const SUMMARY_SECTION_BOUNDARY_KEYS = [
  'esprit du sejour',
  'au programme',
  'hebergement',
  'photos',
  'temoignages'
];

const SUMMARY_MARKER_KEYS = [
  'age',
  'duree',
  'dates',
  'voyage',
  'capacite',
  'encadrement'
];

const SUMMARY_FALLBACK_DESCRIPTION_SELECTORS = [
  'main [class*="descript"]',
  'main [id*="descript"]',
  'article [class*="descript"]',
  'article [id*="descript"]',
  'main [class*="description"]',
  'main [id*="description"]',
  'article [class*="description"]',
  'article [id*="description"]',
  '[data-testid*="description"]'
];

const SUMMARY_EXCLUDED_LINE_KEYS = [
  'assurance',
  'paiement',
  'financement',
  'credit',
  'choisir',
  'selectionner',
  'sélectionner',
  'aller',
  'retour',
  'ville de depart',
  'villes de depart',
  'trajet aller',
  'trajet retour',
  'reprise centre',
  'reprise sur le centre',
  'reprise au centre',
  'tarif',
  'capacites de remboursement',
  'verifiez vos capacites',
  'credit vous engage',
  'cgv',
  'conditions generales',
  'mentions legales',
  'cookies',
  'panier',
  'mon compte',
  'se connecter',
  'connexion',
  'partager',
  'facebook',
  'instagram',
  'linkedin',
  'whatsapp',
  'newsletter',
  'popup',
  'breadcrumb',
  'fil d ariane',
  'menu',
  'navigation',
  'footer',
  'header'
];

type SummaryLabelRule = {
  label: string;
  aliases: string[];
};

const SUMMARY_LABEL_RULES: SummaryLabelRule[] = [
  { label: 'ÂGE', aliases: ['ÂGE', 'AGE'] },
  { label: 'DURÉE', aliases: ['DURÉE', 'DUREE'] },
  { label: 'DATES', aliases: ['DATES'] },
  { label: 'VOYAGE', aliases: ['VOYAGE'] },
  { label: 'CAPACITÉ', aliases: ['CAPACITÉ', 'CAPACITE'] },
  { label: 'ENCADREMENT', aliases: ['ENCADREMENT'] }
];

const MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12
};

type SectionBlock = {
  heading: string;
  text: string;
  headingKey: string;
  index: number;
};

type AddressHint = {
  locality: string | null;
  region: string | null;
  department: string | null;
  postalCode: string | null;
  street: string | null;
};

type ImageCandidateSource = 'og' | 'twitter' | 'img';
type ImageTheme = 'activity' | 'location' | 'accommodation' | 'group' | 'generic';

type ImageCandidate = {
  url: string;
  source: ImageCandidateSource;
  alt: string;
  title: string;
  className: string;
  widthHint: number | null;
  heightHint: number | null;
  index: number;
};

type AnalyzedImageCandidate = ImageCandidate & {
  width: number | null;
  height: number | null;
  byteLength: number | null;
  contentType: string | null;
  contentHash: string | null;
  weakHash: string | null;
  familyKey: string;
  score: number;
  qualityScore: number;
  relevanceScore: number;
  penaltyScore: number;
  thematicTag: ImageTheme;
};

export type ImageSelectionContext = {
  title?: string | null;
  description?: string | null;
  summary?: string | null;
  locationText?: string | null;
  regionText?: string | null;
  activities?: string[];
};

const IMAGE_HARD_IGNORE_TOKENS = [
  'logo',
  'icon',
  'icone',
  'sprite',
  'favicon',
  'emoji',
  'picto'
];

const IMAGE_DECORATIVE_TOKENS = [
  'logo',
  'icon',
  'icone',
  'sprite',
  'favicon',
  'avatar',
  'badge',
  'label',
  'watermark',
  'signature',
  'newsletter',
  'popup',
  'pattern',
  'texture',
  'background',
  'bg',
  'decor',
  'separator',
  'divider',
  'partner'
];

const IMAGE_ADVERTISING_TOKENS = [
  'banner',
  'hero',
  'slider',
  'carousel',
  'header',
  'footer',
  'ads',
  'advert',
  'promo',
  'cover',
  'template',
  'cta',
  'social',
  'share',
  'thumbnail',
  'thumb',
  'small',
  'tiny',
  'placeholder'
];

const IMAGE_ACTIVITY_TOKENS = [
  'activite',
  'activité',
  'sport',
  'surf',
  'ski',
  'escalade',
  'canoe',
  'kayak',
  'equitation',
  'équitation',
  'atelier',
  'danse',
  'theatre',
  'théâtre'
];

const IMAGE_ACCOMMODATION_TOKENS = [
  'hebergement',
  'hébergement',
  'chambre',
  'dortoir',
  'residence',
  'résidence',
  'hotel',
  'hôtel',
  'camping',
  'centre',
  'batiment',
  'bâtiment'
];

const IMAGE_GROUP_TOKENS = [
  'enfant',
  'enfants',
  'ado',
  'ados',
  'jeune',
  'jeunes',
  'groupe',
  'animateur',
  'animatrice',
  'team'
];

const IMAGE_LOCATION_TOKENS = [
  'mer',
  'plage',
  'montagne',
  'campagne',
  'foret',
  'forêt',
  'lac',
  'riviere',
  'rivière',
  'village',
  'nature',
  'paysage'
];

const IMAGE_CONTEXT_STOPWORDS = new Set([
  'le',
  'la',
  'les',
  'de',
  'du',
  'des',
  'un',
  'une',
  'et',
  'ou',
  'en',
  'au',
  'aux',
  'pour',
  'avec',
  'dans',
  'sur',
  'sejour',
  'sejours',
  'colonie',
  'colonies',
  'vacances',
  'enfant',
  'enfants',
  'ado',
  'ados',
  'jeune',
  'jeunes',
  'resacolo'
]);

const IMAGE_HARD_IGNORE_KEYWORDS = new Set(
  IMAGE_HARD_IGNORE_TOKENS.map((token) => simplifyForMatch(token))
);
const IMAGE_DECORATIVE_KEYWORDS = new Set(
  IMAGE_DECORATIVE_TOKENS.map((token) => simplifyForMatch(token))
);
const IMAGE_ADVERTISING_KEYWORDS = new Set(
  IMAGE_ADVERTISING_TOKENS.map((token) => simplifyForMatch(token))
);
const IMAGE_ACTIVITY_KEYWORDS = new Set(
  IMAGE_ACTIVITY_TOKENS.map((token) => simplifyForMatch(token))
);
const IMAGE_ACCOMMODATION_KEYWORDS = new Set(
  IMAGE_ACCOMMODATION_TOKENS.map((token) => simplifyForMatch(token))
);
const IMAGE_GROUP_KEYWORDS = new Set(
  IMAGE_GROUP_TOKENS.map((token) => simplifyForMatch(token))
);
const IMAGE_LOCATION_KEYWORDS = new Set(
  IMAGE_LOCATION_TOKENS.map((token) => simplifyForMatch(token))
);

export type DraftSessionItem = {
  label: string;
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  availability: 'full' | 'available' | 'limited' | 'waitlist' | 'unknown' | null;
};

export type DraftAccommodation = {
  title: string;
  description: string;
};

export type DraftTransportVariant = {
  departure_city: string;
  return_city: string;
  amount_cents: number | null;
  currency: 'EUR';
  source_url: string;
  departure_label_raw?: string | null;
  return_label_raw?: string | null;
  page_price_cents?: number | null;
  base_price_cents?: number | null;
  pricing_method?:
    | 'delta_from_base'
    | 'session_delta'
    | 'absolute_price'
    | 'unresolved'
    | 'thalie_pbpdt_delta'
    | 'thalie_option_url_delta';
  confidence?: 'high' | 'medium' | 'low';
  reason?: string;
};

export type DraftTransportPriceDebug = {
  variant_url: string;
  departure_city: string | null;
  return_city: string | null;
  page_price_cents: number | null;
  base_price_cents: number | null;
  amount_cents: number | null;
  pricing_method:
    | 'delta_from_base'
    | 'session_delta'
    | 'absolute_price'
    | 'unresolved'
    | 'thalie_pbpdt_delta'
    | 'thalie_option_url_delta';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  departure_label_raw?: string | null;
  return_label_raw?: string | null;
};

export type ExtractTransportVariantsResult = {
  transportVariants: DraftTransportVariant[];
  transportPriceDebug: DraftTransportPriceDebug[];
};

export type FetchedHtml = {
  html: string;
  finalUrl: string;
  fetchedAt: string;
  contentType: string | null;
  status: number;
};

export type ExtractedStayData = {
  title: string | null;
  description: string | null;
  summary: string | null;
  city: string | null;
  locationText: string | null;
  regionText: string | null;
  ageMin: number | null;
  ageMax: number | null;
  priceFrom: number | null;
  durationDays: number | null;
  activities: string[];
  activitiesText: string | null;
  programText: string | null;
  supervisionText: string | null;
  requiredDocumentsText: string | null;
  transportText: string | null;
  transportMode: string | null;
  images: string[];
  sessionsJson: DraftSessionItem[] | null;
  accommodationsJson: DraftAccommodation | null;
  rawText: string | null;
  technical: {
    h1: string | null;
    titleTag: string | null;
    metaDescription: string | null;
    sectionHeadings: string[];
  };
};

function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function simplifyForMatch(value: string | null | undefined): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';
  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseCharsetFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const match = contentType.match(/charset\s*=\s*["']?([a-z0-9_\-]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function parseCharsetFromMeta(buffer: Buffer): string | null {
  const preview = buffer.subarray(0, 8_192).toString('latin1');
  const metaCharset = preview.match(
    /<meta[^>]+charset=["']?\s*([a-z0-9_\-]+)\s*["']?/i
  )?.[1];
  if (metaCharset) return metaCharset.toLowerCase();

  const metaHttpEquiv = preview.match(
    /<meta[^>]+http-equiv=["']content-type["'][^>]+content=["'][^"']*charset=([a-z0-9_\-]+)[^"']*["']/i
  )?.[1];
  return metaHttpEquiv?.toLowerCase() ?? null;
}

function getDecodeScore(value: string): number {
  const replacementCount = (value.match(/\uFFFD/g) ?? []).length;
  const controlCount = (value.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;
  return replacementCount * 5 + controlCount;
}

function decodeHtmlBuffer(
  buffer: Buffer,
  headerCharset: string | null,
  metaCharset: string | null
): string {
  const candidateCharsets = unique(
    [headerCharset, metaCharset, 'utf-8', 'windows-1252', 'iso-8859-1'].filter(
      (candidate): candidate is string => Boolean(candidate && iconv.encodingExists(candidate))
    )
  );

  let bestDecoded = '';
  let bestScore = Number.POSITIVE_INFINITY;

  for (const charset of candidateCharsets) {
    try {
      const decoded = iconv.decode(buffer, charset);
      const score = getDecodeScore(decoded);
      if (score < bestScore) {
        bestDecoded = decoded;
        bestScore = score;
      }
    } catch {
      // Ignore and try next charset.
    }
  }

  if (bestDecoded) return bestDecoded;
  return buffer.toString('utf-8');
}

function toAbsoluteUrl(candidate: string, sourceUrl: string): string | null {
  if (!candidate) return null;
  const clean = candidate.trim();
  if (!clean || clean.startsWith('data:')) return null;
  try {
    return new URL(clean, sourceUrl).toString();
  } catch {
    return null;
  }
}

function extractPrimaryTitle($: CheerioAPI): {
  title: string | null;
  h1: string | null;
  titleTag: string | null;
} {
  const h1 = normalizeWhitespace($('h1').first().text());
  const titleTag = normalizeWhitespace($('title').first().text());
  return {
    title: h1 || titleTag || null,
    h1: h1 || null,
    titleTag: titleTag || null
  };
}

function extractDescription($: CheerioAPI): {
  description: string | null;
  metaDescription: string | null;
} {
  const metaDescription = normalizeWhitespace(
    $('meta[name="description"]').attr('content') ?? ''
  );
  if (metaDescription) {
    return { description: metaDescription, metaDescription };
  }

  const paragraphSelectors = ['main p', 'article p', '[role="main"] p', '.content p', 'p'];
  for (const selector of paragraphSelectors) {
    const candidate = normalizeWhitespace(
      $(selector)
        .map((_, element) => $(element).text())
        .get()
        .find((text) => normalizeWhitespace(text).length >= 80) ?? ''
    );
    if (candidate) {
      return { description: candidate, metaDescription: null };
    }
  }

  return { description: null, metaDescription: null };
}

function extractVisibleText($: CheerioAPI): string {
  const clone = load($.html());
  clone('script,style,noscript,svg,template').remove();
  const text = normalizeWhitespace(clone('body').text());
  return truncate(text, MAX_TEXT_SCAN_LENGTH);
}

function parseAgeRange(text: string): { ageMin: number; ageMax: number } | null {
  const patterns = [
    /\b(?:de\s*)?(\d{1,2})\s*(?:-|–|—|à|a|\/)\s*(\d{1,2})\s*ans\b/gi,
    /\b(\d{1,2})\s*ans?\s*(?:-|–|—|à|a|\/)\s*(\d{1,2})\b/gi
  ];
  const candidates: { ageMin: number; ageMax: number; index: number }[] = [];
  const extractRanges = (input: string) => {
    const matches: { ageMin: number; ageMax: number; index: number }[] = [];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null = null;
      while ((match = pattern.exec(input)) !== null) {
        const left = Number(match[1]);
        const right = Number(match[2]);
        if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
        const ageMin = Math.min(left, right);
        const ageMax = Math.max(left, right);
        if (ageMin < 3 || ageMax > 25) continue;
        matches.push({ ageMin, ageMax, index: match.index });
      }
    }
    return matches;
  };

  const ageSectionMatch = text.match(
    /\b(?:ages?|âge|tranche d['’]âge)\b[\s:.-]*([^\n\r.;]{0,120})/i
  );
  if (ageSectionMatch?.[1]) {
    const sectionCandidates = extractRanges(ageSectionMatch[1]);
    if (sectionCandidates.length >= 2) {
      return {
        ageMin: Math.min(...sectionCandidates.map((candidate) => candidate.ageMin)),
        ageMax: Math.max(...sectionCandidates.map((candidate) => candidate.ageMax))
      };
    }
    if (sectionCandidates.length === 1) {
      return {
        ageMin: sectionCandidates[0].ageMin,
        ageMax: sectionCandidates[0].ageMax
      };
    }
  }

  candidates.push(...extractRanges(text));

  if (candidates.length === 0) return null;

  const sortByBestRange = (
    left: { ageMin: number; ageMax: number; index: number },
    right: { ageMin: number; ageMax: number; index: number }
  ) => {
    const leftSpan = left.ageMax - left.ageMin;
    const rightSpan = right.ageMax - right.ageMin;
    if (rightSpan !== leftSpan) return rightSpan - leftSpan;
    if (left.ageMin !== right.ageMin) return left.ageMin - right.ageMin;
    return left.index - right.index;
  };

  const preferred = candidates
    .filter((candidate) => candidate.ageMax <= 18)
    .sort(sortByBestRange)[0];
  if (preferred) return { ageMin: preferred.ageMin, ageMax: preferred.ageMax };

  const fallback = candidates.sort(sortByBestRange)[0];
  return { ageMin: fallback.ageMin, ageMax: fallback.ageMax };
}

function parseFrenchAmount(raw: string, minEur: number = 30, maxEur: number = 20_000): number | null {
  const cleaned = raw.replace(/\u00a0/g, ' ').replace(/[^\d,.\s]/g, '').trim();
  if (!cleaned) return null;

  let normalized = cleaned.replace(/\s+/g, '');

  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    normalized = /,\d{1,2}$/.test(normalized)
      ? normalized.replace(',', '.')
      : normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(/\.(?=\d{3}(?:\.|$))/g, '');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount);
  if (rounded < minEur || rounded > maxEur) return null;
  return rounded;
}

function findPriceInTextWithMin(text: string, minEur: number): number | null {
  const fromMatch = text.match(/\b(?:à\s+partir\s+de|dès)\s*([0-9][0-9\s.,]*)\s*(?:€|euros?)/i);
  if (fromMatch?.[1]) {
    const amount = parseFrenchAmount(fromMatch[1], minEur, 20_000);
    if (amount !== null) return amount;
  }

  const genericPattern = /\b([0-9][0-9\s.,]{1,})\s*(?:€|euros?)/gi;
  let match: RegExpExecArray | null = null;
  while ((match = genericPattern.exec(text)) !== null) {
    const amount = parseFrenchAmount(match[1], minEur, 20_000);
    if (amount !== null) return amount;
  }

  return null;
}

function findPriceInText(text: string): number | null {
  return findPriceInTextWithMin(text, 30);
}

function findPublicPriceInText(text: string): number | null {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return null;

  const publicPatterns = [
    /\btarif\s+public\b[^0-9]{0,40}([0-9][0-9\s.,]*)\s*(?:€|euros?)/i,
    /\bpublic\b[^0-9]{0,40}([0-9][0-9\s.,]*)\s*(?:€|euros?)/i
  ];

  for (const pattern of publicPatterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const amount = parseFrenchAmount(match[1], 30, 20_000);
    if (amount !== null) return amount;
  }

  const strippedPartnerText = normalized
    .replace(/\btarif\s+partenaire\b[^0-9]{0,40}[0-9][0-9\s.,]*\s*(?:€|euros?)/gi, ' ')
    .replace(/\bpartenaire\b[^0-9]{0,40}[0-9][0-9\s.,]*\s*(?:€|euros?)/gi, ' ');

  return findPriceInText(strippedPartnerText);
}

/** Tous les champs `price` numériques trouvés dans le graphe JSON-LD (Offer, etc.). */
function collectJsonLdOfferPrices(blocks: unknown[]): number[] {
  const candidates: number[] = [];
  const stack = [...blocks];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) continue;
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    const record = asRecord(node);
    if (!record) continue;

    const priceRaw = record.price;
    if (typeof priceRaw === 'number') {
      const rounded = Math.round(priceRaw);
      if (rounded >= 30 && rounded <= 20_000) candidates.push(rounded);
    } else if (typeof priceRaw === 'string') {
      const parsed = parseFrenchAmount(priceRaw, 30, 20_000);
      if (parsed !== null) candidates.push(parsed);
    }

    for (const value of Object.values(record)) {
      stack.push(value);
    }
  }

  return candidates;
}

/**
 * Plusieurs offres peuvent coexister (sessions / formules). Le premier prix parcouru n’est pas fiable
 * (ex. Thalie : 1265 € puis 1065 €). On prend le **minimum** parmi les montants « plausibles » séjour.
 */
function findPriceInJsonLd(blocks: unknown[]): number | null {
  const all = collectJsonLdOfferPrices(blocks);
  if (all.length === 0) return null;
  const plausible = all.filter((p) => p >= 200 && p <= 25_000);
  const pool = plausible.length > 0 ? plausible : all;
  return Math.min(...pool);
}

/** Pour le débrief import : liste triée des prix vus dans le JSON-LD (sans appliquer le min). */
export function extractJsonLdOfferPricesFromHtml(html: string): number[] {
  const $ = load(html);
  const prices = collectJsonLdOfferPrices(extractJsonLdBlocks($));
  return Array.from(new Set(prices)).sort((a, b) => a - b);
}

function parsePrice(text: string, jsonLdBlocks: unknown[]): number | null {
  /** Sur les fiches type catalogue (ex. Thalie), le gros prix à l’écran peut déjà inclure le transport ; le JSON-Ld Product/Offer porte souvent le prix séjour seul (ex. 1065 € vs 1147 € affichés). */
  const jsonLdPrice = findPriceInJsonLd(jsonLdBlocks);
  if (jsonLdPrice !== null) return jsonLdPrice;
  return findPriceInText(text);
}

function parseDuration(text: string): number | null {
  const dayMatches = Array.from(text.matchAll(/\b(\d{1,2})\s*jours?\b/gi))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 2 && value <= 60);
  if (dayMatches.length > 0) {
    return dayMatches[0];
  }

  const weekMatches = Array.from(text.matchAll(/\b(\d{1,2})\s*semaines?\b/gi))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 8);
  if (weekMatches.length > 0) {
    return weekMatches[0] * 7;
  }

  return null;
}

function shouldIgnoreImage(source: string, alt: string): boolean {
  const normalizedSourceRaw = source.toLowerCase();
  if (!normalizedSourceRaw) return true;
  if (normalizedSourceRaw.startsWith('data:')) return true;
  if (normalizedSourceRaw.includes('.svg')) return true;

  const normalized = simplifyForMatch(`${source} ${alt}`);
  if (!normalized) return true;

  for (const token of Array.from(IMAGE_HARD_IGNORE_KEYWORDS)) {
    if (normalized.includes(token)) return true;
  }

  return false;
}

function parseNumericAttribute(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function pickSrcsetBestCandidate(srcset: string): string {
  const chunks = srcset
    .split(',')
    .map((chunk) => normalizeWhitespace(chunk))
    .filter(Boolean);
  if (chunks.length === 0) return '';

  const ranked = chunks
    .map((chunk) => {
      const [url, descriptor = ''] = chunk.split(/\s+/, 2);
      const widthDescriptor = descriptor.match(/^(\d{2,5})w$/i);
      const densityDescriptor = descriptor.match(/^(\d+(?:\.\d+)?)x$/i);
      const rank = widthDescriptor
        ? Number(widthDescriptor[1])
        : densityDescriptor
          ? Math.round(Number(densityDescriptor[1]) * 1_000)
          : 0;

      return { url: normalizeWhitespace(url), rank };
    })
    .filter((item) => Boolean(item.url))
    .sort((left, right) => right.rank - left.rank);

  return ranked[0]?.url ?? '';
}

function pickImageCandidates($: CheerioAPI, element: AnyNode): string[] {
  const image = $(element);
  const candidates = [
    image.attr('src'),
    image.attr('data-src'),
    image.attr('data-lazy-src'),
    image.attr('data-original'),
    image.attr('data-image')
  ].filter((candidate): candidate is string => Boolean(candidate && normalizeWhitespace(candidate)));

  const srcsetCandidates = [
    pickSrcsetBestCandidate(image.attr('srcset') ?? ''),
    pickSrcsetBestCandidate(image.attr('data-srcset') ?? ''),
    pickSrcsetBestCandidate(image.attr('data-lazy-srcset') ?? '')
  ].filter(Boolean);

  return unique([...candidates, ...srcsetCandidates]);
}

function normalizeImageUrlForDedup(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';
    const ignoredSearchParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    for (const key of ignoredSearchParams) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function buildImageFamilyKey(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const normalizedPath = parsed.pathname
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/(?:-|_)?\d{2,5}x\d{2,5}(?=$|[-_])/g, '')
      .replace(
        /(?:-|_)?(?:small|medium|large|thumb|thumbnail|preview|mobile|desktop|retina|mini)(?=$|[-_])/g,
        ''
      )
      .replace(/[-_]+/g, '-');
    return `${parsed.hostname.toLowerCase()}${normalizedPath}`;
  } catch {
    return simplifyForMatch(rawUrl).replace(/\s+/g, '-');
  }
}

function buildImageFilenameKey(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const filename = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
    const clean = filename
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/(?:-|_)?\d{2,5}x\d{2,5}(?=$|[-_])/g, '')
      .replace(/\d{2,}$/g, '')
      .replace(/[-_]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return clean;
  } catch {
    return '';
  }
}

function extractContextTokens(value: string | null | undefined): Set<string> {
  const normalized = simplifyForMatch(value);
  if (!normalized) return new Set();

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !IMAGE_CONTEXT_STOPWORDS.has(token));
  return new Set(tokens);
}

function hasAnyKeyword(tokens: Set<string>, keywords: Set<string>): boolean {
  for (const token of Array.from(tokens)) {
    if (keywords.has(token)) return true;
  }
  return false;
}

function inferImageTheme(tokens: Set<string>): ImageTheme {
  if (hasAnyKeyword(tokens, IMAGE_ACTIVITY_KEYWORDS)) return 'activity';
  if (hasAnyKeyword(tokens, IMAGE_ACCOMMODATION_KEYWORDS)) return 'accommodation';
  if (hasAnyKeyword(tokens, IMAGE_GROUP_KEYWORDS)) return 'group';
  if (hasAnyKeyword(tokens, IMAGE_LOCATION_KEYWORDS)) return 'location';
  return 'generic';
}

function collectImageCandidates($: CheerioAPI, sourceUrl: string): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();
  let index = 0;

  const addCandidate = (rawUrl: string | null | undefined, source: ImageCandidateSource, metadata?: {
    alt?: string;
    title?: string;
    className?: string;
    widthHint?: number | null;
    heightHint?: number | null;
  }) => {
    if (!rawUrl || candidates.length >= MAX_IMAGE_CANDIDATES) return;
    const absoluteUrl = toAbsoluteUrl(rawUrl, sourceUrl);
    if (!absoluteUrl) return;

    const normalizedUrl = normalizeImageUrlForDedup(absoluteUrl);
    const alt = normalizeWhitespace(metadata?.alt ?? '');
    if (shouldIgnoreImage(normalizedUrl, alt)) return;
    if (seen.has(normalizedUrl)) return;

    seen.add(normalizedUrl);
    candidates.push({
      url: normalizedUrl,
      source,
      alt,
      title: normalizeWhitespace(metadata?.title ?? ''),
      className: normalizeWhitespace(metadata?.className ?? ''),
      widthHint: metadata?.widthHint ?? null,
      heightHint: metadata?.heightHint ?? null,
      index
    });
    index += 1;
  };

  addCandidate($('meta[property="og:image"]').attr('content'), 'og');
  addCandidate($('meta[name="twitter:image"]').attr('content'), 'twitter');

  $('main img, article img, .content img, img').each((_, element) => {
    if (candidates.length >= MAX_IMAGE_CANDIDATES) return false;

    const image = $(element);
    const alt = normalizeWhitespace(image.attr('alt') ?? '');
    const title = normalizeWhitespace(image.attr('title') ?? '');
    const className = normalizeWhitespace(image.attr('class') ?? '');
    const widthHint = parseNumericAttribute(image.attr('width'));
    const heightHint = parseNumericAttribute(image.attr('height'));

    for (const candidate of pickImageCandidates($, element)) {
      addCandidate(candidate, 'img', {
        alt,
        title,
        className,
        widthHint,
        heightHint
      });
      if (candidates.length >= MAX_IMAGE_CANDIDATES) break;
    }
    return;
  });

  return candidates;
}

function extractImages($: CheerioAPI, sourceUrl: string): string[] {
  return collectImageCandidates($, sourceUrl)
    .map((candidate) => candidate.url)
    .slice(0, MAX_IMAGES);
}

export function extractVideoUrls(html: string, sourceUrl: string): string[] {
  const $ = load(html);
  const values = new Set<string>();

  const addCandidate = (raw: string | null | undefined) => {
    const normalized = normalizeWhitespace(raw);
    if (!normalized) return;
    if (/^javascript:/i.test(normalized)) {
      for (const embedded of extractVideoUrlsFromArbitraryString(normalized)) {
        values.add(embedded);
      }
      return;
    }
    const absolute = toAbsoluteUrl(normalized, sourceUrl);
    if (!absolute || !isVideoUrlCandidate(absolute)) return;
    values.add(absolute);
  };

  $('a[href], iframe[src], video[src], source[src], [data-video], [data-video-url], [data-youtube], [data-vimeo]').each(
    (_, element) => {
      addCandidate($(element).attr('href'));
      addCandidate($(element).attr('src'));
      addCandidate($(element).attr('data-video'));
      addCandidate($(element).attr('data-video-url'));
      addCandidate($(element).attr('data-youtube'));
      addCandidate($(element).attr('data-vimeo'));
      addCandidate($(element).attr('data-src'));
      addCandidate($(element).attr('data-url'));
    }
  );

  return Array.from(values);
}

function buildImageSelectionContextTokens(context: ImageSelectionContext): Set<string> {
  const tokens = new Set<string>();
  const values = [
    context.title,
    context.description,
    context.summary,
    context.locationText,
    context.regionText,
    ...(context.activities ?? [])
  ];

  for (const value of values) {
    for (const token of Array.from(extractContextTokens(value))) {
      tokens.add(token);
    }
  }

  return tokens;
}

function extractImageCandidateTokens(candidate: ImageCandidate): Set<string> {
  return extractContextTokens([candidate.alt, candidate.title, candidate.className, candidate.url].join(' '));
}

function countSharedTokens(left: Set<string>, right: Set<string>): number {
  let total = 0;
  for (const token of Array.from(left)) {
    if (right.has(token)) total += 1;
  }
  return total;
}

function computeImagePenalty(
  candidate: ImageCandidate,
  candidateTokens: Set<string>,
  width: number | null,
  height: number | null,
  byteLength: number | null
): number {
  let penalty = 0;

  if (hasAnyKeyword(candidateTokens, IMAGE_DECORATIVE_KEYWORDS)) penalty += 24;
  if (hasAnyKeyword(candidateTokens, IMAGE_ADVERTISING_KEYWORDS)) penalty += 16;

  const ratio = width && height ? width / height : null;
  if (ratio && (ratio < 0.45 || ratio > 2.7)) {
    penalty += 16;
  } else if (ratio && (ratio < 0.6 || ratio > 2.2)) {
    penalty += 8;
  }

  if (width && width < IMAGE_MIN_WIDTH) penalty += 14;
  if (height && height < IMAGE_MIN_HEIGHT) penalty += 14;
  if (width && height && width * height < IMAGE_MIN_AREA) penalty += 16;
  if (byteLength && byteLength < IMAGE_MIN_BYTES) penalty += 14;
  if (candidate.className.toLowerCase().includes('lazy')) penalty += 2;

  return penalty;
}

function computeImageQualityScore(
  candidate: ImageCandidate,
  width: number | null,
  height: number | null,
  byteLength: number | null
): number {
  let score = 0;

  if (candidate.source === 'og') score += 12;
  if (candidate.source === 'twitter') score += 8;

  if (width && height) {
    const area = width * height;
    if (area >= 1_400_000) score += 18;
    else if (area >= 900_000) score += 14;
    else if (area >= 500_000) score += 10;
    else if (area >= IMAGE_MIN_AREA) score += 6;
    else score -= 8;

    const ratio = width / height;
    if (ratio >= 0.8 && ratio <= 1.9) score += 8;
    else if (ratio >= 0.65 && ratio <= 2.2) score += 4;
    else score -= 4;
  } else if (candidate.widthHint && candidate.heightHint) {
    if (candidate.widthHint >= IMAGE_MIN_WIDTH && candidate.heightHint >= IMAGE_MIN_HEIGHT) {
      score += 4;
    } else {
      score -= 6;
    }
  }

  if (byteLength) {
    if (byteLength >= 240_000) score += 8;
    else if (byteLength >= 120_000) score += 6;
    else if (byteLength >= 60_000) score += 3;
    else score -= 6;
  }

  return score;
}

function computeImageRelevanceScore(
  candidateTokens: Set<string>,
  contextTokens: Set<string>
): number {
  if (contextTokens.size === 0 || candidateTokens.size === 0) return 0;
  const overlap = countSharedTokens(candidateTokens, contextTokens);
  if (overlap === 0) return 0;
  return Math.min(16, overlap * 3);
}

function buildWeakImageHash(buffer: Buffer): string {
  if (buffer.length === 0) return '';
  const sampleSize = Math.min(128, buffer.length);
  const sample = Buffer.allocUnsafe(sampleSize);

  if (sampleSize === 1) {
    sample[0] = buffer[0];
  } else {
    const step = (buffer.length - 1) / (sampleSize - 1);
    for (let index = 0; index < sampleSize; index += 1) {
      const sourceIndex = Math.round(index * step);
      sample[index] = buffer[sourceIndex] ?? 0;
    }
  }

  return createHash('sha1').update(sample).digest('hex');
}

function parsePngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSignature.length; i += 1) {
    if (buffer[i] !== pngSignature[i]) return null;
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!width || !height) return null;
  return { width, height };
}

function parseGifDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  const signature = buffer.toString('ascii', 0, 6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  if (!width || !height) return null;
  return { width, height };
}

function parseWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buffer.toString('ascii', 8, 12) !== 'WEBP') return null;

  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType === 'VP8X' && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (chunkType === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (chunkType === 'VP8 ' && buffer.length >= 30) {
    const hasStartCode = buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a;
    if (!hasStartCode) return null;
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  return null;
}

function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4) return null;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd8 || marker === 0x01) continue;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;

    const markerSize = buffer.readUInt16BE(offset);
    if (markerSize < 2 || offset + markerSize > buffer.length) break;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width > 0 && height > 0) return { width, height };
      break;
    }

    offset += markerSize;
  }

  return null;
}

function parseImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  return (
    parsePngDimensions(buffer) ??
    parseJpegDimensions(buffer) ??
    parseWebpDimensions(buffer) ??
    parseGifDimensions(buffer)
  );
}

async function readResponseBufferWithLimit(
  response: Response,
  maxBytes: number
): Promise<Buffer | null> {
  if (!response.body) {
    const rawBuffer = Buffer.from(await response.arrayBuffer());
    if (rawBuffer.length > maxBytes) return null;
    return rawBuffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

async function fetchImagePayload(
  imageUrl: string
): Promise<{ buffer: Buffer; contentType: string | null; byteLength: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; ResacoloImageBot/1.0; +https://resacolo.com)',
        accept: 'image/*,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentTypeHeader = normalizeWhitespace(response.headers.get('content-type') ?? '');
    const contentType = contentTypeHeader ? contentTypeHeader.split(';')[0].toLowerCase() : null;
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error('not-image');
    }

    const contentLengthRaw = response.headers.get('content-length');
    const contentLength = contentLengthRaw ? Number(contentLengthRaw) : null;
    if (contentLength && Number.isFinite(contentLength) && contentLength > IMAGE_FETCH_MAX_BYTES) {
      throw new Error('too-large');
    }

    const buffer = await readResponseBufferWithLimit(response, IMAGE_FETCH_MAX_BYTES);
    if (!buffer || buffer.length === 0) {
      throw new Error('empty-buffer');
    }

    const byteLength = Number.isFinite(contentLength) && contentLength ? contentLength : buffer.length;
    return { buffer, contentType, byteLength };
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeImageCandidate(
  candidate: ImageCandidate,
  contextTokens: Set<string>
): Promise<AnalyzedImageCandidate | null> {
  try {
    const payload = await fetchImagePayload(candidate.url);
    const dimensions = parseImageDimensions(payload.buffer);
    const width = dimensions?.width ?? candidate.widthHint ?? null;
    const height = dimensions?.height ?? candidate.heightHint ?? null;
    const contentHash = createHash('sha1').update(payload.buffer).digest('hex');
    const weakHash = buildWeakImageHash(payload.buffer);
    const candidateTokens = extractImageCandidateTokens(candidate);
    const qualityScore = computeImageQualityScore(candidate, width, height, payload.byteLength);
    const relevanceScore = computeImageRelevanceScore(candidateTokens, contextTokens);
    const penaltyScore = computeImagePenalty(candidate, candidateTokens, width, height, payload.byteLength);
    const score = qualityScore + relevanceScore - penaltyScore;

    return {
      ...candidate,
      width,
      height,
      byteLength: payload.byteLength,
      contentType: payload.contentType,
      contentHash,
      weakHash,
      familyKey: buildImageFamilyKey(candidate.url),
      score,
      qualityScore,
      relevanceScore,
      penaltyScore,
      thematicTag: inferImageTheme(candidateTokens)
    };
  } catch {
    return null;
  }
}

async function analyzeImageCandidates(
  candidates: ImageCandidate[],
  contextTokens: Set<string>
): Promise<AnalyzedImageCandidate[]> {
  const candidatesToAnalyze = candidates.slice(0, MAX_IMAGE_ANALYSIS);
  if (candidatesToAnalyze.length === 0) return [];

  const analyzed: AnalyzedImageCandidate[] = [];
  let cursor = 0;
  const concurrency = Math.min(IMAGE_ANALYSIS_CONCURRENCY, candidatesToAnalyze.length);

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= candidatesToAnalyze.length) break;

      const candidate = candidatesToAnalyze[currentIndex];
      const result = await analyzeImageCandidate(candidate, contextTokens);
      if (result) analyzed.push(result);
    }
  });

  await Promise.all(workers);
  return analyzed;
}

function isNearDuplicate(left: AnalyzedImageCandidate, right: AnalyzedImageCandidate): boolean {
  if (left.contentHash && right.contentHash && left.contentHash === right.contentHash) {
    return true;
  }

  if (left.weakHash && right.weakHash && left.weakHash === right.weakHash) {
    return true;
  }

  const leftWidth = left.width ?? left.widthHint ?? 0;
  const rightWidth = right.width ?? right.widthHint ?? 0;
  const leftHeight = left.height ?? left.heightHint ?? 0;
  const rightHeight = right.height ?? right.heightHint ?? 0;
  const leftRatio = leftWidth > 0 && leftHeight > 0 ? leftWidth / leftHeight : null;
  const rightRatio = rightWidth > 0 && rightHeight > 0 ? rightWidth / rightHeight : null;
  const ratioDiff =
    leftRatio && rightRatio ? Math.abs(leftRatio - rightRatio) : Number.POSITIVE_INFINITY;
  const widthDiff = leftWidth && rightWidth ? Math.abs(leftWidth - rightWidth) / Math.max(leftWidth, rightWidth) : 1;
  const heightDiff = leftHeight && rightHeight ? Math.abs(leftHeight - rightHeight) / Math.max(leftHeight, rightHeight) : 1;

  if (left.familyKey === right.familyKey && ratioDiff <= 0.06 && widthDiff <= 0.2 && heightDiff <= 0.2) {
    return true;
  }

  const leftFilename = buildImageFilenameKey(left.url);
  const rightFilename = buildImageFilenameKey(right.url);
  if (leftFilename && rightFilename && leftFilename === rightFilename && ratioDiff <= 0.08) {
    return true;
  }

  return false;
}

function selectBestImageUrls(
  analyzed: AnalyzedImageCandidate[],
  fallbackImages: string[]
): string[] {
  if (analyzed.length === 0) {
    return unique(fallbackImages).slice(0, MAX_IMAGES);
  }

  const sorted = [...analyzed].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const leftArea = (left.width ?? left.widthHint ?? 0) * (left.height ?? left.heightHint ?? 0);
    const rightArea = (right.width ?? right.widthHint ?? 0) * (right.height ?? right.heightHint ?? 0);
    if (rightArea !== leftArea) return rightArea - leftArea;
    return left.index - right.index;
  });

  const selected: AnalyzedImageCandidate[] = [];
  const selectedUrls = new Set<string>();
  const familyUsage = new Map<string, number>();
  const themeUsage = new Map<ImageTheme, number>();

  for (const candidate of sorted) {
    if (selected.length >= MAX_IMAGES) break;
    if (candidate.score < -14) continue;
    if (selectedUrls.has(candidate.url)) continue;
    if (selected.some((item) => isNearDuplicate(candidate, item))) continue;

    const familyCount = familyUsage.get(candidate.familyKey) ?? 0;
    if (familyCount >= 1 && selected.length >= IMAGE_SELECTION_MIN) continue;

    const themeCount = themeUsage.get(candidate.thematicTag) ?? 0;
    if (candidate.thematicTag === 'generic' && themeCount >= 3 && selected.length >= IMAGE_SELECTION_MIN) {
      continue;
    }

    selected.push(candidate);
    selectedUrls.add(candidate.url);
    familyUsage.set(candidate.familyKey, familyCount + 1);
    themeUsage.set(candidate.thematicTag, themeCount + 1);
  }

  if (selected.length < IMAGE_SELECTION_MIN) {
    for (const candidate of sorted) {
      if (selected.length >= MAX_IMAGES) break;
      if (selectedUrls.has(candidate.url)) continue;
      selected.push(candidate);
      selectedUrls.add(candidate.url);
    }
  }

  const selectedUrlsOrdered = selected.map((item) => item.url);
  const fallbackUnique = unique(fallbackImages);
  for (const url of fallbackUnique) {
    if (selectedUrlsOrdered.length >= MAX_IMAGES) break;
    if (selectedUrls.has(url)) continue;
    selectedUrlsOrdered.push(url);
    selectedUrls.add(url);
  }

  return selectedUrlsOrdered.slice(0, MAX_IMAGES);
}

export async function selectBestStayImages(
  html: string,
  sourceUrl: string,
  fallbackImages: string[],
  context: ImageSelectionContext
): Promise<string[]> {
  const fallback = unique(fallbackImages).slice(0, MAX_IMAGES);

  try {
    const $ = load(html);
    const candidates = collectImageCandidates($, sourceUrl);
    if (candidates.length === 0) return fallback;

    const contextTokens = buildImageSelectionContextTokens(context);
    const analyzed = await analyzeImageCandidates(candidates, contextTokens);
    const selected = selectBestImageUrls(analyzed, fallback);
    return selected.length > 0 ? selected : fallback;
  } catch (error) {
    console.warn('[import-images] sélection intelligente indisponible, fallback utilisé', {
      sourceUrl,
      error: error instanceof Error ? error.message : 'unknown'
    });
    return fallback;
  }
}

function cleanTextCandidate(value: string, maxLength = 80): string | null {
  const clean = normalizeWhitespace(value).replace(/[.,;:!?]+$/, '');
  if (!clean) return null;
  if (clean.length < 2 || clean.length > maxLength) return null;
  return clean;
}

function extractJsonLdBlocks($: CheerioAPI): unknown[] {
  const blocks: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        blocks.push(...parsed);
      } else {
        blocks.push(parsed);
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  });
  return blocks;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function collectAddressHints(node: unknown, hints: AddressHint[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectAddressHints(item, hints);
    }
    return;
  }

  const record = asRecord(node);
  if (!record) return;

  const addressRecord = asRecord(record.address);
  if (addressRecord) {
    const locality =
      typeof addressRecord.addressLocality === 'string'
        ? cleanTextCandidate(addressRecord.addressLocality, 120)
        : null;
    const region =
      typeof addressRecord.addressRegion === 'string'
        ? cleanTextCandidate(addressRecord.addressRegion, 120)
        : null;
    const department =
      typeof addressRecord.addressCounty === 'string'
        ? cleanTextCandidate(addressRecord.addressCounty, 120)
        : null;
    const postalCode =
      typeof addressRecord.postalCode === 'string'
        ? normalizeWhitespace(addressRecord.postalCode).slice(0, 12)
        : null;
    const street =
      typeof addressRecord.streetAddress === 'string'
        ? cleanTextCandidate(addressRecord.streetAddress, 160)
        : null;

    if (locality || region || department || postalCode || street) {
      hints.push({
        locality,
        region,
        department,
        postalCode,
        street
      });
    }
  }

  const location = asRecord(record.location);
  if (location) {
    collectAddressHints(location, hints);
  }

  for (const value of Object.values(record)) {
    collectAddressHints(value, hints);
  }
}

function extractAddressHints(jsonLdBlocks: unknown[]): AddressHint[] {
  const hints: AddressHint[] = [];
  collectAddressHints(jsonLdBlocks, hints);
  return hints;
}

function extractCityFromTitleOrDescription(
  title: string | null,
  description: string | null
): string | null {
  const titleAndDescription = normalizeWhitespace([title, description].filter(Boolean).join(' '));
  if (!titleAndDescription) return null;

  const specificPattern =
    /\b(?:séjour|colonie|stage|camp)\s+(?:à|au|en)\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,40})\b/;
  const specificMatch = titleAndDescription.match(specificPattern)?.[1];
  if (specificMatch) {
    return cleanTextCandidate(specificMatch, 70);
  }

  const genericPattern = /\b(?:à|au|en)\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,40})\b/;
  const genericMatch = titleAndDescription.match(genericPattern)?.[1];
  return genericMatch ? cleanTextCandidate(genericMatch, 70) : null;
}

function extractSections($: CheerioAPI): SectionBlock[] {
  const sections: SectionBlock[] = [];
  $('h1, h2, h3, h4').each((index, heading) => {
    const headingText = normalizeWhitespace($(heading).text());
    if (!headingText) return;

    let content = normalizeWhitespace(
      $(heading)
        .nextUntil('h1, h2, h3, h4')
        .text()
    );

    if (!content) {
      const parentText = normalizeWhitespace($(heading).parent().text());
      if (parentText && parentText !== headingText) {
        content = normalizeWhitespace(parentText.replace(headingText, ''));
      }
    }

    if (!content || content.length < 12) return;

    sections.push({
      heading: headingText,
      text: truncate(content, MAX_SECTION_TEXT_LENGTH),
      headingKey: simplifyForMatch(headingText),
      index
    });
  });

  return sections;
}

function findSection(
  sections: SectionBlock[],
  headingKeywords: string[]
): SectionBlock | null {
  for (const section of sections) {
    if (headingKeywords.some((keyword) => section.headingKey.includes(keyword))) {
      return section;
    }
  }
  return null;
}

function normalizeParagraph(text: string | null): string | null {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return null;
  return truncate(normalized, MAX_SECTION_TEXT_LENGTH);
}

function htmlToLines(html: string): string[] {
  if (!html) return [];
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|ul|ol|table)>/gi, '\n');

  const $temp = load(`<div>${withBreaks}</div>`);
  const text = $temp('div').text();
  return text
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function isNoiseLine(line: string): boolean {
  const key = simplifyForMatch(line);
  if (!key) return true;
  return SUMMARY_EXCLUDED_LINE_KEYS.some((noise) => key.includes(noise));
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const line of lines) {
    const normalized = normalizeWhitespace(line);
    if (!normalized) continue;
    const key = simplifyForMatch(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function isSummarySectionBoundaryLine(line: string): boolean {
  const key = simplifyForMatch(line);
  if (!key) return false;
  return SUMMARY_SECTION_BOUNDARY_KEYS.some((token) => key.includes(token));
}

function countMarkersInText(value: string): number {
  const key = simplifyForMatch(value);
  if (!key) return 0;

  const found = new Set<string>();
  for (const marker of SUMMARY_MARKER_KEYS) {
    if (new RegExp(`\\b${marker}\\b`, 'i').test(key)) {
      found.add(marker);
    }
  }

  return found.size;
}

function pickBestSummarySourceNode(
  $: CheerioAPI,
  nodes: AnyNode[]
): AnyNode | null {
  let bestNode: AnyNode | null = null;
  let bestScore = -1;

  for (const node of nodes) {
    const text = normalizeWhitespace($(node).text());
    if (text.length < 80) continue;

    const markerCount = countMarkersInText(text);
    const score = markerCount * 10_000 + Math.min(text.length, 8_000);

    if (score > bestScore) {
      bestNode = node;
      bestScore = score;
    }
  }

  return bestNode;
}

function selectSummarySourceNode($: CheerioAPI): AnyNode | null {
  const itemPropCandidates = $('[itemprop="description"]').toArray();
  const fromItemProp = pickBestSummarySourceNode($, itemPropCandidates);
  if (fromItemProp) return fromItemProp;

  const fallbackCandidates: AnyNode[] = [];
  const seen = new Set<AnyNode>();
  for (const selector of SUMMARY_FALLBACK_DESCRIPTION_SELECTORS) {
    for (const node of $(selector).toArray()) {
      if (seen.has(node)) continue;
      seen.add(node);
      fallbackCandidates.push(node);
    }
  }

  return pickBestSummarySourceNode($, fallbackCandidates);
}

function extractSummaryLinesFromSource(
  $: CheerioAPI,
  sourceNode: AnyNode
): string[] {
  const lines = htmlToLines($.html(sourceNode) ?? '');
  const output: string[] = [];

  for (const line of lines) {
    const normalized = normalizeWhitespace(line);
    if (!normalized) continue;
    if (isSummarySectionBoundaryLine(normalized)) break;
    output.push(normalized);
  }

  return output;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function insertSummaryLineBreaks(value: string): string {
  let output = value;
  for (const rule of SUMMARY_LABEL_RULES) {
    const aliasesPattern = rule.aliases.map((alias) => escapeRegex(alias)).join('|');
    const pattern = new RegExp(`(?:${aliasesPattern})\\s*:\\s*`, 'gi');
    output = output.replace(pattern, `\n${rule.label} : `);
  }
  return output;
}

function isSummaryLabelLine(line: string): boolean {
  const key = simplifyForMatch(line);
  return SUMMARY_LABEL_RULES.some((rule) => {
    const labelKey = simplifyForMatch(rule.label);
    return new RegExp(`\\b${labelKey}\\b`, 'i').test(key);
  });
}

function hasSummaryRequiredInfo(lines: string[]): boolean {
  const found = new Set<string>();

  for (const line of lines) {
    const key = simplifyForMatch(line);
    if (!key) continue;

    for (const marker of SUMMARY_MARKER_KEYS) {
      if (new RegExp(`\\b${marker}\\b`, 'i').test(key)) {
        found.add(marker);
      }
    }
  }

  return found.size >= 2;
}

function sanitizeSummaryLines(rawLines: string[]): string[] {
  const splitLines = insertSummaryLineBreaks(rawLines.join('\n'))
    .split('\n')
    .map((line) => line.replace(/\u00A0/g, ' '));

  return dedupeLines(
    splitLines
      .map((line) => line.trim())
      .map((line) => line.replace(/\s*:\s*/g, ' : '))
      .filter((line) => line.length >= 2)
      .filter((line) => !isNoiseLine(line))
      .filter((line) => line.length <= 320)
  );
}

function formatSummaryOutput(lines: string[]): string {
  if (lines.length <= 1) return lines.join('\n');

  const [firstLine, secondLine, ...rest] = lines;
  if (!firstLine.includes(':') && isSummaryLabelLine(secondLine)) {
    return `${firstLine}\n\n${[secondLine, ...rest].join('\n')}`;
  }

  return lines.join('\n');
}

function extractSummary($: CheerioAPI): string | null {
  const sourceNode = selectSummarySourceNode($);
  if (!sourceNode) return null;

  const extractedLines = extractSummaryLinesFromSource($, sourceNode);
  const sanitized = sanitizeSummaryLines(extractedLines);
  if (!hasSummaryRequiredInfo(sanitized)) return null;

  const summary = truncate(formatSummaryOutput(sanitized), MAX_SUMMARY_BLOCK_LENGTH);
  return summary.length > 30 ? summary : null;
}

function joinActivities(activities: string[]): string | null {
  if (activities.length === 0) return null;
  return activities.map((activity) => `- ${activity}`).join('\n');
}

function extractActivities($: CheerioAPI): string[] {
  const values: string[] = [];

  $('h2, h3, h4').each((_, heading) => {
    if (values.length >= MAX_ACTIVITIES) return false;
    const headingText = normalizeWhitespace($(heading).text());
    if (!/activit|programme|loisir|animation/i.test(headingText)) return;

    $(heading)
      .nextAll('ul,ol')
      .first()
      .find('li')
      .each((__, item) => {
        if (values.length >= MAX_ACTIVITIES) return false;
        const text = normalizeWhitespace($(item).text());
        if (text.length >= 2) values.push(text);
      });
  });

  if (values.length === 0) {
    $('[class*="activit"], [id*="activit"]').find('li').each((_, item) => {
      if (values.length >= MAX_ACTIVITIES) return false;
      const text = normalizeWhitespace($(item).text());
      if (text.length >= 2) values.push(text);
    });
  }

  return unique(values).slice(0, MAX_ACTIVITIES);
}

function detectRegion(
  visibleText: string,
  hints: AddressHint[]
): string | null {
  const directHintMatches = hints
    .map((hint) => hint.region)
    .filter((value): value is string => Boolean(value))
    .map((value) => mapToRegion(value))
    .filter((value): value is string => Boolean(value));

  if (directHintMatches.length > 0) {
    const uniqueMatches = unique(directHintMatches);
    if (uniqueMatches.length === 1) return uniqueMatches[0];
  }

  const haystack = simplifyForMatch(visibleText);
  const matchedRegions = NON_FOREIGN_REGIONS.filter((region) =>
    haystack.includes(simplifyForMatch(region))
  );

  return matchedRegions.length === 1 ? matchedRegions[0] : null;
}

function mapToRegion(value: string): string | null {
  const key = simplifyForMatch(value);
  if (!key) return null;

  const direct = NON_FOREIGN_REGIONS.find(
    (region) => simplifyForMatch(region) === key
  );
  if (direct) return direct;

  const fuzzy = NON_FOREIGN_REGIONS.find((region) =>
    simplifyForMatch(region).includes(key) || key.includes(simplifyForMatch(region))
  );
  return fuzzy ?? null;
}

function extractLocationFromHints(
  hints: AddressHint[],
  regionText: string | null
): string | null {
  for (const hint of hints) {
    if (!hint.locality) continue;
    const parts = [hint.locality];

    if (hint.department) {
      parts.push(hint.department);
    } else if (hint.region && (!regionText || simplifyForMatch(hint.region) !== simplifyForMatch(regionText))) {
      parts.push(hint.region);
    }

    if (hint.postalCode) {
      parts.push(hint.postalCode);
    }

    const location = normalizeWhitespace(parts.join(', '));
    if (location && simplifyForMatch(location) !== simplifyForMatch(regionText ?? '')) {
      return location;
    }
  }

  return null;
}

function extractLocationFromText(
  visibleText: string,
  regionText: string | null
): string | null {
  const cityDepartmentPattern =
    /\b([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ' -]{2,50})\s*-\s*([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ' -]{2,50})\s*-\s*\d{2}\b/g;
  const cityDepartment = cityDepartmentPattern.exec(visibleText);
  if (cityDepartment?.[1] && cityDepartment[2]) {
    const candidate = normalizeWhitespace(`${cityDepartment[1]}, ${cityDepartment[2]}`);
    if (simplifyForMatch(candidate) !== simplifyForMatch(regionText ?? '')) {
      return candidate;
    }
  }

  const labeledPattern =
    /\b(?:lieu|ville|localisation|centre)\s*[:\-]\s*([A-ZÀ-ÖØ-Ý][^.;\n]{2,80})/i;
  const labeled = labeledPattern.exec(visibleText)?.[1];
  if (labeled) {
    const candidate = cleanTextCandidate(labeled, 100);
    if (candidate && simplifyForMatch(candidate) !== simplifyForMatch(regionText ?? '')) {
      return candidate;
    }
  }

  return null;
}

function parseDateParts(raw: string): {
  day: number;
  month: number;
  year: number;
} | null {
  const normalized = normalizeWhitespace(raw).replace(/\./g, '/').replace(/-/g, '/');
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month, year };
}

function parseFrenchDate(raw: string, fallbackYear: number | null = null): string | null {
  const numeric = parseDateParts(raw);
  if (numeric) {
    return toIsoDate(numeric.day, numeric.month, numeric.year);
  }

  const match = normalizeWhitespace(raw).match(
    /^(\d{1,2})\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)(?:\s+(\d{4}))?$/
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTHS[simplifyForMatch(match[2])];
  const year = match[3] ? Number(match[3]) : fallbackYear;
  if (!month || !year || !Number.isFinite(day) || day < 1 || day > 31) return null;
  return toIsoDate(day, month, year);
}

function toIsoDate(day: number, month: number, year: number): string | null {
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return iso;
}

export function detectSessionAvailability(snippet: string): DraftSessionItem['availability'] {
  const normalized = simplifyForMatch(snippet);
  if (!normalized) return null;
  if (/\bcomplet|complete|sold out\b/.test(normalized)) return 'full';
  if (/\bliste d attente|attente\b/.test(normalized)) return 'waitlist';
  if (/\bderniere?s?\s+place|places?\s+restantes?|plus que\b/.test(normalized)) return 'limited';
  if (/\bdisponible|disponibilite|inscription ouverte|ouvert\b/.test(normalized)) return 'available';
  return null;
}

/** Normalise les libellés d’options CESL (tirets unicode, espaces). */
function normalizeCeslPeriodOptionLabel(raw: string): string {
  return normalizeWhitespace(
    raw
      .replace(/\u2013/g, '-')
      .replace(/\u2014/g, '-')
      .replace(/\u00A0/g, ' ')
  );
}

export function parseSessionLabelToItem(label: string): DraftSessionItem | null {
  const normalized = normalizeCeslPeriodOptionLabel(label);
  if (!normalized) return null;

  const sameMonth = normalized.match(
    /\bdu\s+(\d{1,2})\s+(?:au|a|à)\s+(\d{1,2})\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d{4})\b/i
  );
  if (sameMonth) {
    const dayStart = Number(sameMonth[1]);
    const dayEnd = Number(sameMonth[2]);
    const month = MONTHS[simplifyForMatch(sameMonth[3])];
    const year = Number(sameMonth[4]);
    return {
      label: normalized,
      start_date: month ? toIsoDate(dayStart, month, year) : null,
      end_date: month ? toIsoDate(dayEnd, month, year) : null,
      price: null,
      availability: detectSessionAvailability(normalized) ?? 'unknown'
    };
  }

  const crossMonth = normalized.match(
    /\bdu\s+(\d{1,2})\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(?:au|a|à)\s+(\d{1,2})\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d{4})\b/i
  );
  if (crossMonth) {
    const dayStart = Number(crossMonth[1]);
    const startMonth = MONTHS[simplifyForMatch(crossMonth[2])];
    const dayEnd = Number(crossMonth[3]);
    const endMonth = MONTHS[simplifyForMatch(crossMonth[4])];
    const year = Number(crossMonth[5]);
    return {
      label: normalized,
      start_date: startMonth ? toIsoDate(dayStart, startMonth, year) : null,
      end_date: endMonth ? toIsoDate(dayEnd, endMonth, year) : null,
      price: null,
      availability: detectSessionAvailability(normalized) ?? 'unknown'
    };
  }

  const numeric = normalized.match(
    /\bdu\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\s*(?:au|a|à)\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/i
  );
  if (numeric) {
    return {
      label: normalized,
      start_date: parseFrenchDate(numeric[1]),
      end_date: parseFrenchDate(numeric[2]),
      price: null,
      availability: detectSessionAvailability(normalized) ?? 'unknown'
    };
  }

  return null;
}

/** Même logique pour Map CESL et fusion import statique + Playwright (`mergeExtractedSessions`). */
export function buildStaySessionMergeKey(session: DraftSessionItem): string {
  return (session.start_date || session.end_date)
    ? `${session.start_date ?? ''}|${session.end_date ?? ''}`
    : simplifyForMatch(session.label);
}

function buildSessionKey(session: DraftSessionItem): string {
  return buildStaySessionMergeKey(session);
}

function extractStructuredSessionOptions($: CheerioAPI): DraftSessionItem[] {
  const sessions = new Map<string, DraftSessionItem>();

  $('select option, .ui-selectmenu-text, [role="option"]').each((_, node) => {
    const parsed = parseSessionLabelToItem($(node).text());
    if (!parsed) return;
    const key = buildSessionKey(parsed);
    if (!key || sessions.has(key)) return;
    sessions.set(key, parsed);
  });

  return Array.from(sessions.values()).sort((left, right) => {
    const leftKey = left.start_date ?? left.end_date ?? left.label ?? '';
    const rightKey = right.start_date ?? right.end_date ?? right.label ?? '';
    return leftKey.localeCompare(rightKey, 'fr');
  });
}

type CeslDurationJson = Record<
  string,
  Record<
    string,
    {
      dates?: string;
      villes?: string;
      tarifs?: {
        public?: { label?: string; value?: string };
        partner?: { label?: string; value?: string };
      };
      attente?: string;
      complet?: string;
    }
  >
>;

function extractCeslDurationJson(html: string): CeslDurationJson | null {
  const match = html.match(/var\s+sDureesJson\s*=\s*'((?:\\.|[^'])*)'/i);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as CeslDurationJson;
  } catch {
    return null;
  }
}

function parseCeslAvailability(entry: {
  attente?: string;
  complet?: string;
}): DraftSessionItem['availability'] {
  if (String(entry.complet ?? '').trim() === '1') return 'full';
  if (String(entry.attente ?? '').trim() === '1') return 'waitlist';
  return 'available';
}

/**
 * CEI : bloc typique
 * `<small>A partir de</small><strong>1830€</strong><small>(Prix sans transport)</small>`
 */
function extractCeiApartirStrongPriceDom(html: string): number | null {
  const $ = load(html);
  let found: number | null = null;
  $('small').each((_, sm) => {
    if (found != null) return;
    const t = normalizeWhitespace($(sm).text()).toLowerCase();
    if (!t.includes('partir')) return;
    const strong = $(sm).nextAll('strong').first();
    if (strong.length === 0) return;
    const p = parseFrenchAmount(normalizeWhitespace(strong.text()), 30, 20_000);
    if (p != null) found = p;
  });
  if (found != null) return found;
  const m = html.match(/<small>[^<]*partir\s+de[^<]*<\/small>\s*<strong>([^<]+)<\/strong>/i);
  if (m?.[1]) {
    return parseFrenchAmount(normalizeWhitespace(m[1]), 30, 20_000);
  }
  return null;
}

/**
 * Prix séjour CESL : bloc « Tarif public » (`.tarif-1`), pas partenaire (`.tarif-2`) ni transport.
 */
function extractCeslStayPublicPriceFromTarif1Dom(html: string): number | null {
  const $ = load(html);
  const labelNodes = $('.tarif-label').toArray();
  for (const node of labelNodes) {
    const text = normalizeWhitespace($(node).text()).toLowerCase();
    if (!text.includes('public')) continue;
    if (text.includes('partenaire')) continue;
    if (text.includes('transport')) continue;
    const block = $(node).closest('.tarif-1');
    if (block.length === 0) continue;
    const raw = normalizeWhitespace(block.find('.tarif-value').first().text());
    const p = parseFrenchAmount(raw, 30, 20_000);
    if (p != null) return p;
  }
  return null;
}

/** Ajoute les périodes présentes dans le &lt;select&gt; (ex. « Complet ») absentes du JSON `sDureesJson`. */
function mergeCeslSelectPeriodOptionsIntoSessions(html: string, sessions: Map<string, DraftSessionItem>): void {
  const $ = load(html);
  const selector =
    'select#sejour-periode option, select.sejour-periode option, select[name="sejour_periode"] option';
  $(selector).each((_, el) => {
    const value = ($(el).attr('value') ?? '').trim();
    const label = normalizeCeslPeriodOptionLabel($(el).text());
    if (!label) return;
    const parsed = parseSessionLabelToItem(label);
    if (!value && !parsed && !detectSessionAvailability(label)) return;
    if (!parsed) {
      mergeCeslSessionIntoMap(sessions, {
        label,
        start_date: null,
        end_date: null,
        price: null,
        availability: detectSessionAvailability(label) ?? 'unknown'
      });
      return;
    }

    const fromSelect: DraftSessionItem = {
      ...parsed,
      label,
      price: null,
      availability: detectSessionAvailability(label) ?? parsed.availability ?? 'unknown'
    };

    mergeCeslSessionIntoMap(sessions, fromSelect);
  });
}

/** Uniquement le champ JSON « public » — jamais le tarif partenaire. */
function ceslSessionPriceFromTarifEntry(entry: {
  tarifs?: { public?: { value?: string }; partner?: { value?: string } };
}): number | null {
  return parseFrenchAmount(String(entry?.tarifs?.public?.value ?? ''), 30, 20_000);
}

/**
 * Fusionne deux lignes pour la même période. La 2e passe d’import (souvent Playwright,
 * prix lu sous le libellé « Tarif public » CESL) remplace le prix si elle en a un.
 */
export function mergeDraftSessionItems(a: DraftSessionItem, b: DraftSessionItem): DraftSessionItem {
  const pa = typeof a.price === 'number' && Number.isFinite(a.price) && a.price > 0 ? a.price : null;
  const pb = typeof b.price === 'number' && Number.isFinite(b.price) && b.price > 0 ? b.price : null;
  const price = pb ?? pa ?? null;
  const label = (a.label?.length ?? 0) >= (b.label?.length ?? 0) ? a.label : b.label;
  const availabilityA = a.availability === 'unknown' ? null : a.availability;
  const availabilityB = b.availability === 'unknown' ? null : b.availability;
  return {
    ...a,
    ...b,
    price,
    label,
    availability: availabilityB ?? availabilityA ?? 'unknown'
  };
}

function mergeCeslSessionIntoMap(map: Map<string, DraftSessionItem>, session: DraftSessionItem): void {
  const key = buildSessionKey(session);
  if (!key) return;
  const existing = map.get(key);
  map.set(key, existing ? mergeDraftSessionItems(existing, session) : session);
}

function extractCeslSessionsFromHtml(html: string): DraftSessionItem[] | null {
  const durationJson = extractCeslDurationJson(html);

  const sessions = new Map<string, DraftSessionItem>();
  if (durationJson) {
    for (const durationEntries of Object.values(durationJson)) {
      if (!durationEntries || typeof durationEntries !== 'object') continue;
      for (const entry of Object.values(durationEntries)) {
        const dates = normalizeWhitespace(entry?.dates ?? '');
        if (!dates) continue;
        const parsed = parseSessionLabelToItem(dates);
        if (!parsed) continue;
        const price = ceslSessionPriceFromTarifEntry(
          entry as { tarifs?: { public?: { value?: string }; partner?: { value?: string } } }
        );
        const session: DraftSessionItem = {
          ...parsed,
          label: dates,
          price,
          availability: parseCeslAvailability(entry) ?? 'unknown'
        };
        mergeCeslSessionIntoMap(sessions, session);
      }
    }
  }

  mergeCeslSelectPeriodOptionsIntoSessions(html, sessions);

  if (sessions.size === 0) return null;

  const list = Array.from(sessions.values());
  patchCeslSessionsWhenDomPublicReplacesPartnerLikeJson(list, html);

  return list.sort((left, right) => {
    const leftKey = left.start_date ?? left.end_date ?? left.label ?? '';
    const rightKey = right.start_date ?? right.end_date ?? right.label ?? '';
    return leftKey.localeCompare(rightKey, 'fr');
  });
}

/**
 * Si le JSON met le même montant « bas » sur toutes les lignes (ex. 3100 € partenaire mal mappé)
 * et que le DOM affiche un tarif public plus élevé (ex. 3410 € dans `.tarif-1`), on aligne les sessions.
 */
function patchCeslSessionsWhenDomPublicReplacesPartnerLikeJson(
  sessions: DraftSessionItem[],
  html: string
): void {
  const dom = extractCeslStayPublicPriceFromTarif1Dom(html);
  if (dom == null || sessions.length === 0) return;

  const nums = sessions
    .map((s) => s.price)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0);
  if (nums.length === 0) {
    for (const s of sessions) {
      s.price = dom;
    }
    return;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max && dom > min && dom - min <= 1200) {
    for (const s of sessions) {
      s.price = dom;
    }
  }
}

/**
 * Prix public de la période **sélectionnée** dans `#sejour-periode` (pas le min sur toutes les périodes).
 */
function extractCeslSelectedPeriodPublicFromJson(html: string): number | null {
  const durationJson = extractCeslDurationJson(html);
  if (!durationJson) return null;
  const $ = load(html);
  const selected = $(
    'select#sejour-periode option[selected], select[name="sejour_periode"] option[selected]'
  ).first();
  const periodValue = selected.attr('value')?.trim();
  if (!periodValue) return null;

  for (const durationEntries of Object.values(durationJson)) {
    if (!durationEntries || typeof durationEntries !== 'object') continue;
    const record = durationEntries as Record<
      string,
      { tarifs?: { public?: { value?: string }; partner?: { value?: string } } }
    >;
    const entry = record[periodValue];
    if (entry && typeof entry === 'object') {
      return ceslSessionPriceFromTarifEntry(entry);
    }
  }
  return null;
}

export function extractCeslStructuredBookingData(
  html: string,
  sourceUrl: string
): {
  sessions: DraftSessionItem[];
  transportOptions: Array<Record<string, unknown>>;
  priceFrom: number | null;
} | null {
  const durationJson = extractCeslDurationJson(html);
  if (!durationJson) return null;

  const sessions = extractCeslSessionsFromHtml(html) ?? [];
  const allSessionKeys = sessions.map((session, index) => draftSessionStableKey(session as Record<string, unknown>, index));
  const cityRows = new Map<
    string,
    {
      city: string;
      amountCents: number;
      includedSessionKeys: Set<string>;
    }
  >();

  for (const durationEntries of Object.values(durationJson)) {
    if (!durationEntries || typeof durationEntries !== 'object') continue;
    for (const entry of Object.values(durationEntries)) {
      const dates = normalizeWhitespace(entry?.dates ?? '');
      if (!dates) continue;
      const parsedSession = parseSessionLabelToItem(dates);
      if (!parsedSession) continue;
      const sessionIndex = sessions.findIndex(
        (session) =>
          session.start_date === parsedSession.start_date &&
          session.end_date === parsedSession.end_date
      );
      const sessionKey =
        sessionIndex >= 0
          ? allSessionKeys[sessionIndex]
          : draftSessionStableKey(parsedSession as Record<string, unknown>, allSessionKeys.length);

      const citiesRaw = normalizeWhitespace(entry?.villes ?? '');
      if (!citiesRaw) continue;
      for (const chunk of citiesRaw.split(',')) {
        const normalizedChunk = normalizeWhitespace(chunk);
        if (!normalizedChunk) continue;
        const separatorIndex = normalizedChunk.lastIndexOf(':');
        if (separatorIndex <= 0) continue;

        const city = normalizeTransportCityLabel(normalizedChunk.slice(0, separatorIndex));
        const amountEur = parseFrenchAmount(normalizedChunk.slice(separatorIndex + 1), 0, 20_000);
        if (!city || amountEur === null) continue;

        const amountCents = Math.round(amountEur * 100);
        const key = `${simplifyForMatch(city)}|${amountCents}`;
        const existing = cityRows.get(key) ?? {
          city,
          amountCents,
          includedSessionKeys: new Set<string>()
        };
        existing.includedSessionKeys.add(sessionKey);
        cityRows.set(key, existing);
      }
    }
  }

  const transportOptions = Array.from(cityRows.values())
    .map((row) => ({
      label: row.city,
      departure_city: row.city,
      return_city: row.city,
      amount_cents: row.amountCents,
      price: Number((row.amountCents / 100).toFixed(2)),
      currency: 'EUR',
      source_url: sourceUrl,
      excluded_session_keys: allSessionKeys.filter((sessionKey) => !row.includedSessionKeys.has(sessionKey))
    }))
    .sort((left, right) => String(left.label).localeCompare(String(right.label), 'fr'));

  const publicPrices = sessions
    .map((session) => session.price)
    .filter((price): price is number => typeof price === 'number' && Number.isFinite(price) && price > 0);
  const distinctPublicPrices = Array.from(new Set(publicPrices));

  return {
    sessions,
    transportOptions,
    priceFrom: distinctPublicPrices.length === 1 ? distinctPublicPrices[0] : null
  };
}

function extractReservationCallToAction(
  $: CheerioAPI,
  visibleText: string
): DraftSessionItem['availability'] {
  const pageKey = simplifyForMatch(visibleText);
  if (!pageKey) return null;
  if (/\bcomplet|indisponible|sold out|inscriptions closes|inscriptions fermees\b/i.test(pageKey)) {
    return 'full';
  }

  const ctaText = $('a, button, input[type="submit"], input[type="button"]')
    .toArray()
    .map((node) =>
      normalizeWhitespace(
        [
          $(node).text(),
          $(node).attr('value') ?? '',
          $(node).attr('aria-label') ?? '',
          $(node).attr('title') ?? ''
        ].join(' ')
      )
    )
    .filter(Boolean)
    .slice(0, 60)
    .join(' ');
  const ctaKey = simplifyForMatch(ctaText);

  if (/\b(reserver|je reserve|inscription|s inscrire|book now|booker)\b/i.test(ctaKey)) {
    return 'available';
  }

  return null;
}

function extractSessions($: CheerioAPI, visibleText: string, html: string): DraftSessionItem[] | null {
  const ceslSessions = extractCeslSessionsFromHtml(html);
  if (ceslSessions && ceslSessions.length > 0) {
    return ceslSessions;
  }

  const sessions: DraftSessionItem[] = [];
  const defaultAvailability = extractReservationCallToAction($, visibleText);
  const structuredSessions = extractStructuredSessionOptions($);

  const sessionScore = (session: DraftSessionItem): number => {
    let score = 0;
    if (session.start_date) score += 20;
    if (session.end_date) score += 20;
    if (typeof session.price === 'number' && Number.isFinite(session.price) && session.price > 0) score += 30;
    if (session.availability === 'available') score += 15;
    else if (session.availability) score += 10;
    if (session.label) score += Math.min(session.label.length, 20);
    return score;
  };

  const patternMonthSame =
    /\bdu\s+(\d{1,2})\s+(?:au|a|à)\s+(\d{1,2})\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d{4})\b/gi;
  let matchMonthSame: RegExpExecArray | null = null;
  while ((matchMonthSame = patternMonthSame.exec(visibleText)) !== null) {
    const dayStart = Number(matchMonthSame[1]);
    const dayEnd = Number(matchMonthSame[2]);
    const month = MONTHS[simplifyForMatch(matchMonthSame[3])];
    const year = Number(matchMonthSame[4]);
    const startDate = month ? toIsoDate(dayStart, month, year) : null;
    const endDate = month ? toIsoDate(dayEnd, month, year) : null;
    const label = normalizeWhitespace(matchMonthSame[0]);
    const snippet = visibleText.slice(
      Math.max(0, matchMonthSame.index - 120),
      Math.min(visibleText.length, matchMonthSame.index + MAX_SESSION_SNIPPET_LENGTH)
    );
    sessions.push({
      label,
      start_date: startDate,
      end_date: endDate,
      price: findPublicPriceInText(snippet),
      availability: detectSessionAvailability(snippet) ?? defaultAvailability ?? 'unknown'
    });
  }

  const patternNumeric =
    /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\s*(?:-|au|a|à)\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/g;
  let matchNumeric: RegExpExecArray | null = null;
  while ((matchNumeric = patternNumeric.exec(visibleText)) !== null) {
    const label = normalizeWhitespace(matchNumeric[0]);
    const startDate = parseFrenchDate(matchNumeric[1]);
    const endDate = parseFrenchDate(matchNumeric[2]);
    const snippet = visibleText.slice(
      Math.max(0, matchNumeric.index - 120),
      Math.min(visibleText.length, matchNumeric.index + MAX_SESSION_SNIPPET_LENGTH)
    );
    sessions.push({
      label,
      start_date: startDate,
      end_date: endDate,
      price: findPublicPriceInText(snippet),
      availability: detectSessionAvailability(snippet) ?? defaultAvailability ?? 'unknown'
    });
  }

  const dedupedByPeriod = new Map<string, DraftSessionItem>();
  for (const session of sessions) {
    const key = buildSessionKey(session);
    if (!key) continue;

    const existing = dedupedByPeriod.get(key);
    if (!existing || sessionScore(session) > sessionScore(existing)) {
      dedupedByPeriod.set(key, session);
    }
  }

  const deduped = Array.from(dedupedByPeriod.values()).sort((left, right) => {
    const leftKey = left.start_date ?? left.end_date ?? left.label ?? '';
    const rightKey = right.start_date ?? right.end_date ?? right.label ?? '';
    return leftKey.localeCompare(rightKey, 'fr');
  });

  if (structuredSessions.length > 1) {
    const inferredByPeriod = new Map(deduped.map((session) => [buildSessionKey(session), session] as const));
    const mergedByPeriod = new Map<string, DraftSessionItem>();

    for (const session of structuredSessions) {
      const inferred = inferredByPeriod.get(buildSessionKey(session));
      const merged = {
        ...session,
        price: inferred?.price ?? null,
        availability: session.availability ?? inferred?.availability ?? defaultAvailability ?? 'unknown'
      };
      mergedByPeriod.set(buildSessionKey(merged), merged);
    }

    for (const session of deduped) {
      const key = buildSessionKey(session);
      const existing = mergedByPeriod.get(key);
      if (!existing || sessionScore(session) > sessionScore(existing)) {
        mergedByPeriod.set(key, session);
      }
    }

    return Array.from(mergedByPeriod.values()).sort((left, right) => {
      const leftKey = left.start_date ?? left.end_date ?? left.label ?? '';
      const rightKey = right.start_date ?? right.end_date ?? right.label ?? '';
      return leftKey.localeCompare(rightKey, 'fr');
    });
  }

  return deduped.length > 0 ? deduped : null;
}

function detectTransportMode(transportText: string | null, visibleText: string): string | null {
  const source = simplifyForMatch([transportText, visibleText].filter(Boolean).join(' '));
  if (!source) return null;

  const hasTrain = /\btrain\b/.test(source);
  const hasPlane = /\bavion\b/.test(source);
  const hasCoach = /\b(bus|car)\b/.test(source);
  const hasOnSite = /\b(depose|deposee|depose sur|depose centre|rendez vous sur place|sur place)\b/.test(source);

  if (hasTrain && hasCoach) return 'train puis car';
  if (hasPlane && hasCoach) return 'avion puis car';
  if (hasTrain) return 'train';
  if (hasPlane) return 'avion';
  if (hasCoach) return 'car';
  if (hasOnSite) return 'arrivée sur place';
  return null;
}

type TransportSelectDirection = 'outbound' | 'return' | 'generic';

type TransportOptionCandidate = {
  label: string;
  rawLabel: string;
  url: string | null;
  selected: boolean;
};

type TransportSelectCandidate = {
  direction: TransportSelectDirection;
  context: string;
  options: TransportOptionCandidate[];
  selectedLabel: string | null;
  selectedLabelRaw: string | null;
};

type ParsedTransportPage = {
  sourceUrl: string;
  selectedOutbound: string | null;
  selectedReturn: string | null;
  selectedOutboundRaw: string | null;
  selectedReturnRaw: string | null;
  outboundSelect: TransportSelectCandidate | null;
  returnSelect: TransportSelectCandidate | null;
  currentPriceCents: number | null;
  outboundOptionCount: number;
  returnOptionCount: number;
  variantUrls: string[];
};

const TRANSPORT_PLACEHOLDER_KEYS = [
  'choisir',
  'selectionner',
  'sélectionner',
  'selection',
  'ville de depart',
  'ville de départ',
  'ville de retour',
  'transport aller',
  'transport retour',
  'aucun transport',
  'sans transport',
  'none',
  'tous',
  'transport aller retour',
  'transport aerien',
  'transport aerien aller retour',
  'transport aérien',
  'transport aérien aller retour'
];

const TRANSPORT_BASE_REFERENCE_KEYS = [
  'depose centre',
  'depose sur le centre',
  'depose au centre',
  'reprise centre',
  'reprise sur le centre',
  'reprise au centre',
  'sans transport',
  'sans acheminement',
  'sans convoyage',
  'rendez vous sur place',
  'rdv sur place',
  'sur place',
  'depart centre',
  'retour centre'
];

function sanitizeTransportLabel(value: string | null | undefined): string {
  if (!value) return '';
  return normalizeWhitespace(value)
    .replace(/\u00A0/g, ' ')
    .replace(/\s*[\(\[]?\+?\s*[0-9][0-9\s.,]*\s*(?:€|euros?)[^\)\]]*[\)\]]?/gi, '')
    .replace(/\s*-\s*\+?\s*[0-9][0-9\s.,]*\s*(?:€|euros?)/gi, '')
    .replace(/^transport\s*(aller|retour)?\s*[:\-]\s*/i, '')
    .trim();
}

function normalizeTransportCityLabel(value: string | null | undefined): string | null {
  const normalized = sanitizeTransportLabel(value);
  if (!normalized) return null;
  const key = simplifyForMatch(normalized);
  if (!key) return null;
  if (TRANSPORT_PLACEHOLDER_KEYS.some((item) => key.includes(simplifyForMatch(item)))) {
    return null;
  }
  if (key.includes('transport') && /\b(aerien|aerienne|aeroport|aller retour)\b/.test(key)) {
    return null;
  }
  return normalized.length > 80 ? normalized.slice(0, 80).trim() : normalized;
}

function getOptionVariantUrl($: CheerioAPI, option: AnyNode, pageUrl: string): string | null {
  const attrs = ['url', 'data-url', 'data-href', 'href', 'value'];
  for (const attr of attrs) {
    const raw = normalizeWhitespace($(option).attr(attr) ?? '');
    if (!raw || raw === '#') continue;
    if (attr === 'value' && !/[/?=&]|https?:/i.test(raw)) continue;
    const resolved = toAbsoluteUrl(raw, pageUrl);
    if (resolved) return resolved;
  }
  return null;
}

function detectTransportDirection(context: string): TransportSelectDirection | null {
  const key = simplifyForMatch(context);
  if (!key) return null;

  const hasTransport = /\btransport|acheminement|depart|départ|retour|reprise\b/i.test(key);
  const hasOutbound = /\baller|depart|départ|outbound\b/i.test(key);
  const hasReturn = /\bretour|arrivee|arrivée|reprise|inbound\b/i.test(key);

  if (hasOutbound && !hasReturn) return 'outbound';
  if (hasReturn && !hasOutbound) return 'return';
  if (hasTransport) return 'generic';

  if (/pdtopt|optvalueid|optvalue|hubville|villedepart|ville_depart|choixville/i.test(key)) {
    return 'generic';
  }

  return null;
}

function buildTransportSelectContext($: CheerioAPI, select: AnyNode): string {
  const node = $(select);
  const id = normalizeWhitespace(node.attr('id') ?? '');
  const name = normalizeWhitespace(node.attr('name') ?? '');
  const ariaLabel = normalizeWhitespace(node.attr('aria-label') ?? '');
  const title = normalizeWhitespace(node.attr('title') ?? '');
  const className = normalizeWhitespace(node.attr('class') ?? '');
  const linkedLabel = id
    ? normalizeWhitespace($(`label[for="${id}"]`).first().text())
    : '';
  const parentText = normalizeWhitespace(
    node.closest('td,th,tr,div,fieldset,section,form').first().text().slice(0, 1400)
  );

  return normalizeWhitespace([id, name, ariaLabel, title, className, linkedLabel, parentText].join(' '));
}

function getTransportSelectCandidates(
  $: CheerioAPI,
  pageUrl: string
): { outbound: TransportSelectCandidate | null; returnSelect: TransportSelectCandidate | null } {
  const candidates: TransportSelectCandidate[] = [];

  $('select').each((_, select) => {
    const context = buildTransportSelectContext($, select);
    const direction = detectTransportDirection(context);
    if (!direction) return;

    const options: TransportOptionCandidate[] = [];
    let selectedLabel: string | null = null;
    let selectedLabelRaw: string | null = null;

    $(select)
      .find('option')
      .each((__, option) => {
        const rawLabel = normalizeWhitespace($(option).text());
        const label = normalizeTransportCityLabel(rawLabel);
        const url = getOptionVariantUrl($, option, pageUrl);
        const selected = $(option).is(':selected') || $(option).attr('selected') !== undefined;
        if (selected && label) {
          selectedLabel = label;
          selectedLabelRaw = rawLabel || label;
        }
        if (!label && !url) return;
        options.push({
          label: label ?? rawLabel,
          rawLabel,
          url,
          selected
        });
      });

    if (options.length === 0) return;
    if (!selectedLabel) {
      const selectedOption =
        options.find((option) => option.selected) ??
        options.find((option) => Boolean(normalizeTransportCityLabel(option.label))) ??
        null;
      selectedLabel = selectedOption?.label ?? null;
      selectedLabelRaw = selectedOption?.rawLabel ?? selectedOption?.label ?? null;
    }

    candidates.push({
      direction,
      context,
      options,
      selectedLabel: normalizeTransportCityLabel(selectedLabel) ?? null,
      selectedLabelRaw: selectedLabelRaw ? normalizeWhitespace(selectedLabelRaw) : null
    });
  });

  const scoreCandidate = (candidate: TransportSelectCandidate) =>
    candidate.options.filter((option) => Boolean(option.url)).length * 10 + candidate.options.length;

  const outboundDirect = candidates
    .filter((candidate) => candidate.direction === 'outbound')
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0] ?? null;
  const returnDirect = candidates
    .filter((candidate) => candidate.direction === 'return')
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0] ?? null;
  const generic = candidates
    .filter((candidate) => candidate.direction === 'generic')
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  const outbound = outboundDirect ?? generic[0] ?? null;
  const returnSelect =
    returnDirect ??
    (generic.length > 1 ? generic[1] : null);

  return { outbound, returnSelect };
}

function extractCurrentPriceEur($: CheerioAPI, visibleText: string): number | null {
  const publicTariffBlocks = $('.tarif-1, [class*="tarif-1"], .tarif-public, [class*="tarif-public"]')
    .toArray()
    .map((node) => normalizeWhitespace($(node).text()))
    .filter((text) => {
      const key = simplifyForMatch(text);
      return key.includes('tarif public') && !key.includes('tarif partenaire');
    });

  for (const content of publicTariffBlocks) {
    const price = findPriceInTextWithMin(content, 0);
    if (price !== null) return price;
  }

  const labeledPublicTariffs = $('.tarif-label')
    .toArray()
    .map((node) => $(node).parent())
    .map((parent) => normalizeWhitespace(parent.text()))
    .filter((text) => {
      const key = simplifyForMatch(text);
      return key.includes('tarif public') && !key.includes('tarif partenaire');
    });

  for (const content of labeledPublicTariffs) {
    const price = findPriceInTextWithMin(content, 0);
    if (price !== null) return price;
  }

  const directTransportSelectors = [
    '.tarif-label + .badge .sejour-tarif.active',
    '.tarif-label + .badge .sejour-tarif',
    '.badge .sejour-tarif.active',
    '.badge .sejour-tarif',
    '.sejour-tarif.active',
    '.sejour-tarif'
  ];

  for (const selector of directTransportSelectors) {
    const nodes = $(selector).toArray().slice(0, 10);
    for (const node of nodes) {
      const content = normalizeWhitespace(
        [
          $(node).attr('content') ?? '',
          $(node).attr('value') ?? '',
          $(node).text()
        ].join(' ')
      );
      if (!content) continue;
      const containerText = normalizeWhitespace($(node).closest('div, td, li, article, section').text());
      const contentKey = simplifyForMatch(`${content} ${containerText}`);
      if (contentKey.includes('tarif partenaire')) continue;
      const price = findPriceInTextWithMin(content, 0);
      if (price !== null) return price;
    }
  }

  const selectors = [
    '[itemprop="price"]',
    '[class*="prix"]',
    '[id*="prix"]',
    '[class*="price"]',
    '[id*="price"]',
    '[class*="tarif"]',
    '[id*="tarif"]',
    '[class*="montant"]',
    '[data-price]',
    '[data-testid*="price" i]',
    '.prix',
    '.price'
  ];

  for (const selector of selectors) {
    const nodes = $(selector).toArray().slice(0, 20);
    for (const node of nodes) {
      const content = normalizeWhitespace(
        [
          $(node).attr('content') ?? '',
          $(node).attr('value') ?? '',
          $(node).text()
        ].join(' ')
      );
      if (!content) continue;
      const containerText = normalizeWhitespace($(node).closest('div, td, li, article, section').text());
      const contentKey = simplifyForMatch(`${content} ${containerText}`);
      if (contentKey.includes('tarif partenaire')) continue;
      const price = findPriceInTextWithMin(content, 0);
      if (price !== null) return price;
    }
  }

  return findPriceInTextWithMin(visibleText, 0);
}

function extractCurrentPriceCents($: CheerioAPI, visibleText: string): number | null {
  const priceEur = extractCurrentPriceEur($, visibleText);
  if (priceEur === null) return null;
  return Math.round(priceEur * 100);
}

function listVariantUrls(page: ParsedTransportPage): string[] {
  const urls = [
    ...(page.outboundSelect?.options ?? []).map((option) => option.url),
    ...(page.returnSelect?.options ?? []).map((option) => option.url)
  ].filter((url): url is string => Boolean(url));

  return unique(urls);
}

function parseTransportPage(html: string, sourceUrl: string): ParsedTransportPage {
  const $ = load(html);
  const visibleText = extractVisibleText($);
  const { outbound, returnSelect } = getTransportSelectCandidates($, sourceUrl);

  let selectedOutbound = normalizeTransportCityLabel(outbound?.selectedLabel);
  let selectedReturn = normalizeTransportCityLabel(returnSelect?.selectedLabel);
  let selectedOutboundRaw = normalizeWhitespace(outbound?.selectedLabelRaw ?? selectedOutbound ?? '');
  let selectedReturnRaw = normalizeWhitespace(returnSelect?.selectedLabelRaw ?? selectedReturn ?? '');

  if (!selectedReturn && selectedOutbound && !returnSelect) {
    selectedReturn = selectedOutbound;
    selectedReturnRaw = selectedOutboundRaw;
  } else if (!selectedOutbound && selectedReturn && !outbound) {
    selectedOutbound = selectedReturn;
    selectedOutboundRaw = selectedReturnRaw;
  }

  const parsed: ParsedTransportPage = {
    sourceUrl,
    selectedOutbound,
    selectedReturn,
    selectedOutboundRaw: selectedOutboundRaw || selectedOutbound || null,
    selectedReturnRaw: selectedReturnRaw || selectedReturn || null,
    outboundSelect: outbound,
    returnSelect,
    currentPriceCents: extractCurrentPriceCents($, visibleText),
    outboundOptionCount: outbound?.options.length ?? 0,
    returnOptionCount: returnSelect?.options.length ?? 0,
    variantUrls: []
  };
  parsed.variantUrls = listVariantUrls(parsed);
  return parsed;
}

export function isTransportBaseReference(value: string | null | undefined): boolean {
  const key = simplifyForMatch(value ?? '');
  if (!key) return false;
  return TRANSPORT_BASE_REFERENCE_KEYS.some((candidate) =>
    key.includes(simplifyForMatch(candidate))
  );
}

export {
  buildDraftTransportOptionsFromVariants,
  collapseTransportDraftOptionsJson,
  collapseTransportVariantsForDraft,
  pickPrimaryTransportCityLabel
} from './stay-draft-transport-display';

function normalizeTransportPair(page: ParsedTransportPage): {
  departureCity: string | null;
  returnCity: string | null;
  fallbackReason: string | null;
} {
  let departureCity = normalizeTransportCityLabel(page.selectedOutbound);
  let returnCity = normalizeTransportCityLabel(page.selectedReturn);
  let fallbackReason: string | null = null;

  if (!returnCity && departureCity && !page.returnSelect) {
    returnCity = departureCity;
    fallbackReason = 'symmetry-fallback-return';
  } else if (!departureCity && returnCity && !page.outboundSelect) {
    departureCity = returnCity;
    fallbackReason = 'symmetry-fallback-departure';
  }

  return {
    departureCity,
    returnCity,
    fallbackReason
  };
}

function resolveBaseTransportPrice(
  pages: ParsedTransportPage[]
): {
  basePriceCents: number | null;
  sourceUrl: string | null;
  reason: string;
} {
  const scored = pages
    .filter((page) => typeof page.currentPriceCents === 'number')
    .map((page) => {
      const outboundBase = isTransportBaseReference(page.selectedOutbound);
      const returnBase = isTransportBaseReference(page.selectedReturn);
      let score = 0;
      if (outboundBase) score += 2;
      if (returnBase) score += 2;
      if ((outboundBase || returnBase) && (!page.selectedOutbound || !page.selectedReturn)) score += 1;

      return {
        page,
        score,
        outboundBase,
        returnBase
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return (left.page.currentPriceCents ?? Number.MAX_SAFE_INTEGER) - (right.page.currentPriceCents ?? Number.MAX_SAFE_INTEGER);
    });

  const best = scored[0];
  if (!best || typeof best.page.currentPriceCents !== 'number') {
    return {
      basePriceCents: null,
      sourceUrl: null,
      reason: 'no-base-reference-variant-found'
    };
  }

  const reliable = best.score >= 3;
  if (!reliable) {
    return {
      basePriceCents: null,
      sourceUrl: null,
      reason: 'base-reference-too-weak'
    };
  }

  return {
    basePriceCents: best.page.currentPriceCents,
    sourceUrl: best.page.sourceUrl,
    reason: 'base-reference-found'
  };
}

function toTransportConfidence(
  pricingMethod: DraftTransportPriceDebug['pricing_method'],
  amountCents: number | null,
  departureCity: string | null,
  returnCity: string | null
): DraftTransportPriceDebug['confidence'] {
  if (
    (pricingMethod === 'delta_from_base' || pricingMethod === 'session_delta') &&
    amountCents !== null
  ) {
    if (pricingMethod === 'session_delta') return 'high';
    if (departureCity && returnCity) return 'high';
    return 'medium';
  }
  return 'low';
}

/** Prix de référence du séjour (hors transport) pour dériver le supplément transport (ex. Thalie : total affiché − prix session). */
export function pickImportedSessionReferencePriceCents(
  data: Pick<ExtractedStayData, 'sessionsJson' | 'priceFrom'>
): number | null {
  const sessions = data.sessionsJson;
  const sessionCents = (sessions ?? [])
    .map((s) =>
      s.price != null && Number.isFinite(s.price) && s.price >= 0 ? Math.round(s.price * 100) : null
    )
    .filter((v): v is number => v != null);
  const distinctSessionCents = Array.from(new Set(sessionCents));
  /** Plusieurs tarifs session différents : aucune référence unique (évite de prendre le min JSON-LD ou la 1re ligne). */
  if (distinctSessionCents.length > 1) {
    return null;
  }
  if (distinctSessionCents.length === 1) {
    return distinctSessionCents[0];
  }
  if (data.priceFrom != null && Number.isFinite(data.priceFrom) && data.priceFrom >= 0) {
    return Math.round(data.priceFrom * 100);
  }
  if (sessions) {
    for (const session of sessions) {
      if (session.price != null && Number.isFinite(session.price) && session.price >= 0) {
        return Math.round(session.price * 100);
      }
    }
  }
  return null;
}

export type ThalieSessionBaseline = {
  date_index: number;
  date_label: string;
  /** Total catalogue à l’option ville « référence » (index 0), ex. dépose centre — prix séjour pour cette date. */
  baseline_total_cents: number | null;
};

type ThaliePbOption = {
  value: string;
  label: string;
  url: string | null;
  selected: boolean;
};

export type ThalieOptionUrlPricingResult = {
  sessionBaselines: ThalieSessionBaseline[];
  transportVariants: DraftTransportVariant[];
  transportPriceDebug: DraftTransportPriceDebug[];
  transportMode: 'Aller/Retour similaire' | 'Aller/Retour différencié' | '';
};

function parseThaliePbOptions(html: string, pageUrl: string, selectName: string): ThaliePbOption[] {
  const $ = load(html);
  const select = $(`select[name="${selectName}"]`).first();
  if (!select.length) return [];

  return select
    .find('option')
    .toArray()
    .map((option) => {
      const node = $(option);
      const label = normalizeWhitespace(node.text());
      const rawUrl = normalizeWhitespace(node.attr('url') ?? '');
      return {
        value: normalizeWhitespace(node.attr('value') ?? ''),
        label,
        url: rawUrl ? toAbsoluteUrl(rawUrl, pageUrl) : null,
        selected: node.attr('selected') !== undefined
      };
    })
    .filter((option) => option.label.length > 0);
}

function parseThalieOfferTotalCents(html: string): number | null {
  const $ = load(html);
  const offers = $('td[itemprop="offers"], [itemprop="offers"]').first();
  if (!offers.length) return null;

  const meta = normalizeWhitespace(offers.find('meta[itemprop="price"]').first().attr('content') ?? '');
  if (meta) {
    const value = Number(meta.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(value) && value >= 0 && value < 80_000) {
      return Math.round(value * 100);
    }
  }

  const priceText = normalizeWhitespace(offers.find('span.PBSalesPrice').first().text());
  if (!priceText) return null;
  const amount = findPriceInText(priceText);
  return amount !== null ? Math.round(amount * 100) : null;
}

function chooseAggregatedThalieAmount(samples: number[]): { amountCents: number | null; confidence: 'high' | 'medium' | 'low' } {
  if (samples.length === 0) {
    return { amountCents: null, confidence: 'low' };
  }

  const counts = new Map<number, number>();
  for (const sample of samples) {
    counts.set(sample, (counts.get(sample) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0] - right[0];
  });

  const [amountCents, hitCount] = ranked[0];
  if (ranked.length === 1) {
    return { amountCents, confidence: 'high' };
  }
  return { amountCents, confidence: hitCount >= 2 ? 'medium' : 'low' };
}

/**
 * Logique dédiée Thalie / PB :
 * - prix session = prix affiché sur l'URL de la date, avec les options par défaut
 * - prix transport aller = total de la ville - prix session
 * - prix transport global = aller * 2
 */
export async function extractThalieOptionUrlPricing(
  sourceHtml: string,
  sourceUrl: string
): Promise<ThalieOptionUrlPricingResult> {
  const dateOptions = parseThaliePbOptions(sourceHtml, sourceUrl, 'PDTOPTVALUEID0');
  const transportMode =
    parseThaliePbOptions(sourceHtml, sourceUrl, 'PDTOPTVALUEID1').length > 0 &&
    parseThaliePbOptions(sourceHtml, sourceUrl, 'PDTOPTVALUEID2').length > 0
      ? 'Aller/Retour différencié'
      : parseThaliePbOptions(sourceHtml, sourceUrl, 'PDTOPTVALUEID1').length > 0
        ? 'Aller/Retour similaire'
        : '';

  const sessionBaselines: ThalieSessionBaseline[] = [];
  const transportPriceDebug: DraftTransportPriceDebug[] = [];
  const samplesByCity = new Map<
    string,
    {
      city: string;
      amounts: number[];
      sampleSourceUrls: string[];
    }
  >();

  const effectiveDateOptions =
    dateOptions.length > 0
      ? dateOptions
      : [
          {
            value: '',
            label: normalizeWhitespace(sourceUrl.split('/').pop() ?? 'session'),
            url: sourceUrl,
            selected: true
          }
        ];

  for (let dateIndex = 0; dateIndex < effectiveDateOptions.length; dateIndex += 1) {
    const dateOption = effectiveDateOptions[dateIndex];
    const dateUrl = dateOption.url ?? sourceUrl;
    let datePage: FetchedHtml | null = null;

    try {
      datePage = await fetchHtml(dateUrl);
    } catch {
      sessionBaselines.push({
        date_index: dateIndex,
        date_label: dateOption.label,
        baseline_total_cents: null
      });
      continue;
    }

    const baselineTotalCents = parseThalieOfferTotalCents(datePage.html);
    sessionBaselines.push({
      date_index: dateIndex,
      date_label: dateOption.label,
      baseline_total_cents: baselineTotalCents
    });

    const outboundOptions = parseThaliePbOptions(datePage.html, datePage.finalUrl, 'PDTOPTVALUEID1');
    for (const outboundOption of outboundOptions) {
      const city = normalizeTransportCityLabel(outboundOption.label);
      if (!city || isTransportBaseReference(city)) continue;
      if (!outboundOption.url) continue;

      let cityPage: FetchedHtml | null = null;
      try {
        cityPage = await fetchHtml(outboundOption.url);
      } catch {
        transportPriceDebug.push({
          variant_url: outboundOption.url,
          departure_city: city,
          return_city: null,
          page_price_cents: null,
          base_price_cents: baselineTotalCents,
          amount_cents: null,
          pricing_method: 'thalie_option_url_delta',
          confidence: 'low',
          reason: `thalie-option-url-fetch-failed:${dateIndex}`,
          departure_label_raw: outboundOption.label,
          return_label_raw: dateOption.label
        });
        continue;
      }

      const totalCents = parseThalieOfferTotalCents(cityPage.html);
      const oneWayCents =
        typeof baselineTotalCents === 'number' &&
        typeof totalCents === 'number' &&
        totalCents >= baselineTotalCents
          ? totalCents - baselineTotalCents
          : null;
      const roundTripCents = oneWayCents !== null ? oneWayCents * 2 : null;

      transportPriceDebug.push({
        variant_url: cityPage.finalUrl,
        departure_city: city,
        return_city: null,
        page_price_cents: totalCents,
        base_price_cents: baselineTotalCents,
        amount_cents: roundTripCents,
        pricing_method: 'thalie_option_url_delta',
        confidence: roundTripCents !== null ? 'high' : 'low',
        reason: `thalie-option-url:date[${dateIndex}]`,
        departure_label_raw: outboundOption.label,
        return_label_raw: dateOption.label
      });

      if (roundTripCents === null) continue;

      const key = simplifyForMatch(city);
      const existing = samplesByCity.get(key) ?? {
        city,
        amounts: [],
        sampleSourceUrls: []
      };
      existing.amounts.push(roundTripCents);
      existing.sampleSourceUrls.push(cityPage.finalUrl);
      samplesByCity.set(key, existing);
    }
  }

  const transportVariants: DraftTransportVariant[] = [];
  for (const entry of Array.from(samplesByCity.values())) {
    const aggregate = chooseAggregatedThalieAmount(entry.amounts);
    if (aggregate.amountCents === null) continue;
    transportVariants.push({
      departure_city: entry.city,
      return_city: entry.city,
      amount_cents: aggregate.amountCents,
      currency: 'EUR',
      source_url: entry.sampleSourceUrls[0] ?? sourceUrl,
      departure_label_raw: entry.city,
      return_label_raw: null,
      pricing_method: 'thalie_option_url_delta',
      confidence: aggregate.confidence,
      reason: `thalie-option-url:aggregated:${entry.amounts.length}`
    });
  }
  transportVariants.sort((left, right) => left.departure_city.localeCompare(right.departure_city, 'fr'));

  return {
    sessionBaselines,
    transportVariants,
    transportPriceDebug,
    transportMode
  };
}

/**
 * Applique les totaux session lus sur la fiche dynamique (Thalie PBP) aux lignes `sessionsJson` quand c’est possible.
 */
export function mergeThalieSessionBaselinesIntoSessions(
  sessions: DraftSessionItem[] | null,
  baselines: ThalieSessionBaseline[]
): DraftSessionItem[] | null {
  if (baselines.length === 0) return sessions;

  const priceEur = (cents: number | null): number | null => {
    if (cents == null || !Number.isFinite(cents) || cents < 0) return null;
    return Math.round(cents) / 100;
  };

  const parseBaselineDates = (label: string): { startDate: string | null; endDate: string | null } => {
    const normalized = normalizeWhitespace(label);
    const sameMonth = normalized.match(
      /\bdu\s+(\d{1,2})\s+(?:au|a|à)\s+(\d{1,2})\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d{4})\b/i
    );
    if (sameMonth) {
      const dayStart = Number(sameMonth[1]);
      const dayEnd = Number(sameMonth[2]);
      const month = MONTHS[simplifyForMatch(sameMonth[3])];
      const year = Number(sameMonth[4]);
      return {
        startDate: month ? toIsoDate(dayStart, month, year) : null,
        endDate: month ? toIsoDate(dayEnd, month, year) : null
      };
    }

    const crossMonth = normalized.match(
      /\bdu\s+(\d{1,2})\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(?:au|a|à)\s+(\d{1,2})\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)\s+(\d{4})\b/i
    );
    if (crossMonth) {
      const year = Number(crossMonth[5]);
      return {
        startDate: toIsoDate(Number(crossMonth[1]), MONTHS[simplifyForMatch(crossMonth[2])] ?? 0, year),
        endDate: toIsoDate(Number(crossMonth[3]), MONTHS[simplifyForMatch(crossMonth[4])] ?? 0, year)
      };
    }

    return { startDate: null, endDate: null };
  };

  const existingSessions = sessions ?? [];
  const matchedSessionIndexes = new Set<number>();

  const findMatchingSession = (baseline: ThalieSessionBaseline): { index: number; session: DraftSessionItem } | null => {
    const baselineKey = simplifyForMatch(baseline.date_label);
    const baselineDates = parseBaselineDates(baseline.date_label);

    for (let index = 0; index < existingSessions.length; index += 1) {
      if (matchedSessionIndexes.has(index)) continue;
      const session = existingSessions[index];
      const sessionKey = simplifyForMatch(session.label);
      if (baselineKey && sessionKey && (baselineKey.includes(sessionKey) || sessionKey.includes(baselineKey))) {
        matchedSessionIndexes.add(index);
        return { index, session };
      }
      if (
        baselineDates.startDate &&
        baselineDates.endDate &&
        session.start_date === baselineDates.startDate &&
        session.end_date === baselineDates.endDate
      ) {
        matchedSessionIndexes.add(index);
        return { index, session };
      }
    }

    return null;
  };

  if (!sessions || sessions.length === 0) {
    return baselines.map((b) => {
      const dates = parseBaselineDates(b.date_label);
      return {
        label: b.date_label,
        start_date: dates.startDate,
        end_date: dates.endDate,
        price: priceEur(b.baseline_total_cents),
        availability: 'unknown'
      };
    });
  }

  const mergedSessions = existingSessions.map((session) => ({ ...session }));
  const extraSessions: DraftSessionItem[] = [];

  for (const baseline of baselines) {
    const matched = findMatchingSession(baseline);
    const baselineDates = parseBaselineDates(baseline.date_label);
    const p = priceEur(baseline.baseline_total_cents);
    if (matched) {
      mergedSessions[matched.index] = {
        ...matched.session,
        price: p ?? matched.session.price ?? null,
        availability: matched.session.availability ?? 'unknown'
      };
      continue;
    }

    extraSessions.push({
      label: baseline.date_label,
      start_date: baselineDates.startDate,
      end_date: baselineDates.endDate,
      price: p,
      availability: 'unknown'
    });
  }

  return [...mergedSessions, ...extraSessions].sort((left, right) => {
    const leftKey = left.start_date ?? left.end_date ?? left.label ?? '';
    const rightKey = right.start_date ?? right.end_date ?? right.label ?? '';
    return leftKey.localeCompare(rightKey, 'fr');
  });
}

const INSURANCE_ANNULATION_LINE_KEYS = ['annulation', 'annuler', 'remboursement'];

/**
 * Montant fixe d’assurance annulation souvent inclus dans le total affiché sur la fiche réservation
 * (à retrancher du prix par ville pour obtenir le supplément transport seul).
 */
export function pickImportedCancellationInsuranceCents(
  data: Pick<ExtractedStayData, 'rawText'> & { htmlExcerpt?: string | null }
): number | null {
  const chunks: string[] = [];
  if (data.rawText) chunks.push(data.rawText);
  if (data.htmlExcerpt) {
    chunks.push(data.htmlExcerpt.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '));
  }
  const merged = normalizeWhitespace(chunks.join('\n'));
  if (!merged) return null;

  const foundEuros: number[] = [];
  for (const fragment of merged.split(/[\n\r]+|<\/(?:p|div|li|tr)>/i)) {
    const line = normalizeWhitespace(fragment);
    if (!line) continue;
    const key = simplifyForMatch(line);
    if (!key) continue;
    const hasAnnul = INSURANCE_ANNULATION_LINE_KEYS.some((w) => key.includes(simplifyForMatch(w)));
    const hasAssur =
      key.includes('assurance') ||
      key.includes('insurance') ||
      key.includes('garantie') ||
      key.includes('mutuelle');
    if (!hasAnnul || !hasAssur) continue;
    const amount = findPriceInText(line);
    if (amount === null) continue;
    if (amount < 3 || amount > 400) continue;
    foundEuros.push(amount);
  }

  if (foundEuros.length === 0) return null;
  const maxEur = Math.max(...foundEuros);
  return Math.round(maxEur * 100);
}

function buildTransportDebugRows(
  pages: ParsedTransportPage[],
  base: { basePriceCents: number | null; sourceUrl: string | null; reason: string }
): DraftTransportPriceDebug[] {
  return pages.map((page) => {
    const { departureCity, returnCity, fallbackReason } = normalizeTransportPair(page);
    const hasCity = Boolean(departureCity || returnCity);
    const pagePriceCents = page.currentPriceCents;

    let amountCents: number | null = null;
    let pricingMethod: DraftTransportPriceDebug['pricing_method'] = 'unresolved';
    let reason = fallbackReason ? `ok-${fallbackReason}` : 'ok';

    if (!hasCity) {
      reason = 'excluded-missing-transport-city';
    } else if (typeof pagePriceCents !== 'number') {
      reason = 'excluded-missing-page-price';
    } else if (typeof base.basePriceCents === 'number') {
      const delta = pagePriceCents - base.basePriceCents;
      if (delta < 0) {
        reason = `excluded-negative-delta:${delta}`;
      } else {
        amountCents = delta;
        pricingMethod = 'delta_from_base';
      }
    } else {
      pricingMethod = 'absolute_price';
      reason = `excluded-${base.reason}`;
    }

    const confidence = toTransportConfidence(pricingMethod, amountCents, departureCity, returnCity);

    return {
      variant_url: page.sourceUrl,
      departure_city: departureCity,
      return_city: returnCity,
      page_price_cents: pagePriceCents,
      base_price_cents: base.basePriceCents,
      amount_cents: amountCents,
      pricing_method: pricingMethod,
      confidence,
      reason,
      departure_label_raw: page.selectedOutboundRaw,
      return_label_raw: page.selectedReturnRaw
    };
  });
}

function debugToTransportVariant(row: DraftTransportPriceDebug): DraftTransportVariant | null {
  const departureCity = normalizeTransportCityLabel(row.departure_city);
  const returnCity = normalizeTransportCityLabel(row.return_city);
  if (!departureCity && !returnCity) return null;

  const safeDeparture = departureCity ?? returnCity ?? '';
  const safeReturn = returnCity ?? departureCity ?? '';

  return {
    departure_city: safeDeparture,
    return_city: safeReturn,
    amount_cents: row.amount_cents,
    currency: 'EUR',
    source_url: row.variant_url,
    departure_label_raw: row.departure_label_raw ?? null,
    return_label_raw: row.return_label_raw ?? null,
    page_price_cents: row.page_price_cents,
    base_price_cents: row.base_price_cents,
    pricing_method: row.pricing_method,
    confidence: row.confidence,
    reason: row.reason
  };
}

function transportVariantScore(row: DraftTransportVariant): number {
  let score = 0;
  if (typeof row.amount_cents === 'number') score += 100;
  if (row.confidence === 'high') score += 30;
  if (row.confidence === 'medium') score += 20;
  if (row.confidence === 'low') score += 10;
  if (row.reason?.includes('symmetry-fallback')) score -= 1;
  return score;
}

function dedupeTransportVariants(rows: DraftTransportVariant[]): DraftTransportVariant[] {
  const map = new Map<string, DraftTransportVariant>();

  for (const row of rows) {
    const departure = normalizeTransportCityLabel(row.departure_city);
    const returning = normalizeTransportCityLabel(row.return_city);
    if (!departure && !returning) continue;

    const departureCity = departure ?? returning ?? '';
    const returnCity = returning ?? departure ?? '';
    const key = `${simplifyForMatch(departureCity)}|${simplifyForMatch(returnCity)}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...row,
        departure_city: departureCity,
        return_city: returnCity
      });
      continue;
    }

    if (transportVariantScore(row) > transportVariantScore(existing)) {
      map.set(key, {
        ...row,
        departure_city: departureCity,
        return_city: returnCity
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    `${a.departure_city}|${a.return_city}`.localeCompare(`${b.departure_city}|${b.return_city}`, 'fr')
  );
}

export async function extractTransportVariants(
  html: string,
  sourceUrl: string
): Promise<ExtractTransportVariantsResult> {
  const ceslDurationJson = extractCeslDurationJson(html);
  if (ceslDurationJson) {
    const byCity = new Map<string, DraftTransportVariant>();
    const transportPriceDebug: DraftTransportPriceDebug[] = [];

    for (const durationEntries of Object.values(ceslDurationJson)) {
      if (!durationEntries || typeof durationEntries !== 'object') continue;
      for (const entry of Object.values(durationEntries)) {
        const citiesRaw = normalizeWhitespace(entry?.villes ?? '');
        if (!citiesRaw) continue;

        for (const chunk of citiesRaw.split(',')) {
          const normalizedChunk = normalizeWhitespace(chunk);
          if (!normalizedChunk) continue;
          const separatorIndex = normalizedChunk.lastIndexOf(':');
          if (separatorIndex <= 0) continue;

          const city = normalizeTransportCityLabel(normalizedChunk.slice(0, separatorIndex));
          const amountEur = parseFrenchAmount(normalizedChunk.slice(separatorIndex + 1), 0, 20_000);
          if (!city || amountEur === null) continue;

          const amountCents = amountEur * 100;
          transportPriceDebug.push({
            variant_url: sourceUrl,
            departure_city: city,
            return_city: city,
            page_price_cents: amountCents,
            base_price_cents: null,
            amount_cents: amountCents,
            pricing_method: 'absolute_price',
            confidence: 'high',
            reason: `cesl-duration-json:${entry?.dates ?? 'unknown'}`
          });

          const key = simplifyForMatch(city);
          const next: DraftTransportVariant = {
            departure_city: city,
            return_city: city,
            amount_cents: amountCents,
            currency: 'EUR',
            source_url: sourceUrl,
            page_price_cents: amountCents,
            base_price_cents: null,
            pricing_method: 'absolute_price',
            confidence: 'high',
            reason: `cesl-duration-json:${entry?.dates ?? 'unknown'}`
          };
          const existing = byCity.get(key);
          if (!existing || amountCents > (existing.amount_cents ?? -1)) {
            byCity.set(key, next);
          }
        }
      }
    }

    return {
      transportVariants: Array.from(byCity.values()).sort((a, b) =>
        a.departure_city.localeCompare(b.departure_city, 'fr')
      ),
      transportPriceDebug
    };
  }

  const cache = new Map<string, FetchedHtml | null>();
  const visitedUrls = new Set<string>();
  const queuedUrls = new Set<string>();
  const queue: string[] = [];
  const pagesByUrl = new Map<string, ParsedTransportPage>();
  let fetchCount = 0;

  function enqueueUrl(url: string | null | undefined) {
    const normalizedUrl = normalizeWhitespace(url ?? '');
    if (!normalizedUrl) return;
    if (visitedUrls.has(normalizedUrl) || queuedUrls.has(normalizedUrl)) return;
    queuedUrls.add(normalizedUrl);
    queue.push(normalizedUrl);
  }

  async function getVariantPage(url: string): Promise<FetchedHtml | null> {
    const normalizedUrl = normalizeWhitespace(url);
    if (!normalizedUrl) return null;
    if (cache.has(normalizedUrl)) return cache.get(normalizedUrl) ?? null;
    if (fetchCount >= MAX_TRANSPORT_VARIANT_FETCHES) {
      console.warn('[transport-scraping] limite de fetch atteinte', {
        maxFetches: MAX_TRANSPORT_VARIANT_FETCHES,
        blockedUrl: normalizedUrl
      });
      cache.set(normalizedUrl, null);
      return null;
    }

    fetchCount += 1;
    try {
      const fetched = await fetchHtml(normalizedUrl);
      cache.set(normalizedUrl, fetched);
      if (!cache.has(fetched.finalUrl)) {
        cache.set(fetched.finalUrl, fetched);
      }
      return fetched;
    } catch {
      cache.set(normalizedUrl, null);
      return null;
    }
  }

  const initialPage = parseTransportPage(html, sourceUrl);
  pagesByUrl.set(initialPage.sourceUrl, initialPage);

  const initialOutboundWithUrl = (initialPage.outboundSelect?.options ?? []).filter((option) =>
    Boolean(option.url)
  );
  const initialReturnWithUrl = (initialPage.returnSelect?.options ?? []).filter((option) =>
    Boolean(option.url)
  );
  for (const url of initialPage.variantUrls) {
    enqueueUrl(url);
  }

  while (queue.length > 0) {
    const nextUrl = queue.shift() ?? '';
    queuedUrls.delete(nextUrl);
    if (!nextUrl || visitedUrls.has(nextUrl)) continue;
    visitedUrls.add(nextUrl);

    const fetched = await getVariantPage(nextUrl);
    if (!fetched) {
      console.warn('[transport-scraping] variante ignorée (fetch impossible)', {
        requestedUrl: nextUrl
      });
      continue;
    }

    const parsed = parseTransportPage(fetched.html, fetched.finalUrl);
    pagesByUrl.set(parsed.sourceUrl, parsed);

    for (const discoveredUrl of parsed.variantUrls) {
      enqueueUrl(discoveredUrl);
    }
  }

  const pages = Array.from(pagesByUrl.values());
  const base = resolveBaseTransportPrice(pages);
  const transportPriceDebug = buildTransportDebugRows(pages, base).sort((left, right) =>
    left.variant_url.localeCompare(right.variant_url, 'fr')
  );

  const rawVariants = transportPriceDebug
    .map((row) => debugToTransportVariant(row))
    .filter((row): row is DraftTransportVariant => Boolean(row));
  const transportVariants = dedupeTransportVariants(rawVariants);

  console.info('[transport-scraping] résumé', {
    sourceUrl,
    outboundOptionsDetected: initialPage.outboundOptionCount,
    returnOptionsDetected: initialPage.returnOptionCount,
    outboundOptionsWithVariantUrl: initialOutboundWithUrl.length,
    returnOptionsWithVariantUrl: initialReturnWithUrl.length,
    variantsFetched: fetchCount,
    parsedVariantPages: pages.length,
    basePriceCents: base.basePriceCents,
    baseSourceUrl: base.sourceUrl,
    baseReason: base.reason,
    usableTransportVariants: transportVariants.filter(
      (row) => typeof row.amount_cents === 'number'
    ).length
  });

  for (const row of transportPriceDebug) {
    console.info('[transport-scraping] variante', {
      variantUrl: row.variant_url,
      departureCity: row.departure_city,
      returnCity: row.return_city,
      pagePriceCents: row.page_price_cents,
      basePriceCents: row.base_price_cents,
      amountCents: row.amount_cents,
      pricingMethod: row.pricing_method,
      confidence: row.confidence,
      reason: row.reason
    });

    if (typeof row.amount_cents !== 'number') {
      console.warn('[transport-scraping] variante exclue (pas de montant fiable)', {
        variantUrl: row.variant_url,
        reason: row.reason
      });
    }
  }

  return {
    transportVariants,
    transportPriceDebug
  };
}

function extractAccommodation(sections: SectionBlock[]): DraftAccommodation | null {
  const section = findSection(sections, [
    'hebergement',
    'hébergement',
    'logement',
    'residence',
    'résidence',
    'camping',
    'hebergement et restauration',
    'hébergement et restauration',
    'votre hebergement',
    'votre hébergement',
    'cadre de vie',
    'lieu de vie'
  ]);
  if (!section) return null;

  const description = normalizeParagraph(section.text);
  if (!description) return null;

  return {
    title: section.heading,
    description
  };
}

export async function fetchHtml(sourceUrl: string): Promise<FetchedHtml> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; ResacoloImportBot/1.0; +https://resacolo.com)',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`Le fetch a échoué (HTTP ${response.status}).`);
    }

    const htmlBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type');
    const headerCharset = parseCharsetFromContentType(contentType);
    const metaCharset = parseCharsetFromMeta(htmlBuffer);
    const html = decodeHtmlBuffer(htmlBuffer, headerCharset, metaCharset);

    return {
      html,
      finalUrl: response.url || sourceUrl,
      fetchedAt: new Date().toISOString(),
      contentType,
      status: response.status
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Impossible de récupérer la page source.';
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
}

export function extractStayData(html: string, sourceUrl: string): ExtractedStayData {
  const $ = load(html);
  const { title, h1, titleTag } = extractPrimaryTitle($);
  const { description, metaDescription } = extractDescription($);
  const sections = extractSections($);
  const visibleText = extractVisibleText($);
  const jsonLdBlocks = extractJsonLdBlocks($);
  const addressHints = extractAddressHints(jsonLdBlocks);
  const scanText = normalizeWhitespace([title, description, visibleText].filter(Boolean).join(' '));

  const ageRange = parseAgeRange(scanText);
  const priceFrom =
    extractCeiApartirStrongPriceDom(html) ??
    extractCeslStayPublicPriceFromTarif1Dom(html) ??
    extractCeslSelectedPeriodPublicFromJson(html) ??
    (extractCeslDurationJson(html) ? null : parsePrice(scanText, jsonLdBlocks));
  const durationDays = parseDuration(scanText);
  const images = extractImages($, sourceUrl);
  const cityFromTitleOrDescription = extractCityFromTitleOrDescription(title, description);
  const activities = extractActivities($);

  const regionText = detectRegion(scanText, addressHints);
  const locationFromHints = extractLocationFromHints(addressHints, regionText);
  const locationFromText = extractLocationFromText(visibleText, regionText);
  const locationFromCity =
    cityFromTitleOrDescription &&
    simplifyForMatch(cityFromTitleOrDescription) !== simplifyForMatch(regionText ?? '')
      ? cityFromTitleOrDescription
      : null;
  const locationText = locationFromHints || locationFromText || locationFromCity || null;

  const programSection = findSection(sections, ['programme', 'au programme', 'deroulement']);
  const activitiesSection = findSection(sections, ['activite', 'activites', 'loisirs', 'animation']);
  const supervisionSection = findSection(sections, ['encadrement', 'equipe pedagogique', 'animateur', 'direction']);
  const requiredDocumentsSection = findSection(
    sections,
    ['documents', 'pieces a fournir', 'formalites', 'inscription']
  );
  const transportSection = findSection(sections, ['transport', 'acheminement', 'depart', 'retour']);
  const summary = extractSummary($);

  const activitiesText =
    normalizeParagraph(activitiesSection?.text ?? null) ??
    joinActivities(activities);

  const programText = normalizeParagraph(programSection?.text ?? null);
  const supervisionText = normalizeParagraph(supervisionSection?.text ?? null);
  const requiredDocumentsText = normalizeParagraph(requiredDocumentsSection?.text ?? null);
  const transportText = normalizeParagraph(transportSection?.text ?? null);
  const transportMode = detectTransportMode(transportText, visibleText);
  const sessionsJson = extractSessions($, visibleText, html);
  const accommodationsJson = extractAccommodation(sections);

  return {
    title,
    description,
    summary,
    city: cityFromTitleOrDescription,
    locationText,
    regionText,
    ageMin: ageRange?.ageMin ?? null,
    ageMax: ageRange?.ageMax ?? null,
    priceFrom,
    durationDays,
    activities,
    activitiesText,
    programText,
    supervisionText,
    requiredDocumentsText,
    transportText,
    transportMode,
    images,
    sessionsJson,
    accommodationsJson,
    rawText: truncate(visibleText, MAX_RAW_TEXT_LENGTH) || null,
    technical: {
      h1,
      titleTag,
      metaDescription,
      sectionHeadings: sections.map((section) => section.heading)
    }
  };
}
