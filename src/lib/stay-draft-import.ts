import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import iconv from 'iconv-lite';
import { STAY_REGION_OPTIONS } from '@/lib/stay-regions';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_TEXT_SCAN_LENGTH = 140_000;
const MAX_RAW_TEXT_LENGTH = 35_000;
const MAX_IMAGES = 8;
const MAX_ACTIVITIES = 12;
const MAX_SECTION_TEXT_LENGTH = 8_000;
const MAX_SESSION_SNIPPET_LENGTH = 400;
const MAX_SUMMARY_BLOCK_LENGTH = 2_200;
const MAX_TRANSPORT_VARIANT_FETCHES = 80;

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

export type DraftSessionItem = {
  label: string;
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  availability: 'full' | 'available' | 'limited' | 'waitlist' | null;
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
  pricing_method?: 'delta_from_base' | 'absolute_price' | 'unresolved';
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
  pricing_method: 'delta_from_base' | 'absolute_price' | 'unresolved';
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

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(text)) !== null) {
      const left = Number(match[1]);
      const right = Number(match[2]);
      if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
      const ageMin = Math.min(left, right);
      const ageMax = Math.max(left, right);
      if (ageMin < 3 || ageMax > 25) continue;
      candidates.push({ ageMin, ageMax, index: match.index });
    }
  }

  if (candidates.length === 0) return null;
  const preferred = candidates
    .filter((candidate) => candidate.ageMax <= 18)
    .sort((a, b) => a.index - b.index)[0];
  if (preferred) return { ageMin: preferred.ageMin, ageMax: preferred.ageMax };

  const fallback = candidates.sort((a, b) => a.index - b.index)[0];
  return { ageMin: fallback.ageMin, ageMax: fallback.ageMax };
}

function parseFrenchAmount(raw: string): number | null {
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
  if (rounded < 30 || rounded > 20_000) return null;
  return rounded;
}

function findPriceInText(text: string): number | null {
  const fromMatch = text.match(/\b(?:à\s+partir\s+de|dès)\s*([0-9][0-9\s.,]*)\s*(?:€|euros?)/i);
  if (fromMatch?.[1]) {
    const amount = parseFrenchAmount(fromMatch[1]);
    if (amount !== null) return amount;
  }

  const genericPattern = /\b([0-9][0-9\s.,]{1,})\s*(?:€|euros?)/gi;
  let match: RegExpExecArray | null = null;
  while ((match = genericPattern.exec(text)) !== null) {
    const amount = parseFrenchAmount(match[1]);
    if (amount !== null) return amount;
  }

  return null;
}

function findPriceInJsonLd(blocks: unknown[]): number | null {
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
      if (rounded >= 30 && rounded <= 20_000) return rounded;
    } else if (typeof priceRaw === 'string') {
      const parsed = parseFrenchAmount(priceRaw);
      if (parsed !== null) return parsed;
    }

    for (const value of Object.values(record)) {
      stack.push(value);
    }
  }

  return null;
}

function parsePrice(text: string, jsonLdBlocks: unknown[]): number | null {
  const textPrice = findPriceInText(text);
  if (textPrice !== null) return textPrice;
  return findPriceInJsonLd(jsonLdBlocks);
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
  const normalizedSource = source.toLowerCase();
  const normalizedAlt = alt.toLowerCase();
  if (normalizedSource.startsWith('data:')) return true;
  if (normalizedSource.includes('.svg')) return true;

  const decorativeTokens = ['logo', 'icon', 'icone', 'sprite', 'avatar', 'pict'];
  return decorativeTokens.some(
    (token) => normalizedSource.includes(token) || normalizedAlt.includes(token)
  );
}

function pickImageCandidate($: CheerioAPI, element: AnyNode): string {
  const image = $(element);
  const src = image.attr('src') ?? image.attr('data-src') ?? '';
  if (src) return src;

  const srcset = image.attr('srcset') ?? image.attr('data-srcset') ?? '';
  if (!srcset) return '';
  const firstCandidate = srcset
    .split(',')
    .map((chunk) => chunk.trim().split(' ')[0])
    .find(Boolean);
  return firstCandidate ?? '';
}

