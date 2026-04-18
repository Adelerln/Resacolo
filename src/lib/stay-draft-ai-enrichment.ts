import { load } from 'cheerio';
import { z } from 'zod';
import { normalizeStayDraftCategories, STAY_CATEGORY_LABELS } from '@/lib/stay-categories';
import {
  expandDraftAges,
  inferTransportLogisticsModeFromSignals,
  MAX_STAY_SUMMARY_LENGTH,
  normalizeStaySummary,
  normalizeStayTransportLogisticsMode
} from '@/lib/stay-draft-content';
import {
  normalizeAccommodationTypeToken,
  normalizeLocationMode
} from '@/lib/stay-draft-accommodation-import';
import { isPartnerTariffExtraOptionLabel } from '@/lib/stay-draft-extra-options-split';
import { createOpenAIClient } from '@/lib/openai';
import type { Database, Json } from '@/types/supabase';

type StayDraftRow = Database['public']['Tables']['stay_drafts']['Row'];
type AiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_ENRICH_MODEL ?? 'gpt-4o-mini';
const MAX_MAIN_TEXT_LENGTH = 12_000;
const MAX_HTML_EXCERPT_LENGTH = 6_000;
const MAX_AI_LOG_PREVIEW_LENGTH = 1_000;
export const STAY_DRAFT_AI_PROMPT_VERSION = 'stay-draft-enrich-v8';

const nullableTextSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  return String(value);
}, z.string().nullable());

const nullableNumberSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/\s+/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}, z.number().nullable());

const extraOptionSchema = z.object({
  label: z.string().trim().min(1),
  price: nullableNumberSchema,
  currency: nullableTextSchema,
  description: nullableTextSchema
}).strict();

const transportOptionSchema = z.object({
  label: z.string().trim().min(1),
  price: nullableNumberSchema,
  currency: nullableTextSchema,
  description: nullableTextSchema
}).strict();

const accommodationsJsonInnerSchema = z
  .object({
    title: nullableTextSchema,
    description: nullableTextSchema,
    accommodation_types: z.array(z.string().trim()).max(5).optional(),
    accommodation_type: nullableTextSchema,
    location_mode: nullableTextSchema,
    location_city: nullableTextSchema,
    location_department_code: nullableTextSchema,
    location_country: nullableTextSchema,
    itinerant_zone: nullableTextSchema,
    center_latitude: nullableNumberSchema,
    center_longitude: nullableNumberSchema,
    center_geocoding_query: nullableTextSchema,
    bed_info: nullableTextSchema,
    bathroom_info: nullableTextSchema,
    catering_info: nullableTextSchema,
    pmr_accessible: z.boolean().nullable().optional()
  })
  .strip();

const sessionSchema = z.object({
  label: nullableTextSchema,
  start_date: nullableTextSchema,
  end_date: nullableTextSchema,
  price: nullableNumberSchema,
  currency: nullableTextSchema,
  availability: z.enum(['available', 'full', 'unknown']).nullable()
}).strict();

const aiExtractedSchema = z.object({
  summary: nullableTextSchema,
  description: nullableTextSchema,
  location_text: nullableTextSchema,
  region_text: nullableTextSchema,
  program_text: nullableTextSchema,
  supervision_text: nullableTextSchema,
  transport_text: nullableTextSchema,
  transport_mode: nullableTextSchema,
  categories: z.array(z.string().trim().min(1)),
  ages: z.array(z.number().int().nonnegative()),
  sessions_json: z.array(sessionSchema),
  extra_options_json: z.array(extraOptionSchema),
  transport_options_json: z.array(transportOptionSchema),
  accommodations_json: accommodationsJsonInnerSchema.nullable()
}).strict();

const AI_EXTRACTED_EXPECTED_ROOT_KEYS = new Set([
  'summary',
  'description',
  'location_text',
  'region_text',
  'program_text',
  'supervision_text',
  'transport_text',
  'transport_mode',
  'categories',
  'ages',
  'sessions_json',
  'extra_options_json',
  'transport_options_json',
  'accommodations_json'
]);

const STAY_CATEGORY_ALLOWED_LIST_FOR_PROMPT = STAY_CATEGORY_LABELS.map((label) => `- ${label}`).join(
  '\n'
);

export type StayDraftAiExtracted = z.infer<typeof aiExtractedSchema>;

export class StayDraftAiEnrichmentError extends Error {
  readonly rawResponse: string | null;
  readonly model: string | null;
  readonly promptVersion: string | null;
  readonly usage: AiUsage | null;

  constructor(
    message: string,
    options?: {
      rawResponse?: string | null;
      model?: string | null;
      promptVersion?: string | null;
      usage?: AiUsage | null;
    }
  ) {
    super(message);
    this.name = 'StayDraftAiEnrichmentError';
    this.rawResponse = options?.rawResponse ?? null;
    this.model = options?.model ?? null;
    this.promptVersion = options?.promptVersion ?? null;
    this.usage = options?.usage ?? null;
  }
}

export type StayDraftAiEnrichmentResult = {
  extracted: StayDraftAiExtracted;
  model: string;
  promptVersion: string;
  rawResponse: string;
  usage: AiUsage | null;
};

const SYSTEM_PROMPT = `
Tu es un extracteur de données pour fiches de colonies de vacances.
Tu dois renvoyer uniquement un JSON strict conforme au schéma demandé.

Règles impératives :
- N'invente jamais d'information.
- Si une information est absente, incertaine, ambiguë ou contradictoire : renvoie null (ou tableau vide selon le type).
- Priorise la fiabilité sur la complétude.
- Ne renvoie aucune prose, aucun markdown, aucun commentaire : uniquement le JSON.
- La racine du JSON doit être un objet unique, jamais un tableau.
- Respecte strictement les clés attendues, sans en ajouter d'autres.
- Les prix complexes doivent rester dans sessions_json / extra_options_json / transport_options_json.
- N'inclus jamais dans extra_options_json les lignes « tarif partenaire » / tarif collectivités (ex. CESL) : ce cas est couvert par la remise partenaire sur la fiche, pas comme option supplémentaire payante.
- Pour availability dans sessions_json, utilise seulement : "available", "full", "unknown" ou null.
- "summary" doit être une phrase courte de ${MAX_STAY_SUMMARY_LENGTH} caractères maximum (environ 2 lignes dans une carte). Pas de ponctuation de liste, pas de saut de ligne.
- "location_text" doit contenir uniquement la ville principale (et le pays si hors de France) : 50 caractères maximum. Exemples : "Avignon, France", "Saint-Jean-de-Luz", "Saulieu, Bourgogne", "Londres, Royaume-Uni".
- Tous les textes doivent être rédigés dans un français naturel et relu, jamais comme une suite de mots-clés SEO.
`.trim();

const MAIN_TEXT_NOISE_KEYS = [
  'cookies',
  'mentions legales',
  'cgv',
  'conditions generales',
  'panier',
  'mon compte',
  'connexion',
  'se connecter',
  'newsletter',
  'menu',
  'navigation',
  'footer',
  'header',
  'facebook',
  'instagram',
  'linkedin',
  'whatsapp',
  'partager'
];

function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeMultilineText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/\u00A0/g, ' ')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join('\n');
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

function cleanMainTextForAI(value: string | null | undefined): string | null {
  const normalized = normalizeMultilineText(value);
  if (!normalized) return null;

  const lines = normalized
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 2)
    .filter((line) => {
      const key = simplifyForMatch(line);
      if (!key) return false;
      return !MAIN_TEXT_NOISE_KEYS.some((noise) => key.includes(noise));
    });

  if (lines.length === 0) return null;
  return truncate(lines.join('\n'), MAX_MAIN_TEXT_LENGTH);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function parseRawPayload(rawPayload: Json | null): Record<string, unknown> {
  const asRecord = asObject(rawPayload);
  if (asRecord) return asRecord;

  if (typeof rawPayload === 'string') {
    try {
      const parsed = JSON.parse(rawPayload) as unknown;
      const parsedRecord = asObject(parsed);
      return parsedRecord ?? {};
    } catch {
      return {};
    }
  }

  return {};
}

function extractReadableTextFromHtml(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|ul|ol|table)>/gi, '\n');
  const $ = load(`<div>${withBreaks}</div>`);
  return normalizeMultilineText($('div').text());
}

function extractMainTextFromHtml(html: string): string | null {
  const $ = load(html);
  $('script,style,noscript,svg').remove();

  const selectors = [
    '[itemprop="description"]',
    'main article',
    'main',
    'article',
    'body'
  ];

  let bestText = '';
  for (const selector of selectors) {
    $(selector).each((_, node) => {
      const text = normalizeMultilineText($(node).text());
      if (text.length > bestText.length) {
        bestText = text;
      }
    });
    if (bestText.length > 3_000) break;
  }

  if (!bestText) return null;
  return truncate(bestText, MAX_MAIN_TEXT_LENGTH);
}