function extractImages($: CheerioAPI, sourceUrl: string): string[] {
  const candidates: string[] = [];
  const ogImage = $('meta[property="og:image"]').attr('content');
  const twitterImage = $('meta[name="twitter:image"]').attr('content');

  if (ogImage) candidates.push(ogImage);
  if (twitterImage) candidates.push(twitterImage);

  $('main img, article img, .content img, img').each((_, element) => {
    if (candidates.length >= MAX_IMAGES * 3) return false;
    const src = pickImageCandidate($, element);
    if (!src) return;
    const alt = normalizeWhitespace($(element).attr('alt') ?? '');
    if (shouldIgnoreImage(src, alt)) return;
    candidates.push(src);
  });

  const absolute = candidates
    .map((candidate) => toAbsoluteUrl(candidate, sourceUrl))
    .filter((url): url is string => Boolean(url));

  return unique(absolute).slice(0, MAX_IMAGES);
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

function detectSessionAvailability(snippet: string): DraftSessionItem['availability'] {
  const normalized = simplifyForMatch(snippet);
  if (!normalized) return null;
  if (/\bcomplet|complete|sold out\b/.test(normalized)) return 'full';
  if (/\bliste d attente|attente\b/.test(normalized)) return 'waitlist';
  if (/\bderniere?s?\s+place|places?\s+restantes?|plus que\b/.test(normalized)) return 'limited';
  if (/\bdisponible|disponibilite|inscription ouverte|ouvert\b/.test(normalized)) return 'available';
  return null;
}

function extractSessions(visibleText: string): DraftSessionItem[] | null {
  const sessions: DraftSessionItem[] = [];

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
      price: findPriceInText(snippet),
      availability: detectSessionAvailability(snippet)
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
      price: findPriceInText(snippet),
      availability: detectSessionAvailability(snippet)
    });
  }

  const deduped = unique(
    sessions.map((session) => JSON.stringify(session))
  ).map((serialized) => JSON.parse(serialized) as DraftSessionItem);

  return deduped.length > 0 ? deduped : null;
}

function detectTransportMode(transportText: string | null, visibleText: string): string | null {
  const source = simplifyForMatch([transportText, visibleText].filter(Boolean).join(' '));
  if (!source) return null;

  const modes = new Set<string>();
  if (/\btrain\b/.test(source)) modes.add('train');
  if (/\bavion\b/.test(source)) modes.add('avion');
  if (/\bbus\b/.test(source)) modes.add('bus');
  if (/\bcar\b/.test(source)) modes.add('car');
  if (/\b(depose|deposee|depose sur|depose centre|rendez vous sur place|sur place)\b/.test(source)) {
    modes.add('dépose centre');
  }

  return modes.size === 1 ? Array.from(modes)[0] : null;
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
  'tous'
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
  const parentText = normalizeWhitespace(node.closest('td,th,tr,div,fieldset,section,form').first().text());

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
  const selectors = [
    '[itemprop="price"]',
    '[class*="prix"]',
    '[id*="prix"]',
    '[class*="price"]',
    '[id*="price"]',
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
      const price = findPriceInText(content);
      if (price !== null) return price;
    }
  }

  return findPriceInText(visibleText);
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

function isTransportBaseReference(value: string | null | undefined): boolean {
  const key = simplifyForMatch(value ?? '');
  if (!key) return false;
  return TRANSPORT_BASE_REFERENCE_KEYS.some((candidate) =>
    key.includes(simplifyForMatch(candidate))
  );
}

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
  if (pricingMethod === 'delta_from_base' && amountCents !== null) {
    if (departureCity && returnCity) return 'high';
    return 'medium';
  }
  return 'low';
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
  const section = findSection(sections, ['hebergement', 'logement', 'residence', 'camping']);
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
  const priceFrom = parsePrice(scanText, jsonLdBlocks);
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
  const sessionsJson = extractSessions(visibleText);
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