function extractHtmlExcerpt(html: string): string | null {
  const $ = load(html);
  const itemProp = $('[itemprop="description"]').first();
  const selected = itemProp.length ? itemProp : $('main article, main, article').first();
  if (!selected.length) return null;
  const excerpt = $.html(selected) ?? '';
  return excerpt ? truncate(excerpt, MAX_HTML_EXCERPT_LENGTH) : null;
}

function stripCodeFences(value: string): string {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function valueType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function previewValue(value: unknown): string {
  try {
    if (typeof value === 'string') {
      return value.slice(0, MAX_AI_LOG_PREVIEW_LENGTH);
    }
    const serialized = JSON.stringify(value);
    return serialized.slice(0, MAX_AI_LOG_PREVIEW_LENGTH);
  } catch {
    return String(value).slice(0, MAX_AI_LOG_PREVIEW_LENGTH);
  }
}

function normalizeParsedRoot(parsed: unknown, stage = 'root'): unknown {
  if (Array.isArray(parsed)) {
    if (parsed.length === 1) {
      const firstItem = parsed[0];
      if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
        return firstItem;
      }
      throw new Error(
        `Réponse OpenAI invalide (${stage}) : le tableau racine contient un élément non objet.`
      );
    }
    throw new Error(
      `Réponse OpenAI invalide (${stage}) : le JSON racine est un tableau (${parsed.length} éléments). Un objet unique est attendu.`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Réponse OpenAI invalide (${stage}) : la racine JSON doit être un objet.`);
  }

  return parsed;
}

function hasExpectedRootKey(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).some((key) => AI_EXTRACTED_EXPECTED_ROOT_KEYS.has(key));
}

function unwrapIntermediaryPayload(value: unknown): { value: unknown; source: string } {
  const envelopeKeys = ['data', 'result', 'output', 'response', 'payload', 'ai_extracted'];

  let current: unknown = value;
  let source = 'direct';

  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return { value: current, source };
    }

    if (hasExpectedRootKey(current)) {
      return { value: current, source };
    }

    const record = current as Record<string, unknown>;
    let unwrappedByEnvelope = false;
    for (const key of envelopeKeys) {
      if (key in record) {
        current = record[key];
        source = `envelope:${key}`;
        unwrappedByEnvelope = true;
        break;
      }
    }
    if (unwrappedByEnvelope) continue;

    const keys = Object.keys(record);
    if (keys.length === 1) {
      const onlyKey = keys[0];
      const onlyValue = record[onlyKey];
      if (onlyValue && typeof onlyValue === 'object') {
        current = onlyValue;
        source = `single-key:${onlyKey}`;
        continue;
      }
    }

    return { value: current, source };
  }

  return { value: current, source };
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function extractImageUrls(value: unknown): string[] {
  const urls: string[] = [];
  const pushIfUrl = (candidate: unknown) => {
    if (typeof candidate !== 'string') return;
    const cleaned = normalizeWhitespace(candidate);
    if (!/^https?:\/\//i.test(cleaned)) return;
    urls.push(cleaned);
  };

  if (typeof value === 'string') {
    for (const token of value.split(/[,\n|]/)) {
      pushIfUrl(token);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      pushIfUrl(item);
      const asRecord = asObject(item);
      if (asRecord) {
        pushIfUrl(asRecord.url);
        pushIfUrl(asRecord.src);
      }
    }
  } else {
    const asRecord = asObject(value);
    if (asRecord) {
      pushIfUrl(asRecord.url);
      pushIfUrl(asRecord.src);
    }
  }

  return dedupeStrings(urls);
}

function dedupeNumbers(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value)))).sort((a, b) => a - b);
}

const SUMMARY_MAX_CHARS = 100;
const LOCATION_MAX_CHARS = 50;

function truncateSummary(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= SUMMARY_MAX_CHARS) return trimmed;
  const cut = trimmed.slice(0, SUMMARY_MAX_CHARS).trimEnd();
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > SUMMARY_MAX_CHARS * 0.7 ? cut.slice(0, lastSpace) : cut;
}

function truncateLocation(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= LOCATION_MAX_CHARS) return trimmed;
  const cut = trimmed.slice(0, LOCATION_MAX_CHARS).trimEnd();
  const lastComma = cut.lastIndexOf(',');
  if (lastComma > LOCATION_MAX_CHARS * 0.4) return cut.slice(0, lastComma).trimEnd();
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > LOCATION_MAX_CHARS * 0.5 ? cut.slice(0, lastSpace) : cut;
}

function normalizeAiExtracted(data: StayDraftAiExtracted): StayDraftAiExtracted {
  const normalizedCategories = normalizeStayDraftCategories(data.categories);
  return {
    ...data,
    summary: truncateSummary(data.summary),
    description: data.description,
    location_text: truncateLocation(data.location_text),
    categories: normalizedCategories.categories,
    ages: dedupeNumbers(data.ages),
    extra_options_json: data.extra_options_json.filter((row) => !isPartnerTariffExtraOptionLabel(row.label))
  };
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const normalized = normalizeWhitespace(value);
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  const output: string[] = [];
  for (const item of asArray(value)) {
    const text = toNullableString(item);
    if (text) output.push(text);
  }
  return dedupeStrings(output);
}

function toNumberArray(value: unknown): number[] {
  const output: number[] = [];
  for (const item of asArray(value)) {
    const numberValue = toNullableNumber(item);
    if (numberValue !== null) output.push(Math.round(numberValue));
  }
  return dedupeNumbers(output);
}

function normalizeAvailability(value: unknown): 'available' | 'full' | 'unknown' | null {
  const text = simplifyForMatch(toNullableString(value));
  if (!text) return null;
  if (/(full|complet|complete|sold out|epuise|épuisé)/i.test(text)) return 'full';
  if (/(available|disponible|open|ouvert|reste)/i.test(text)) return 'available';
  return 'unknown';
}

function normalizeSessionList(value: unknown): StayDraftAiExtracted['sessions_json'] {
  const output: StayDraftAiExtracted['sessions_json'] = [];
  for (const item of asArray(value)) {
    const record = asObject(item);
    if (!record) continue;
    output.push({
      label: toNullableString(record.label),
      start_date: toNullableString(record.start_date),
      end_date: toNullableString(record.end_date),
      price: toNullableNumber(record.price),
      currency: toNullableString(record.currency),
      availability: normalizeAvailability(record.availability)
    });
  }
  return output;
}

function normalizeOptionList(
  value: unknown
): StayDraftAiExtracted['extra_options_json'] | StayDraftAiExtracted['transport_options_json'] {
  const output: Array<{ label: string; price: number | null; currency: string | null; description: string | null }> = [];
  for (const item of asArray(value)) {
    const record = asObject(item);
    if (!record) continue;
    const label = toNullableString(record.label);
    if (!label) continue;
    output.push({
      label,
      price: toNullableNumber(record.price),
      currency: toNullableString(record.currency),
      description: toNullableString(record.description)
    });
  }
  return output;
}

function normalizeAccommodations(value: unknown): StayDraftAiExtracted['accommodations_json'] {
  const record = asObject(value);
  if (!record) return null;
  const fromArray = toStringArray(record.accommodation_types)
    .map((t) => normalizeAccommodationTypeToken(t))
    .filter((t): t is string => Boolean(t));
  const legacy = normalizeAccommodationTypeToken(String(record.accommodation_type ?? ''));
  const merged = legacy && !fromArray.includes(legacy) ? [...fromArray, legacy] : fromArray;
  const uniqueTypes = Array.from(new Set(merged)).slice(0, 5);

  const pmrRaw = record.pmr_accessible;
  const pmr =
    pmrRaw === true
      ? true
      : pmrRaw === false
        ? false
        : typeof pmrRaw === 'string' && /^(1|true|oui|yes)$/i.test(pmrRaw.trim())
          ? true
          : null;
  const centerLatitude = toNullableNumber(
    record.center_latitude ?? record.latitude ?? record.lat
  );
  const centerLongitude = toNullableNumber(
    record.center_longitude ?? record.longitude ?? record.lng ?? record.lon
  );
  const hasCenterLatitude = centerLatitude !== null;
  const hasCenterLongitude = centerLongitude !== null;
  const isCenterCoordinatesPairValid =
    hasCenterLatitude &&
    hasCenterLongitude &&
    centerLatitude >= -90 &&
    centerLatitude <= 90 &&
    centerLongitude >= -180 &&
    centerLongitude <= 180;
  const normalizedCenterLatitude = isCenterCoordinatesPairValid ? centerLatitude : null;
  const normalizedCenterLongitude = isCenterCoordinatesPairValid ? centerLongitude : null;

  return {
    title: toNullableString(record.title),
    description: toNullableString(record.description),
    accommodation_types: uniqueTypes.length > 0 ? uniqueTypes : undefined,
    accommodation_type: toNullableString(record.accommodation_type),
    location_mode: normalizeLocationMode(record.location_mode) ?? null,
    location_city: toNullableString(record.location_city),
    location_department_code: toNullableString(record.location_department_code),
    location_country: toNullableString(record.location_country),
    itinerant_zone: toNullableString(record.itinerant_zone),
    center_latitude: normalizedCenterLatitude,
    center_longitude: normalizedCenterLongitude,
    center_geocoding_query: toNullableString(
      record.center_geocoding_query ??
        record.geocoding_query ??
        record.full_address ??
        record.address
    ),
    bed_info: toNullableString(record.bed_info),
    bathroom_info: toNullableString(record.bathroom_info),
    catering_info: toNullableString(record.catering_info),
    pmr_accessible: pmr
  };
}

function normalizeAiExtractedCandidate(value: unknown): StayDraftAiExtracted {
  const record = asObject(value) ?? {};
  return {
    summary: normalizeStaySummary(toNullableString(record.summary)),
    description: toNullableString(record.description),
    location_text: toNullableString(record.location_text),
    region_text: toNullableString(record.region_text),
    program_text: toNullableString(record.program_text),
    supervision_text: toNullableString(record.supervision_text),
    transport_text: toNullableString(record.transport_text),
    transport_mode: normalizeStayTransportLogisticsMode(toNullableString(record.transport_mode)),
    categories: toStringArray(record.categories),
    ages: expandDraftAges(toNumberArray(record.ages)),
    sessions_json: normalizeSessionList(record.sessions_json),
    extra_options_json: normalizeOptionList(record.extra_options_json).filter(
      (row) => !isPartnerTariffExtraOptionLabel(row.label)
    ),
    transport_options_json: normalizeOptionList(record.transport_options_json),
    accommodations_json: normalizeAccommodations(record.accommodations_json)
  };
}

function buildAiInput(draft: StayDraftRow) {
  const rawPayload = parseRawPayload(draft.raw_payload);
  const extracted = asObject(rawPayload.extracted) ?? null;
  const html = typeof rawPayload.html === 'string' ? rawPayload.html : '';
  const extractedRawText =
    extracted && typeof extracted.rawText === 'string'
      ? normalizeMultilineText(extracted.rawText)
      : '';
  const rawPayloadMainText =
    typeof rawPayload.main_text === 'string'
      ? normalizeMultilineText(rawPayload.main_text)
      : '';

  const mainText =
    cleanMainTextForAI(
      extractedRawText.length > 300
        ? extractedRawText
        : rawPayloadMainText.length > 300
          ? rawPayloadMainText
          : html
            ? extractMainTextFromHtml(html)
            : null
    ) ?? null;

  const htmlExcerpt = html ? extractHtmlExcerpt(html) : null;
  const cleanedHtmlExcerpt = cleanMainTextForAI(
    htmlExcerpt ? extractReadableTextFromHtml(htmlExcerpt) : null
  );
  const draftImages = extractImageUrls(draft.images);
  const extractedImages = extracted ? extractImageUrls(extracted.images) : [];
  const images = dedupeStrings([...draftImages, ...extractedImages]).slice(0, 8);

  const technical = extracted ? asObject(extracted.technical) : null;
  const metaTitle =
    technical && typeof technical.titleTag === 'string' ? normalizeWhitespace(technical.titleTag) : null;
  const metaDescription =
    technical && typeof technical.metaDescription === 'string'
      ? normalizeWhitespace(technical.metaDescription)
      : null;
  const transportVariants = Array.isArray(rawPayload.transport_variants)
    ? rawPayload.transport_variants
    : Array.isArray(rawPayload.transport_matrix)
      ? rawPayload.transport_matrix
      : [];
  const inferredTransportMode = inferTransportLogisticsModeFromSignals({
    currentValue: draft.transport_mode,
    html,
    visibleText: mainText ?? cleanedHtmlExcerpt ?? null,
    transportOptions: transportVariants as Array<{ departure_city?: string | null; return_city?: string | null }>
  });

  return {
    source_url: draft.source_url,
    title: draft.title,
    description: draft.description,
    age_min: draft.age_min,
    age_max: draft.age_max,
    images,
    meta: {
      title: metaTitle,
      description: metaDescription
    },
    transport_signals: {
      inferred_logistics_mode: inferredTransportMode || null,
      has_transport_variants: transportVariants.length > 0
    },
    extracted_v1_minimal: extracted
      ? {
          title: typeof extracted.title === 'string' ? extracted.title : null,
          description: typeof extracted.description === 'string' ? extracted.description : null,
          age_min: typeof extracted.ageMin === 'number' ? extracted.ageMin : null,
          age_max: typeof extracted.ageMax === 'number' ? extracted.ageMax : null,
          images: extractImageUrls(extracted.images),
          main_text: extractedRawText ? truncate(extractedRawText, MAX_MAIN_TEXT_LENGTH) : null
        }
      : null,
    main_text: mainText ?? null,
    html_excerpt: cleanedHtmlExcerpt ?? null
  };
}

export async function enrichStayDraftWithAI(
  draft: StayDraftRow
): Promise<StayDraftAiEnrichmentResult> {
  const openai = createOpenAIClient();
  const model = DEFAULT_OPENAI_MODEL;
  const inputPayload = buildAiInput(draft);

  const userPrompt = `
Analyse les données ci-dessous et renvoie le JSON strict demandé.
Ne renvoie que ce JSON.
La sortie doit être un seul objet JSON en racine, jamais un tableau.

Schéma exact attendu :
{
  "summary": string | null,
  "description": string | null,
  "location_text": string | null,
  "region_text": string | null,
  "program_text": string | null,
  "supervision_text": string | null,
  "transport_text": string | null,
  "transport_mode": string | null,
  "categories": string[],
  "ages": number[],
  "sessions_json": [
    {
      "label": string | null,
      "start_date": string | null,
      "end_date": string | null,
      "price": number | null,
      "currency": string | null,
      "availability": "available" | "full" | "unknown" | null
    }
  ],
  "extra_options_json": [
    {
      "label": string,
      "price": number | null,
      "currency": string | null,
      "description": string | null
    }
  ],
  "transport_options_json": [
    {
      "label": string,
      "price": number | null,
      "currency": string | null,
      "description": string | null
    }
  ],
  "accommodations_json": {
    "title": string | null,
    "description": string | null,
    "accommodation_types": string[],
    "accommodation_type": string | null,
    "location_mode": "france" | "abroad" | "itinerant" | null,
    "location_city": string | null,
    "location_department_code": string | null,
    "location_country": string | null,
    "itinerant_zone": string | null,
    "center_latitude": number | null,
    "center_longitude": number | null,
    "center_geocoding_query": string | null,
    "bed_info": string | null,
    "bathroom_info": string | null,
    "catering_info": string | null,
    "pmr_accessible": boolean | null
  } | null
}

Règles pour "accommodations_json" (objet complet si un nouvel hébergement est à créer, sinon null) :
- "title" : nom institutionnel court (ex. « Centre Pierre Brossolette », « Centre à Quillan », « Circuit itinérant : A, B et C », « Camping à … »). N'y mettre ni couchage, ni sanitaires, ni repas.
- "accommodation_types" : 1 à 3 valeurs parmi exactement : centre, auberge de jeunesse, camping, famille d'accueil, gite, mixte. Plusieurs structures sur un circuit ⇒ plusieurs entrées ou "mixte". "accommodation_type" peut répéter le principal si besoin de compatibilité.
- "location_mode" : france | abroad | itinerant selon le cas ; null si inconnu.
- Lieu — règles strictes :
  - Si "location_mode" = "france" : "location_city" doit être un NOM DE COMMUNE ou de ville (jamais le nom d'un département seul, jamais « Vendée / Deux-Sèvres »). "location_department_code" doit être le NUMÉRO INSEE à 2 ou 3 caractères (ex. 85 pour la Vendée, 79 pour les Deux-Sèvres, 75 pour Paris). Si la source ne donne qu'une frontière entre deux départements sans commune précise, utilise "itinerant" + "itinerant_zone" décrivant la zone (tu peux citer les deux départements avec leurs numéros).
  - Si "abroad" : ville réelle + pays en toutes lettres dans "location_country".
  - Si "itinerant" : "itinerant_zone" en une ou deux phrases (itinéraire, étapes, zone géographique).
- Géolocalisation du centre :
  - Si les coordonnées GPS exactes apparaissent clairement dans la source, renseigne "center_latitude" et "center_longitude".
  - Sinon, laisse-les à null et propose "center_geocoding_query" (adresse ou requête de géocodage la plus précise possible).
  - Ne renseigne jamais un seul des deux champs latitude/longitude : les deux ensemble ou null.
- "description" : 2 à 5 phrases fluides en français, avec articles et verbes conjugués (ex. « Le centre est implanté … », « Les participants profitent de … »). Parle du site, de la région, des infrastructures et des salles. Exclure tout ce qui relève du couchage, des sanitaires, de la restauration ou du PMR. Évite le style liste de mots-clés.
- "bed_info" : phrases complètes et naturelles (ex. « Les chambres disposent de deux à six lits chacune. » ou « Le couchage se fait en dortoirs de huit lits. »). Préciser le mode de couchage si connu.
- "bathroom_info" : phrases complètes (ex. « Des sanitaires privatifs sont installés dans chaque chambre. » ou « Les sanitaires sont collectifs sur le palier. »).
- "catering_info" : phrases complètes sur les repas, cantine, self, etc.
- "pmr_accessible" : true uniquement si l'accessibilité PMR / handicap est clairement indiquée, sinon false ou null.

Catégories autorisées pour "categories" (utiliser exactement ces libellés et rien d'autre) :
${STAY_CATEGORY_ALLOWED_LIST_FOR_PROMPT}

Règles strictes pour "categories" :
- Le champ "categories" est une liste de 1 à plusieurs catégories autorisées si le cadre du séjour est identifiable.
- Chaque valeur doit être exactement un des libellés autorisés ci-dessus.
- Le séjour doit porter en priorité un cadre parmi : "Séjour à la mer", "Séjour à la montagne", "Séjour à la campagne" ou "Séjour à l'étranger", dès que ce cadre est identifiable dans la source.
- Le séjour peut ensuite avoir en plus un thème secondaire comme artistique, équestre, scientifique, itinérant, linguistique ou sportif.
- Certains séjours n'ont pas de thème secondaire, mais ils ont tout de même un cadre principal.
- N'ajoute une catégorie que si elle est explicitement justifiée par le contenu source.
- Si une catégorie est incertaine ou implicite, ne l'ajoute pas.
- Si aucune catégorie n'est fiable, renvoie [].

Règles strictes pour "summary" :
- "summary" est une phrase d'accroche courte, naturelle et vendeuse.
- Maximum ${MAX_STAY_SUMMARY_LENGTH} caractères.
- Écrire un vrai français relu. Interdiction de recopier une suite de mots-clés SEO.
- Ne garde que des formulations idiomatiques en français. Exemple incorrect : « Séjour danse modern-jazz en Vendée pour 9 à 14 ans ». Exemple correct : « Séjour danse modern-jazz en Vendée de 9 à 14 ans ».
- Exemples corrects : « Séjour Manga en Vendée », « Séjour Manga pour enfants de 8 à 13 ans ».

Règles strictes pour "description" :
- "description" doit faire 2 à 5 phrases complètes, naturelles et informatives.
- Réécris les formulations SEO, trop courtes ou mal rédigées si nécessaire.
- Si le texte court ressemble à une méta-description SEO, à du référencement Google ou à une suite de mots-clés, ignore-le et appuie-toi d'abord sur "main_text" et "html_excerpt".
- Exemple à éviter : « Séjour et colonie et stage danse Modern-jazz pour enfants de 9 à 14 ans, colonie danse pour enfant... ».
- Décrire le séjour, son ambiance, le cadre, les temps forts et ce que vivent les jeunes.
- Ne pas produire une simple liste de mots-clés.

Règles strictes pour "program_text" :
- Réutilise autant que possible les formulations riches réellement visibles sur le site source.
- Si la source contient des paragraphes détaillés, conserve la substance et la précision dans une rédaction propre.
- Si la source contient surtout des listes d'activités, tu peux les reprendre en phrases claires ou en liste lisible.
- Le programme doit être plus détaillé que la description quand la source le permet.

Règles strictes pour "supervision_text" :
- Rédiger une ou plusieurs phrases naturelles.
- Utiliser les chiffres en numérique : « 1 adulte pour 5 inscrits », pas « cinq ».
- Conserver les fonctions exactes si elles sont connues.

Règles strictes pour "transport_text" :
- Rédiger 1 à 4 phrases naturelles.
- Préciser si le trajet se fait en train, en train puis en car, en car, en avion, ou si l'arrivée se fait directement sur place.
- Si plusieurs modes sont mentionnés, écris-les explicitement dans des phrases.

Règles strictes pour "transport_mode" :
- Ce champ ne sert PAS au véhicule (train/car/etc.).
- Il doit contenir uniquement l'un des 3 libellés suivants : "Aller/Retour similaire", "Aller/Retour différencié", "Sans transport".
- "Aller/Retour similaire" si les villes aller et retour sont identiques ou si rien ne montre qu'elles diffèrent.
- "Aller/Retour différencié" si les villes ou modalités aller/retour diffèrent.
- Si la source montre deux menus déroulants distincts pour l'aller et le retour, considère que c'est "Aller/Retour différencié".
- "Sans transport" s'il n'y a pas d'acheminement organisé.

Règles strictes pour "ages" :
- Si la source indique une tranche comme « 8 à 13 ans », renvoie [8,9,10,11,12,13] et non [8,13].

Règles strictes pour "sessions_json.availability" :
- Si la page laisse clairement réserver / inscrire sans mention de complet, préfère "available".
- Si la session est complète, renvoie "full".
- Si la disponibilité n'est vraiment pas déterminable, renvoie "unknown" ou null.

Règles strictes pour "extra_options_json" :
- N'y mets pas les tarifs « partenaire » / collectivités (ex. ligne CESL « Tarif partenaire ») : ce n'est pas une option payante à la carte sur RESACOLO.

Contexte :
${JSON.stringify(inputPayload)}
`.trim();

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]
  });
  const usage: AiUsage | null = completion.usage
    ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens
      }
    : null;

  const rawContent = completion.choices[0]?.message?.content;
  if (!rawContent) {
    throw new StayDraftAiEnrichmentError('Réponse OpenAI vide.', {
      rawResponse: null,
      model,
      promptVersion: STAY_DRAFT_AI_PROMPT_VERSION,
      usage
    });
  }
  console.info('[stay-draft-ai-enrichment] raw OpenAI preview', {
    preview: rawContent.slice(0, MAX_AI_LOG_PREVIEW_LENGTH)
  });

  let parsedRoot: unknown;
  try {
    parsedRoot = JSON.parse(stripCodeFences(rawContent));
  } catch {
    throw new StayDraftAiEnrichmentError('Réponse OpenAI invalide (JSON non parsable).', {
      rawResponse: rawContent,
      model,
      promptVersion: STAY_DRAFT_AI_PROMPT_VERSION,
      usage
    });
  }
  console.info('[stay-draft-ai-enrichment] parsed root shape', {
    type: valueType(parsedRoot),
    isArray: Array.isArray(parsedRoot),
    arrayLength: Array.isArray(parsedRoot) ? parsedRoot.length : null
  });

  let parsedForValidation: unknown;
  let unwrappedSource = 'direct';
  try {
    const normalizedRoot = normalizeParsedRoot(parsedRoot, 'root');
    const unwrapped = unwrapIntermediaryPayload(normalizedRoot);
    unwrappedSource = unwrapped.source;
    parsedForValidation = normalizeParsedRoot(unwrapped.value, unwrapped.source);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Réponse OpenAI invalide (normalisation racine).';
    throw new StayDraftAiEnrichmentError(message, {
      rawResponse: rawContent,
      model,
      promptVersion: STAY_DRAFT_AI_PROMPT_VERSION,
      usage
    });
  }

  console.info('[stay-draft-ai-enrichment] parsed value before zod', {
    source: unwrappedSource,
    type: valueType(parsedForValidation),
    isArray: Array.isArray(parsedForValidation),
    arrayLength: Array.isArray(parsedForValidation) ? parsedForValidation.length : null,
    preview: previewValue(parsedForValidation)
  });

  const firstValidation = aiExtractedSchema.safeParse(parsedForValidation);
  let extracted: StayDraftAiExtracted;

  if (firstValidation.success) {
    extracted = firstValidation.data;
  } else {
    const normalizedCandidate = normalizeAiExtractedCandidate(parsedForValidation);
    console.info('[stay-draft-ai-enrichment] schema fallback candidate', {
      preview: previewValue(normalizedCandidate)
    });
    const secondValidation = aiExtractedSchema.safeParse(normalizedCandidate);

    if (!secondValidation.success) {
      const firstIssue = firstValidation.error.issues[0];
      const firstPath = firstIssue?.path?.length ? firstIssue.path.join('.') : '(root)';
      const secondIssue = secondValidation.error.issues[0];
      const secondPath = secondIssue?.path?.length ? secondIssue.path.join('.') : '(root)';
      throw new StayDraftAiEnrichmentError(
        `Réponse OpenAI invalide (schéma) [path=${firstPath}] : ${firstIssue?.message ?? 'erreur inconnue'} | fallback [path=${secondPath}] : ${secondIssue?.message ?? 'erreur inconnue'}`,
        {
          rawResponse: rawContent,
          model,
          promptVersion: STAY_DRAFT_AI_PROMPT_VERSION,
          usage
        }
      );
    }

    extracted = secondValidation.data;
  }

  return {
    extracted: normalizeAiExtracted(extracted),
    model,
    promptVersion: STAY_DRAFT_AI_PROMPT_VERSION,
    rawResponse: rawContent,
    usage
  };
}
