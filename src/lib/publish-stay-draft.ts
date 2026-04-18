import type { SupabaseClient } from '@supabase/supabase-js';
import {
  embedAccommodationLocationMeta,
  validateAndParseAccommodationCenterCoordinates
} from '@/lib/accommodation-location';
import { repairAccommodationImportLocation } from '@/lib/french-department-codes';
import {
  ensurePrimaryStaySettingCategory,
  normalizeStayDraftCategories,
  stayCategoryLabelToValue,
  stayCategoryValueToLabel,
  type StayCategoryValue
} from '@/lib/stay-categories';
import {
  normalizeAccommodationTypeToken,
  normalizeLocationMode
} from '@/lib/stay-draft-accommodation-import';
import { expandDraftAges } from '@/lib/stay-draft-content';
import { liveSessionStableKey } from '@/lib/draft-session-keys';
import {
  removeStayMediaStorageFiles,
  uploadImportedStayImages
} from '@/lib/stay-media-storage';
import { mapToCanonicalStayRegion } from '@/lib/stay-regions';
import { isPartnerTariffExtraOptionLabel } from '@/lib/stay-draft-extra-options-split';
import { normalizeStayTitle } from '@/lib/stay-title';
import { maybeRecordPublicationFeeWhenStayPublished } from '@/lib/resacolo-fee-ledger.server';
import type { Database, Json } from '@/types/supabase';

type StayDraftRow = Database['public']['Tables']['stay_drafts']['Row'];
type StayStatus = Database['public']['Enums']['stay_status'];
type SessionStatus = Database['public']['Enums']['session_status'];
type StayInsert = Database['public']['Tables']['stays']['Insert'];
type StayUpdate = Database['public']['Tables']['stays']['Update'];
type SessionInsert = Database['public']['Tables']['sessions']['Insert'];
type StayMediaInsert = Database['public']['Tables']['stay_media']['Insert'];
type ExtraOptionInsert = Database['public']['Tables']['stay_extra_options']['Insert'];
type TransportOptionInsert = Database['public']['Tables']['transport_options']['Insert'];
type InsuranceOptionInsert = Database['public']['Tables']['insurance_options']['Insert'];
type AccommodationInsert = Database['public']['Tables']['accommodations']['Insert'];
type AccommodationUpdate = Database['public']['Tables']['accommodations']['Update'];

type LivePublication = {
  stay_id: string;
  published_at: string;
  synced_tables: string[];
  accommodation_id?: string | null;
};

export type PublishStayDraftToLiveInput = {
  supabase: SupabaseClient<Database>;
  draft: StayDraftRow;
};

export type PublishStayDraftToLiveResult = {
  stayId: string;
  publishedAt: string;
  syncedTables: string[];
  rawPayload: Record<string, unknown>;
};

export class PublishStayDraftError extends Error {
  readonly step: string;

  constructor(step: string, message: string) {
    super(message);
    this.name = 'PublishStayDraftError';
    this.step = step;
  }
}

const LIVE_TRANSPORT_MODES = new Set([
  'Aller/Retour similaire',
  'Aller/Retour différencié',
  'Sans transport'
]);

const INSURANCE_KEYWORDS = [
  'assurance',
  'annulation',
  'assistance',
  'rapatriement',
  'multi risque',
  'multirisque'
];

const BED_INFO_KEYS = ['lit', 'lits', 'couchage', 'chambre', 'dortoir', 'tente', 'chalet'];
const BATHROOM_INFO_KEYS = ['sanitaire', 'wc', 'toilette', 'douche', 'salle de bain'];
const CATERING_INFO_KEYS = ['restauration', 'repas', 'self', 'pension', 'liaison chaude', 'liaison froide'];
const ACCESSIBILITY_KEYS = ['pmr', 'mobilite reduite', 'mobilité réduite', 'accessible', 'accessibilite', 'accessibilité', 'fauteuil roulant'];

const CATEGORY_INFERENCE_RULES: Array<{
  value: StayCategoryValue;
  keys: string[];
}> = [
  { value: 'mer', keys: ['mer', 'plage', 'voile', 'surf', 'nautique'] },
  { value: 'montagne', keys: ['montagne', 'alpin', 'ski', 'haute montagne'] },
  { value: 'campagne', keys: ['campagne', 'ferme', 'nature'] },
  { value: 'artistique', keys: ['artistique', 'musique', 'danse', 'theatre', 'théâtre', 'chant', 'cirque', 'arts plastiques'] },
  { value: 'equestre', keys: ['equestre', 'équitation', 'equitation', 'cheval', 'poneys', 'poney'] },
  { value: 'linguistique', keys: ['linguistique', 'langue', 'anglais', 'espagnol', 'allemand'] },
  { value: 'scientifique', keys: ['scientifique', 'science', 'robotique', 'astronomie', 'laboratoire'] },
  { value: 'sportif', keys: ['sportif', 'sport', 'football', 'basket', 'natation', 'escalade', 'tennis'] },
  { value: 'itinerant', keys: ['itinerant', 'itinérant', 'itinérance', 'road trip', 'randonnee', 'randonnée'] },
  { value: 'etranger', keys: ['etranger', 'étranger', 'international', 'europe', 'espagne', 'italie', 'royaume uni', 'angleterre'] }
];

const INVALID_PLACEHOLDER_KEYS = new Set([
  'a',
  'aa',
  'aaa',
  'aaaa',
  'bbb',
  'ccc',
  'ddd',
  'xxx',
  'test',
  'tests',
  'test test',
  'demo',
  'placeholder',
  'lorem',
  'ipsum',
  'azerty',
  'qwerty',
  'qsdf',
  'qsd',
  'asdf',
  'toto',
  'bidon',
  'gregre'
]);

const ACCOMMODATION_DESCRIPTIVE_KEYS = [
  'hebergement',
  'chambre',
  'chambres',
  'lits',
  'couchage',
  'dortoir',
  'dortoirs',
  'tente',
  'tentes',
  'sanitaire',
  'sanitaires',
  'moderne',
  'fonctionnel',
  'avec',
  'repas',
  'restauration'
];

function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

function simplifyForMatch(value: string | null | undefined): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeApostrophes(value: string): string {
  return value.replace(/[’`´]/g, "'");
}

function isInvalidPlaceholderKey(key: string): boolean {
  if (!key) return true;
  if (INVALID_PLACEHOLDER_KEYS.has(key)) return true;
  if (/^(test|demo|placeholder)(?:\s*\d+)?$/i.test(key)) return true;
  if (/^([a-z])\1{2,}$/i.test(key.replace(/\s+/g, ''))) return true;
  return false;
}

function sanitizeAccommodationText(
  value: string | null | undefined,
  options: { maxLength?: number; allowSingleChar?: boolean } = {}
): string | null {
  const maxLength = options.maxLength ?? 320;
  const normalized = normalizeWhitespace(normalizeApostrophes(value ?? ''));
  if (!normalized) return null;

  const key = simplifyForMatch(normalized);
  if (!key) return null;
  if (!options.allowSingleChar && key.length <= 1) return null;
  if (isInvalidPlaceholderKey(key)) return null;

  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

function splitTextFragments(value: string): string[] {
  return normalizeApostrophes(value)
    .split(/\n+|[.;]+/g)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

function toDisplayCase(value: string): string {
  return value
    .split(/(\s+|-)/g)
    .map((chunk) => {
      if (!chunk || /\s+|-/.test(chunk)) return chunk;
      if (chunk.includes("'")) {
        const [prefix, suffix] = chunk.split("'", 2);
        const normalizedPrefix = prefix.toLocaleLowerCase('fr-FR');
        const normalizedSuffix = suffix
          ? suffix.charAt(0).toLocaleUpperCase('fr-FR') + suffix.slice(1).toLocaleLowerCase('fr-FR')
          : '';
        return `${normalizedPrefix}'${normalizedSuffix}`;
      }
      return chunk.charAt(0).toLocaleUpperCase('fr-FR') + chunk.slice(1).toLocaleLowerCase('fr-FR');
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCityInText(...values: Array<string | null | undefined>): string | null {
  const source = values
    .map((value) => sanitizeAccommodationText(value, { maxLength: 500 }))
    .filter((value): value is string => Boolean(value))
    .join(' · ');
  if (!source) return null;

  const locationPrefix = source.split(',')[0];
  if (locationPrefix && locationPrefix.length <= 50 && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(locationPrefix)) {
    const cleanPrefix = sanitizeAccommodationText(locationPrefix, { maxLength: 60 });
    if (cleanPrefix && cleanPrefix.split(' ').length <= 5) {
      return toDisplayCase(cleanPrefix);
    }
  }

  const match = source.match(/\b(?:à|au|en)\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,40})\b/);
  if (!match?.[1]) return null;
  const city = sanitizeAccommodationText(match[1], { maxLength: 60 });
  return city ? toDisplayCase(city) : null;
}

function looksLikeAccommodationName(value: string): boolean {
  const sanitized = sanitizeAccommodationText(value, { maxLength: 140 });
  if (!sanitized) return false;

  const key = simplifyForMatch(sanitized);
  if (isInvalidPlaceholderKey(key)) return false;
  if (key.split(' ').length > 9) return false;
  if (key.startsWith('centre d hebergement')) return false;

  const descriptiveHits = ACCOMMODATION_DESCRIPTIVE_KEYS.filter((token) =>
    key.includes(simplifyForMatch(token))
  ).length;
  if (descriptiveHits >= 2) return false;
  if (key.includes('moderne') || key.includes('fonctionnel')) return false;

  return true;
}

function buildFallbackAccommodationName(
  accommodationType: string,
  city: string | null
): string {
  const base =
    accommodationType === 'camping'
      ? 'Camping'
      : accommodationType === 'auberge de jeunesse'
        ? 'Auberge de jeunesse'
        : accommodationType === 'gite'
          ? 'Gîte'
        : "Centre d'hébergement";
  return city ? `${base} à ${city}` : base;
}

function buildAccommodationName(input: {
  title: string | null;
  description: string | null;
  locationHint: string | null;
  accommodationType: string;
}): string {
  const title = sanitizeAccommodationText(input.title, { maxLength: 140 });
  if (title && looksLikeAccommodationName(title)) {
    return normalizeStayTitle(title);
  }

  const city = findCityInText(input.locationHint, title, input.description);
  return buildFallbackAccommodationName(input.accommodationType, city);
}

function toNullableText(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value: Json | null): Record<string, unknown> {
  if (isPlainObject(value)) {
    return { ...value };
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (isPlainObject(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function readPartnerDiscountPercentFromRawPayload(rawPayload: Record<string, unknown>): number | null {
  const v = rawPayload.partner_discount_percent;
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function coerceAccommodationJsonObject(value: Json | null): Record<string, unknown> {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isPlainObject(item)) {
        return repairAccommodationImportLocation({ ...item });
      }
    }
    return {};
  }
  return repairAccommodationImportLocation(asObject(value));
}

function asRecordArray(value: Json | null): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    const output: Array<Record<string, unknown>> = [];
    for (const item of value) {
      if (isPlainObject(item)) {
        output.push(item);
      }
    }
    return output;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        const output: Array<Record<string, unknown>> = [];
        for (const item of parsed) {
          if (isPlainObject(item)) {
            output.push(item);
          }
        }
        return output;
      }
    } catch {
      return [];
    }
  }

  return [];
}

function asStringArray(value: Json | null): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => normalizeWhitespace(item))
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function isMissingColumnError(message: string | undefined, columnName: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('column') && normalized.includes(columnName.toLowerCase());
}

function isMissingSeoColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('column') && normalized.includes('seo_') && normalized.includes('does not exist');
}

function removeSeoFieldsFromPayload<T extends Record<string, unknown>>(payload: T): T {
  const nextPayload = { ...payload };
  for (const key of Object.keys(nextPayload)) {
    if (key.startsWith('seo_')) {
      delete nextPayload[key];
    }
  }
  return nextPayload as T;
}

function categoryValueToLogLabel(value: string): string {
  return stayCategoryValueToLabel(value) ?? value;
}

function mapDraftCategoriesToLiveCategories(categories: string[] | null): {
  draftReceived: string[];
  liveValues: StayCategoryValue[];
  liveLabels: string[];
  rejected: string[];
} {
  const input = categories ?? [];
  const normalizedDraftCategories = normalizeStayDraftCategories(input);
  const liveValues = Array.from(
    new Set(
      normalizedDraftCategories.categories
        .map((label) => stayCategoryLabelToValue(label))
        .filter((value): value is StayCategoryValue => value !== null)
    )
  );
  const liveLabels = liveValues.map((value) => categoryValueToLogLabel(value));

  return {
    draftReceived: input.map((item) => normalizeWhitespace(item)).filter(Boolean),
    liveValues,
    liveLabels,
    rejected: normalizedDraftCategories.rejected
  };
}

function inferLiveCategoriesFromContent(content: string): StayCategoryValue[] {
  const key = simplifyForMatch(content);
  if (!key) return [];

  const inferred = new Set<StayCategoryValue>();
  for (const rule of CATEGORY_INFERENCE_RULES) {
    if (rule.keys.some((ruleKey) => key.includes(simplifyForMatch(ruleKey)))) {
      inferred.add(rule.value);
    }
  }

  return Array.from(inferred);
}

function normalizeAges(ages: number[] | null, ageMin: number | null, ageMax: number | null): number[] {
  return expandDraftAges(ages, ageMin, ageMax);
}

export type ParsedTransportOption = {
  departureCity: string;
  returnCity: string;
  amountCents: number;
  excludedSessionKeys: string[];
};

function normalizeTransportMode(
  draftMode: string | null,
  hasTransportText: boolean,
  transportOptions: ParsedTransportOption[]
): string {
  const normalized = normalizeWhitespace(draftMode ?? '');
  if (normalized && LIVE_TRANSPORT_MODES.has(normalized)) {
    return normalized;
  }

  if (transportOptions.length > 0) {
    const hasOneWayOption = transportOptions.some(
      (option) => !option.departureCity || !option.returnCity
    );
    return hasOneWayOption ? 'Aller/Retour différencié' : 'Aller/Retour similaire';
  }

  if (hasTransportText) {
    return 'Aller/Retour similaire';
  }

  return 'Sans transport';
}

function parseSessions(value: Json | null): Array<{ startDate: string; endDate: string; status: SessionStatus; priceCents: number | null; currency: string; remainingPlaces: number | null }> {
  const rows = asRecordArray(value);
  const output: Array<{ startDate: string; endDate: string; status: SessionStatus; priceCents: number | null; currency: string; remainingPlaces: number | null }> = [];

  for (const row of rows) {
    const startDate = normalizeDateOnly(row.start_date);
    const endDate = normalizeDateOnly(row.end_date);
    if (!startDate || !endDate) continue;
    if (endDate < startDate) continue;

    const availability = normalizeWhitespace(String(row.availability ?? '')).toLowerCase();
    const status: SessionStatus = availability === 'full' ? 'FULL' : 'OPEN';

    const price = toNumber(row.price);
    const remainingPlacesValue = toNumber(row.remaining_places);
    const currency = normalizeWhitespace(String(row.currency ?? 'EUR')).toUpperCase() || 'EUR';
    const priceCents = price !== null && price >= 0 ? Math.round(price * 100) : null;
    const remainingPlaces =
      remainingPlacesValue !== null && remainingPlacesValue >= 0
        ? Math.round(remainingPlacesValue)
        : null;

    output.push({
      startDate,
      endDate,
      status,
      priceCents,
      currency,
      remainingPlaces
    });
  }

  return output;
}

function parseAmountCents(value: unknown): number | null {
  const amount = toNumber(value);
  if (amount === null || amount < 0) return null;
  return Math.round(amount * 100);
}

function parsePercentValue(value: unknown): number | null {
  const direct = toNumber(value);
  if (direct !== null && direct >= 0) return direct;
  if (typeof value !== 'string') return null;
  const match = value.match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
  if (!match?.[1]) return null;
  const parsed = toNumber(match[1]);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function isInsuranceCandidate(...values: Array<unknown>): boolean {
  const merged = values
    .map((value) => normalizeWhitespace(typeof value === 'string' ? value : String(value ?? '')))
    .filter(Boolean)
    .join(' ');
  const key = simplifyForMatch(merged);
  if (!key) return false;
  return INSURANCE_KEYWORDS.some((token) => key.includes(simplifyForMatch(token)));
}

/** Même logique que `parseExtraAndInsuranceOptions` mais sur une liste fusionnée (ex. payload de relecture). */
export function parseMergedExtraOptionsRows(rowsInput: Array<Record<string, unknown>>): {
  extraOptions: Array<{ label: string; amountCents: number }>;
  insuranceOptions: Array<{ label: string; pricingMode: 'FIXED' | 'PERCENT'; amountCents: number | null; percentValue: number | null }>;
} {
  const rows = rowsInput;
  const extraOutput: Array<{ label: string; amountCents: number }> = [];
  const insuranceOutput: Array<{ label: string; pricingMode: 'FIXED' | 'PERCENT'; amountCents: number | null; percentValue: number | null }> = [];

  for (const row of rows) {
    const label = normalizeWhitespace(String(row.label ?? ''));
    if (!label) continue;
    if (isPartnerTariffExtraOptionLabel(label)) continue;

    const description = normalizeWhitespace(String(row.description ?? ''));
    const pricingModeRaw = normalizeWhitespace(String(row.pricing_mode ?? row.mode ?? '')).toUpperCase();
    const amountCents =
      parseAmountCents(row.price) ??
      parseAmountCents(row.amount) ??
      parseAmountCents(row.amount_euros) ??
      (typeof row.amount_cents === 'number' && Number.isFinite(row.amount_cents)
        ? Math.max(0, Math.round(row.amount_cents))
        : null);
    const percentValue =
      parsePercentValue(row.percent_value) ??
      parsePercentValue(row.percent) ??
      parsePercentValue(description) ??
      parsePercentValue(label);
    const isInsurance = isInsuranceCandidate(
      label,
      description,
      row.category,
      row.type,
      row.scope
    );

    if (isInsurance) {
      const pricingMode: 'FIXED' | 'PERCENT' =
        pricingModeRaw === 'PERCENT' || percentValue !== null ? 'PERCENT' : 'FIXED';
      insuranceOutput.push({
        label,
        pricingMode,
        amountCents: pricingMode === 'FIXED' ? amountCents : null,
        percentValue: pricingMode === 'PERCENT' ? percentValue : null
      });
      continue;
    }

    if (amountCents === null) continue;
    extraOutput.push({
      label,
      amountCents
    });
  }

  const dedupedExtras = new Map<string, { label: string; amountCents: number }>();
  for (const option of extraOutput) {
    const key = `${simplifyForMatch(option.label)}|${option.amountCents}`;
    if (!dedupedExtras.has(key)) dedupedExtras.set(key, option);
  }

  const dedupedInsurance = new Map<
    string,
    { label: string; pricingMode: 'FIXED' | 'PERCENT'; amountCents: number | null; percentValue: number | null }
  >();
  for (const option of insuranceOutput) {
    const key = `${simplifyForMatch(option.label)}|${option.pricingMode}|${option.amountCents ?? ''}|${option.percentValue ?? ''}`;
    if (!dedupedInsurance.has(key)) dedupedInsurance.set(key, option);
  }

  return {
    extraOptions: Array.from(dedupedExtras.values()),
    insuranceOptions: Array.from(dedupedInsurance.values())
  };
}

function parseExtraAndInsuranceOptions(
  draft: StayDraftRow,
  rawPayload: Record<string, unknown>
): {
  extraOptions: Array<{ label: string; amountCents: number }>;
  insuranceOptions: Array<{ label: string; pricingMode: 'FIXED' | 'PERCENT'; amountCents: number | null; percentValue: number | null }>;
} {
  const rows: Array<Record<string, unknown>> = [...asRecordArray(draft.extra_options_json)];

  const aiExtracted = isPlainObject(rawPayload.ai_extracted) ? rawPayload.ai_extracted : null;
  if (aiExtracted && Array.isArray(aiExtracted.insurance_options_json)) {
    for (const item of aiExtracted.insurance_options_json) {
      if (isPlainObject(item)) rows.push(item);
    }
  }

  return parseMergedExtraOptionsRows(rows);
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'oui', 'on'].includes(value.trim().toLowerCase());
}

function parseExcludedSessionKeysFromRow(row: Record<string, unknown>): string[] {
  const raw = row.excluded_session_keys;
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

export function parseTransportOptionsFromJson(value: Json | null): ParsedTransportOption[] {
  const rows = asRecordArray(value);
  type TransportCandidate = {
    departureCity: string;
    returnCity: string;
    amountCents: number;
    excludedSessionKeys: string[];
    score: number;
    sourceUrl: string | null;
    reason: string | null;
  };
  const output = new Map<string, TransportCandidate>();
  const rejected: Array<{ reason: string; departureCity: string; returnCity: string; sourceUrl: string | null }> = [];

  const pushOption = (
    departureCity: string,
    returnCity: string,
    amountCents: number | null,
    sourceUrl: string | null,
    reason: string | null,
    confidenceRaw: string | null,
    excludedSessionKeys: string[] = []
  ) => {
    const cleanDeparture = normalizeWhitespace(departureCity);
    const cleanReturn = normalizeWhitespace(returnCity);
    if (!cleanDeparture && !cleanReturn) {
      rejected.push({
        reason: 'missing-cities',
        departureCity: cleanDeparture,
        returnCity: cleanReturn,
        sourceUrl
      });
      return;
    }
    if (amountCents === null) {
      rejected.push({
        reason: reason ?? 'missing-amount-cents',
        departureCity: cleanDeparture,
        returnCity: cleanReturn,
        sourceUrl
      });
      return;
    }

    const normalizedAmount = Math.max(0, amountCents);
    const normalizedDeparture = cleanDeparture || cleanReturn;
    const normalizedReturn = cleanReturn || cleanDeparture;
    const confidence = simplifyForMatch(confidenceRaw ?? '');
    const confidenceScore =
      confidence === 'high' ? 30 : confidence === 'medium' ? 20 : confidence === 'low' ? 10 : 0;
    const score = 100 + confidenceScore + (normalizedAmount > 0 ? 10 : 0);
    const exKey = excludedSessionKeys.slice().sort().join('>');
    const key = `${simplifyForMatch(normalizedDeparture)}|${simplifyForMatch(normalizedReturn)}|ex:${exKey}`;
    const candidate: TransportCandidate = {
      departureCity: normalizedDeparture,
      returnCity: normalizedReturn,
      amountCents: normalizedAmount,
      excludedSessionKeys: excludedSessionKeys.slice(),
      score,
      sourceUrl,
      reason
    };
    const existing = output.get(key);
    if (!existing || candidate.score > existing.score) {
      output.set(key, candidate);
    }
  };

  for (const row of rows) {
    const excludedSessionKeys = parseExcludedSessionKeysFromRow(row);
    const label = normalizeWhitespace(String(row.label ?? ''));
    const city = normalizeWhitespace(String(row.city ?? row.label ?? ''));
    const departureCity = normalizeWhitespace(String(row.departure_city ?? row.outbound_city ?? ''));
    const returnCity = normalizeWhitespace(String(row.return_city ?? row.inbound_city ?? ''));
    const description = normalizeWhitespace(String(row.description ?? ''));
    const direction = simplifyForMatch(
      String(row.direction ?? row.sense ?? row.type ?? row.way ?? `${label} ${description}`)
    );
    const hasOutboundFlag = toBoolean(row.available_outbound);
    const hasReturnFlag = toBoolean(row.available_return);
    const sourceUrl = normalizeWhitespace(String(row.source_url ?? row.variant_url ?? '')) || null;
    const reason = normalizeWhitespace(String(row.reason ?? '')) || null;
    const confidenceRaw = normalizeWhitespace(String(row.confidence ?? '')) || null;

    const amountCents =
      parseAmountCents(row.price) ??
      parseAmountCents(row.amount) ??
      parseAmountCents(row.amount_euros) ??
      parseAmountCents(row.total_price_eur) ??
      parseAmountCents(row.total_price) ??
      parseAmountCents(row.delta_price) ??
      (typeof row.amount_cents === 'number' && Number.isFinite(row.amount_cents)
        ? Math.round(row.amount_cents)
        : null);
    const outboundAmountCents =
      parseAmountCents(row.outbound_price) ??
      parseAmountCents(row.departure_price) ??
      parseAmountCents(row.price_outbound);
    const returnAmountCents =
      parseAmountCents(row.return_price) ??
      parseAmountCents(row.inbound_price) ??
      parseAmountCents(row.price_return);

    if (city && (outboundAmountCents !== null || returnAmountCents !== null)) {
      if (outboundAmountCents !== null) {
        pushOption(city, '', outboundAmountCents, sourceUrl, reason, confidenceRaw, excludedSessionKeys);
      }
      if (returnAmountCents !== null) {
        pushOption('', city, returnAmountCents, sourceUrl, reason, confidenceRaw, excludedSessionKeys);
      }
      continue;
    }

    if (departureCity || returnCity) {
      pushOption(departureCity, returnCity, amountCents, sourceUrl, reason, confidenceRaw, excludedSessionKeys);
      continue;
    }

    if (!city) continue;

    const outboundByText = /\baller\b|\bdepart\b|\boutbound\b/i.test(direction);
    const returnByText = /\bretour\b|\breturn\b|\binbound\b/i.test(direction);
    const isOutbound = hasOutboundFlag || (outboundByText && !returnByText);
    const isReturn = hasReturnFlag || (returnByText && !outboundByText);

    if (isOutbound && !isReturn) {
      pushOption(city, '', amountCents, sourceUrl, reason, confidenceRaw, excludedSessionKeys);
      continue;
    }
    if (isReturn && !isOutbound) {
      pushOption('', city, amountCents, sourceUrl, reason, confidenceRaw, excludedSessionKeys);
      continue;
    }

    pushOption(city, city, amountCents, sourceUrl, reason, confidenceRaw, excludedSessionKeys);
  }

  const accepted = Array.from(output.values()).map((option) => ({
    departureCity: option.departureCity,
    returnCity: option.returnCity,
    amountCents: option.amountCents,
    excludedSessionKeys: option.excludedSessionKeys
  }))
    .sort((left, right) =>
      `${left.departureCity}|${left.returnCity}`.localeCompare(
        `${right.departureCity}|${right.returnCity}`,
        'fr'
      )
    );

  if (rows.length > 0) {
    console.info('[publish-stay-draft] transport options parsing', {
      inputRows: rows.length,
      acceptedRows: accepted.length,
      rejectedRows: rejected.length
    });
  }

  for (const row of rejected) {
    console.warn('[publish-stay-draft] transport option rejetée', row);
  }

  return accepted;
}

function extractSectionFromText(text: string, keys: string[]): string | null {
  const lines = splitTextFragments(text);
  const selected = lines.filter((line) =>
    keys.some((key) => simplifyForMatch(line).includes(simplifyForMatch(key)))
  );
  if (selected.length === 0) return null;
  return selected.join('\n').trim();
}

function pickFirstFragmentByRegex(text: string, regexes: RegExp[]): string | null {
  for (const regex of regexes) {
    const match = regex.exec(text);
    if (match?.[1]) {
      const candidate = sanitizeAccommodationText(match[1], { maxLength: 280 });
      if (candidate) return candidate;
    }
  }
  return null;
}

function cleanupBedInfo(value: string | null): string | null {
  if (!value) return null;
  const cleaned = sanitizeAccommodationText(
    value
      .replace(/^h[ée]bergement\s+en\s+/i, '')
      .replace(/(?:avec|et)\s+(?:sanitaires?|wc|toilettes?|douches?|salles?\s+de\s+bain).*$/i, '')
      .replace(/(?:avec|et)\s+(?:restauration|repas|self|service\s+[aà]\s+table|liaison\s+(?:chaude|froide)).*$/i, '')
      .trim(),
    { maxLength: 220 }
  );
  if (!cleaned) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function cleanupBathroomInfo(value: string | null): string | null {
  if (!value) return null;
  const cleaned = sanitizeAccommodationText(
    value.replace(/^(?:avec|et)\s+/i, '').trim(),
    { maxLength: 220 }
  );
  if (!cleaned) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function cleanupCateringInfo(value: string | null): string | null {
  if (!value) return null;
  const cleaned = sanitizeAccommodationText(
    value.replace(/^(?:avec|et)\s+/i, '').trim(),
    { maxLength: 220 }
  );
  if (!cleaned) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function extractBedInfo(text: string): string | null {
  const direct = pickFirstFragmentByRegex(text, [
    /\b((?:chambres?|dortoirs?|tentes?|mobil[- ]?homes?|chalets?)[^.;\n]{0,140})/i,
    /\b((?:\d{1,2}\s*(?:à|-|a)\s*\d{1,2}\s*lits?|\d{1,2}\s*lits?)[^.;\n]{0,120})/i
  ]);
  if (direct) {
    return cleanupBedInfo(direct);
  }

  const bySection = extractSectionFromText(text, BED_INFO_KEYS);
  return cleanupBedInfo(bySection);
}

function extractBathroomInfo(text: string): string | null {
  const direct = pickFirstFragmentByRegex(text, [
    /\b((?:sanitaires?|wc|toilettes?|douches?|salles?\s+de\s+bain)[^.;\n]{0,150})/i,
    /(?:avec|et)\s+((?:sanitaires?|wc|toilettes?|douches?|salles?\s+de\s+bain)[^.;\n]{0,150})/i
  ]);
  if (direct) {
    return cleanupBathroomInfo(direct);
  }

  const bySection = extractSectionFromText(text, BATHROOM_INFO_KEYS);
  return cleanupBathroomInfo(bySection);
}

function extractCateringInfo(text: string): string | null {
  const direct = pickFirstFragmentByRegex(text, [
    /\b((?:restauration|repas|self|service\s+[aà]\s+table|liaison\s+(?:chaude|froide))[^.;\n]{0,150})/i
  ]);
  if (direct) {
    return cleanupCateringInfo(direct);
  }

  const bySection = extractSectionFromText(text, CATERING_INFO_KEYS);
  return cleanupCateringInfo(bySection);
}

function normalizeAccommodationAccessibility(value: string | null | undefined): string | null {
  const normalized = sanitizeAccommodationText(value, { maxLength: 220 });
  if (!normalized) return null;
  const key = simplifyForMatch(normalized);
  if (!ACCESSIBILITY_KEYS.some((token) => key.includes(simplifyForMatch(token)))) {
    return null;
  }
  return normalized;
}

function normalizeAccommodationType(value: string | null | undefined, fallbackText: string): string {
  const raw = simplifyForMatch(sanitizeAccommodationText(value, { maxLength: 80 }) ?? '');
  if (raw === 'camping') return 'camping';
  if (raw.includes('auberge')) return 'auberge de jeunesse';
  if (raw.includes('famille')) return "famille d'accueil";
  if (raw.includes('gite')) return 'gite';
  if (raw === 'mixte') return 'mixte';
  if (raw === 'centre') return 'centre';

  const fallback = simplifyForMatch(fallbackText);
  if (fallback.includes('camping') || fallback.includes('tente')) return 'camping';
  if (fallback.includes('auberge')) return 'auberge de jeunesse';
  if (fallback.includes('famille d accueil')) return "famille d'accueil";
  if (fallback.includes('gite')) return 'gite';
  return 'centre';
}

function readImportedExistingAccommodationId(rawPayload: Record<string, unknown>): string | null {
  const importOptions = rawPayload.import_options;
  if (!isPlainObject(importOptions)) return null;
  return typeof importOptions.existing_accommodation_id === 'string' &&
    importOptions.existing_accommodation_id.trim().length > 0
    ? importOptions.existing_accommodation_id.trim()
    : null;
}

function parseAccommodation(
  value: Json | null,
  context?: { locationText?: string | null }
): {
  title: string;
  description: string | null;
  bedInfo: string | null;
  bathroomInfo: string | null;
  cateringInfo: string | null;
  accessibilityInfo: string | null;
  accommodationType: string;
  centerLatitude: number | null;
  centerLongitude: number | null;
} | null {
  const object = coerceAccommodationJsonObject(value);
  if (Object.keys(object).length === 0) return null;

  const titleRaw =
    object.title ?? object.nom ?? object.name ?? object.nom_hebergement ?? object.nom_de_l_hebergement ?? '';
  const title = sanitizeAccommodationText(String(titleRaw), { maxLength: 160 });
  const descriptionRaw = sanitizeAccommodationText(String(object.description ?? ''), { maxLength: 2_200 });
  const descriptionText = descriptionRaw ?? '';
  const locationHint = sanitizeAccommodationText(
    String(object.location ?? object.location_text ?? object.city ?? context?.locationText ?? ''),
    { maxLength: 120 }
  );
  const sourceText = [title, descriptionText].filter(Boolean).join('\n');

  const typesFromJson = Array.isArray(object.accommodation_types)
    ? object.accommodation_types.filter((item): item is string => typeof item === 'string')
    : [];
  const normalizedTypes = typesFromJson
    .map((t) => normalizeAccommodationTypeToken(t))
    .filter((t): t is string => Boolean(t));
  const uniqueTypes = Array.from(new Set(normalizedTypes));

  const bedInfo =
    cleanupBedInfo(sanitizeAccommodationText(String(object.bed_info ?? object.sleeping_info ?? ''), { maxLength: 220 })) ??
    extractBedInfo(sourceText);
  const bathroomInfo =
    cleanupBathroomInfo(sanitizeAccommodationText(String(object.bathroom_info ?? object.sanitary_info ?? ''), { maxLength: 220 })) ??
    extractBathroomInfo(sourceText);
  const cateringInfo =
    cleanupCateringInfo(sanitizeAccommodationText(String(object.catering_info ?? object.food_info ?? ''), { maxLength: 220 })) ??
    extractCateringInfo(sourceText);
  let accessibilityInfo = normalizeAccommodationAccessibility(
    sanitizeAccommodationText(String(object.accessibility_info ?? object.pmr_info ?? ''), { maxLength: 220 }) ??
      extractSectionFromText(sourceText, ACCESSIBILITY_KEYS)
  );
  const pmrFlag =
    object.pmr_accessible === true ||
    object.pmr_accessible === 'true' ||
    object.pmr_accessible === 1 ||
    object.pmr_accessible === '1';
  if (pmrFlag) {
    const pmrPhrase = 'Repéré comme accessible aux personnes à mobilité réduite (PMR).';
    accessibilityInfo = accessibilityInfo ? `${accessibilityInfo} ${pmrPhrase}` : pmrPhrase;
  }

  const accommodationTypeFromList =
    uniqueTypes.length > 1 ? 'mixte' : uniqueTypes.length === 1 ? uniqueTypes[0]! : null;
  const accommodationType =
    accommodationTypeFromList ??
    normalizeAccommodationType(
      sanitizeAccommodationText(String(object.accommodation_type ?? ''), { maxLength: 80 }),
      [title, descriptionText, bedInfo, locationHint].filter(Boolean).join(' ')
    );

  const locationModeNorm = normalizeLocationMode(object.location_mode);
  const description = embedAccommodationLocationMeta(descriptionRaw, {
    locationMode: locationModeNorm ?? '',
    locationCity: sanitizeAccommodationText(String(object.location_city ?? ''), { maxLength: 120 }),
    locationDepartmentCode: sanitizeAccommodationText(String(object.location_department_code ?? ''), {
      maxLength: 8
    }),
    locationCountry: sanitizeAccommodationText(String(object.location_country ?? ''), { maxLength: 80 }),
    itinerantZone: sanitizeAccommodationText(String(object.itinerant_zone ?? ''), { maxLength: 200 })
  });
  const resolvedName = buildAccommodationName({
    title,
    description: descriptionText,
    locationHint,
    accommodationType
  });
  const centerCoordinates = validateAndParseAccommodationCenterCoordinates({
    centerLatitude: toNullableNumber(
      object.center_latitude ?? object.latitude ?? object.lat
    ),
    centerLongitude: toNullableNumber(
      object.center_longitude ?? object.longitude ?? object.lng ?? object.lon
    )
  });

  if (!resolvedName && !description && !bedInfo && !bathroomInfo && !cateringInfo && !accessibilityInfo) {
    return null;
  }

  return {
    title: resolvedName || "Centre d'hébergement",
    description,
    bedInfo,
    bathroomInfo,
    cateringInfo,
    accessibilityInfo,
    accommodationType,
    centerLatitude: centerCoordinates.error ? null : centerCoordinates.value.centerLatitude,
    centerLongitude: centerCoordinates.error ? null : centerCoordinates.value.centerLongitude
  };
}

function readLivePublication(rawPayload: Record<string, unknown>): {
  stayId: string | null;
  accommodationId: string | null;
} {
  const live = rawPayload.live_publication;
  if (!isPlainObject(live)) {
    return { stayId: null, accommodationId: null };
  }

  return {
    stayId: typeof live.stay_id === 'string' ? live.stay_id : null,
    accommodationId: typeof live.accommodation_id === 'string' ? live.accommodation_id : null
  };
}

function readDraftAccommodationPreviewId(rawPayload: Record<string, unknown>): string | null {
  const preview = rawPayload.draft_accommodation_preview;
  if (!isPlainObject(preview)) return null;
  const id = preview.accommodation_id;
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null;
}

function seasonNameFromMonth(month: number): 'Hiver' | 'Printemps' | 'Été' | 'Automne' {
  if (month >= 12 || month <= 2) return 'Hiver';
  if (month >= 3 && month <= 5) return 'Printemps';
  if (month >= 6 && month <= 8) return 'Été';
  return 'Automne';
}

function resolveSeasonNameFromSessions(
  sessions: Array<{ startDate: string; endDate: string; status: SessionStatus; priceCents: number | null; currency: string }>
): 'Hiver' | 'Printemps' | 'Été' | 'Automne' | null {
  if (sessions.length === 0) return null;
  const counts = new Map<'Hiver' | 'Printemps' | 'Été' | 'Automne', number>([
    ['Hiver', 0],
    ['Printemps', 0],
    ['Été', 0],
    ['Automne', 0]
  ]);

  for (const session of sessions) {
    const date = new Date(`${session.startDate}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) continue;
    const seasonName = seasonNameFromMonth(date.getUTCMonth() + 1);
    counts.set(seasonName, (counts.get(seasonName) ?? 0) + 1);
  }

  const ordered = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (!ordered.length || ordered[0][1] === 0) return null;
  return ordered[0][0];
}

async function resolveSeasonIdFromSessions(
  supabase: SupabaseClient<Database>,
  sessions: Array<{ startDate: string; endDate: string; status: SessionStatus; priceCents: number | null; currency: string }>
): Promise<string> {
  const { data: seasons, error } = await supabase.from('seasons').select('id,name');
  if (error) {
    throw new PublishStayDraftError('resolve-season', error.message);
  }

  const list = seasons ?? [];
  if (list.length === 0) {
    throw new PublishStayDraftError('resolve-season', 'Aucune saison disponible.');
  }

  const targetName = resolveSeasonNameFromSessions(sessions) ?? seasonNameFromMonth(new Date().getMonth() + 1);

  return list.find((season) => season.name === targetName)?.id ?? list[0].id;
}

async function findExistingStayBySourceUrl(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  sourceUrl: string
): Promise<string | null> {
  const dynamicFrom = supabase.from('stays') as unknown as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          limit: (value: number) => {
            maybeSingle: () => Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
          };
        };
      };
    };
  };

  try {
    const { data, error } = await dynamicFrom
      .select('id')
      .eq('organizer_id', organizerId)
      .eq('source_url', sourceUrl)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error.message, 'source_url')) {
        return null;
      }
      throw new PublishStayDraftError('find-stay-by-source-url', error.message ?? 'Erreur inconnue.');
    }

    return data?.id ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue.';
    if (isMissingColumnError(message, 'source_url')) {
      return null;
    }
    throw new PublishStayDraftError('find-stay-by-source-url', message);
  }
}

async function updateOrInsertStay(
  supabase: SupabaseClient<Database>,
  draft: StayDraftRow,
  stayId: string | null,
  mappedCategories: string[],
  ages: number[],
  transportMode: string,
  sessions: Array<{ startDate: string; endDate: string; status: SessionStatus; priceCents: number | null; currency: string }>
): Promise<string> {
  const now = new Date().toISOString();
  const draftRawPayload = asObject(draft.raw_payload);
  const partnerDiscountPercent = readPartnerDiscountPercentFromRawPayload(draftRawPayload);
  const ageMin = ages.length > 0 ? ages[0] : draft.age_min;
  const ageMax = ages.length > 0 ? ages[ages.length - 1] : draft.age_max;
  const normalizedTitle = normalizeStayTitle(draft.title);
  const normalizedRegion = mapToCanonicalStayRegion(draft.region_text);
  const seasonId = await resolveSeasonIdFromSessions(supabase, sessions);

  let previousStatus: string | null | undefined;
  if (stayId) {
    const { data: existingStay } = await supabase.from('stays').select('status').eq('id', stayId).maybeSingle();
    previousStatus = existingStay?.status ?? undefined;
  }

  const basePayload: StayUpdate = {
    title: normalizedTitle,
    description: toNullableText(draft.description),
    summary: toNullableText(draft.summary),
    activities_text: toNullableText(draft.activities_text),
    program_text: toNullableText(draft.program_text),
    supervision_text: toNullableText(draft.supervision_text),
    required_documents_text: toNullableText(draft.required_documents_text),
    location_text: toNullableText(draft.location_text),
    region_text: normalizedRegion ?? null,
    season_id: seasonId,
    age_min: ageMin ?? null,
    age_max: ageMax ?? null,
    ages,
    categories: mappedCategories,
    transport_mode: transportMode,
    transport_text: toNullableText(draft.transport_text),
    partner_discount_percent: partnerDiscountPercent,
    seo_primary_keyword: toNullableText(draft.seo_primary_keyword),
    seo_secondary_keywords: draft.seo_secondary_keywords ?? [],
    seo_target_city: toNullableText(draft.seo_target_city),
    seo_target_region: toNullableText(draft.seo_target_region),
    seo_search_intents: draft.seo_search_intents ?? [],
    seo_title: toNullableText(draft.seo_title),
    seo_meta_description: toNullableText(draft.seo_meta_description),
    seo_intro_text: toNullableText(draft.seo_intro_text),
    seo_h1_variant: toNullableText(draft.seo_h1_variant),
    seo_internal_link_anchor_suggestions: draft.seo_internal_link_anchor_suggestions ?? [],
    seo_slug_candidate: toNullableText(draft.seo_slug_candidate),
    seo_generated_at: draft.seo_generated_at ?? null,
    seo_generation_source: toNullableText(draft.seo_generation_source),
    seo_score: Number.isFinite(draft.seo_score) ? draft.seo_score : null,
    seo_checks: Array.isArray(draft.seo_checks) ? draft.seo_checks : [],
    status: 'PUBLISHED' as StayStatus,
    updated_at: now
  };

  if (!basePayload.title) {
    throw new PublishStayDraftError('validate-title', 'Le titre est requis pour publier.');
  }

  if (stayId) {
    const updateWithSourceUrl = {
      ...basePayload,
      source_url: draft.source_url
    };

    const dynamicUpdate = supabase.from('stays') as unknown as {
      update: (payload: Record<string, unknown>) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
        };
      };
    };

    const firstTry = await dynamicUpdate
      .update(updateWithSourceUrl)
      .eq('id', stayId)
      .eq('organizer_id', draft.organizer_id);

    const missingSourceUrl = isMissingColumnError(firstTry.error?.message, 'source_url');
    const missingSeoColumns = isMissingSeoColumnError(firstTry.error?.message);

    if (firstTry.error && !missingSourceUrl && !missingSeoColumns) {
      throw new PublishStayDraftError('update-stay', firstTry.error.message ?? 'Impossible de mettre à jour le séjour.');
    }

    if (firstTry.error) {
      const fallbackPayload = missingSeoColumns
        ? removeSeoFieldsFromPayload(basePayload as Record<string, unknown>)
        : (basePayload as Record<string, unknown>);

      let { error: fallbackError } = await supabase
        .from('stays')
        .update(fallbackPayload)
        .eq('id', stayId)
        .eq('organizer_id', draft.organizer_id);

      if (fallbackError && !missingSeoColumns && isMissingSeoColumnError(fallbackError.message)) {
        const withoutSeoPayload = removeSeoFieldsFromPayload(basePayload as Record<string, unknown>);
        const secondFallback = await supabase
          .from('stays')
          .update(withoutSeoPayload)
          .eq('id', stayId)
          .eq('organizer_id', draft.organizer_id);
        fallbackError = secondFallback.error;
      }

      if (fallbackError) {
        throw new PublishStayDraftError('update-stay', fallbackError.message);
      }
    }

    await maybeRecordPublicationFeeWhenStayPublished(supabase, {
      stayId,
      organizerId: draft.organizer_id,
      previousStatus,
      newStatus: 'PUBLISHED',
      occurredAt: now
    });
    return stayId;
  }

  const insertPayload: StayInsert = {
    organizer_id: draft.organizer_id,
    season_id: seasonId,
    title: basePayload.title,
    description: basePayload.description ?? null,
    summary: basePayload.summary ?? null,
    activities_text: basePayload.activities_text ?? null,
    program_text: basePayload.program_text ?? null,
    supervision_text: basePayload.supervision_text ?? null,
    required_documents_text: basePayload.required_documents_text ?? null,
    location_text: basePayload.location_text ?? null,
    region_text: basePayload.region_text ?? null,
    age_min: basePayload.age_min ?? null,
    age_max: basePayload.age_max ?? null,
    ages,
    categories: mappedCategories,
    transport_mode: transportMode,
    transport_text: basePayload.transport_text ?? null,
    partner_discount_percent: partnerDiscountPercent,
    seo_primary_keyword: basePayload.seo_primary_keyword ?? null,
    seo_secondary_keywords: basePayload.seo_secondary_keywords ?? [],
    seo_target_city: basePayload.seo_target_city ?? null,
    seo_target_region: basePayload.seo_target_region ?? null,
    seo_search_intents: basePayload.seo_search_intents ?? [],
    seo_title: basePayload.seo_title ?? null,
    seo_meta_description: basePayload.seo_meta_description ?? null,
    seo_intro_text: basePayload.seo_intro_text ?? null,
    seo_h1_variant: basePayload.seo_h1_variant ?? null,
    seo_internal_link_anchor_suggestions: basePayload.seo_internal_link_anchor_suggestions ?? [],
    seo_slug_candidate: basePayload.seo_slug_candidate ?? null,
    seo_generated_at: basePayload.seo_generated_at ?? null,
    seo_generation_source: basePayload.seo_generation_source ?? null,
    seo_score: basePayload.seo_score ?? null,
    seo_checks: basePayload.seo_checks ?? [],
    status: 'PUBLISHED'
  };

  const dynamicInsert = supabase.from('stays') as unknown as {
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
      };
    };
  };

  const insertWithSourceUrl = {
    ...insertPayload,
    source_url: draft.source_url
  };

  const firstTry = await dynamicInsert.insert(insertWithSourceUrl).select('id').single();
  const missingSourceUrl = isMissingColumnError(firstTry.error?.message, 'source_url');
  const missingSeoColumns = isMissingSeoColumnError(firstTry.error?.message);

  if (firstTry.error && !missingSourceUrl && !missingSeoColumns) {
    throw new PublishStayDraftError('insert-stay', firstTry.error.message ?? 'Impossible de créer le séjour.');
  }

  if (!firstTry.error && firstTry.data?.id) {
    const newId = firstTry.data.id;
    await maybeRecordPublicationFeeWhenStayPublished(supabase, {
      stayId: newId,
      organizerId: draft.organizer_id,
      previousStatus,
      newStatus: 'PUBLISHED',
      occurredAt: now
    });
    return newId;
  }

  let fallbackPayload = insertPayload as Record<string, unknown>;
  if (missingSeoColumns) {
    fallbackPayload = removeSeoFieldsFromPayload(fallbackPayload);
  }

  let fallbackTry = await supabase.from('stays').insert(fallbackPayload as StayInsert).select('id').single();
  if ((fallbackTry.error || !fallbackTry.data?.id) && !missingSeoColumns && isMissingSeoColumnError(fallbackTry.error?.message)) {
    const withoutSeoPayload = removeSeoFieldsFromPayload(insertPayload as Record<string, unknown>);
    fallbackTry = await supabase.from('stays').insert(withoutSeoPayload as StayInsert).select('id').single();
  }

  if (fallbackTry.error || !fallbackTry.data?.id) {
    throw new PublishStayDraftError('insert-stay', fallbackTry.error?.message ?? 'Impossible de créer le séjour.');
  }

  const newId = fallbackTry.data.id;
  await maybeRecordPublicationFeeWhenStayPublished(supabase, {
    stayId: newId,
    organizerId: draft.organizer_id,
    previousStatus,
    newStatus: 'PUBLISHED',
    occurredAt: now
  });
  return newId;
}

async function syncSessions(
  supabase: SupabaseClient<Database>,
  stayId: string,
  sessions: Array<{ startDate: string; endDate: string; status: SessionStatus; priceCents: number | null; currency: string; remainingPlaces: number | null }>
): Promise<void> {
  const { data: existingSessions, error: listError } = await supabase
    .from('sessions')
    .select('id')
    .eq('stay_id', stayId);

  if (listError) {
    throw new PublishStayDraftError('list-sessions', listError.message);
  }

  const existingSessionIds = (existingSessions ?? []).map((item) => item.id);

  if (existingSessionIds.length > 0) {
    const { error: deletePricesError } = await supabase
      .from('session_prices')
      .delete()
      .in('session_id', existingSessionIds);

    if (deletePricesError) {
      throw new PublishStayDraftError('delete-session-prices', deletePricesError.message);
    }
  }

  const { error: deleteSessionsError } = await supabase
    .from('sessions')
    .delete()
    .eq('stay_id', stayId);

  if (deleteSessionsError) {
    throw new PublishStayDraftError('delete-sessions', deleteSessionsError.message);
  }

  for (const session of sessions) {
    const insertSessionPayload: SessionInsert = {
      stay_id: stayId,
      start_date: session.startDate,
      end_date: session.endDate,
      status: session.status,
      capacity_total: session.remainingPlaces ?? 0,
      capacity_reserved: 0
    };

    const { data: createdSession, error: createSessionError } = await supabase
      .from('sessions')
      .insert(insertSessionPayload)
      .select('id')
      .single();

    if (createSessionError || !createdSession) {
      throw new PublishStayDraftError(
        'insert-session',
        createSessionError?.message ?? 'Impossible de créer une session.'
      );
    }

    if (session.priceCents !== null) {
      const { error: priceError } = await supabase.from('session_prices').insert({
        session_id: createdSession.id,
        amount_cents: session.priceCents,
        currency: session.currency || 'EUR'
      });

      if (priceError) {
        throw new PublishStayDraftError('insert-session-price', priceError.message);
      }
    }
  }
}

export async function syncStayMedia(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  stayId: string,
  images: string[]
): Promise<void> {
  const { data: existingRows, error: existingRowsError } = await supabase
    .from('stay_media')
    .select('url')
    .eq('stay_id', stayId);

  if (existingRowsError) {
    throw new PublishStayDraftError('read-stay-media', existingRowsError.message);
  }

  const nextUrls = await uploadImportedStayImages(supabase, {
    organizerId,
    stayId,
    imageUrls: images
  });
  const previousUrls = (existingRows ?? []).map((row) => row.url).filter(Boolean);

  const { error: deleteError } = await supabase.from('stay_media').delete().eq('stay_id', stayId);
  if (deleteError) {
    throw new PublishStayDraftError('delete-stay-media', deleteError.message);
  }

  const urlsToRemove = previousUrls.filter((url) => !nextUrls.includes(url));
  if (urlsToRemove.length > 0) {
    try {
      await removeStayMediaStorageFiles(supabase, urlsToRemove);
    } catch (error) {
      console.warn('[publish-stay-draft] stale stay media cleanup failed', {
        stayId,
        error: error instanceof Error ? error.message : 'unknown-error'
      });
    }
  }

  if (nextUrls.length === 0) {
    return;
  }

  const rows: StayMediaInsert[] = nextUrls.map((url, index) => ({
    stay_id: stayId,
    url,
    position: index + 1,
    media_type: index === 0 ? 'cover' : 'gallery'
  }));

  const { error: insertError } = await supabase.from('stay_media').insert(rows);
  if (insertError) {
    throw new PublishStayDraftError('insert-stay-media', insertError.message);
  }
}

export async function syncExtraOptions(
  supabase: SupabaseClient<Database>,
  stayId: string,
  options: Array<{ label: string; amountCents: number }>
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('stay_extra_options')
    .delete()
    .eq('stay_id', stayId);

  if (deleteError) {
    throw new PublishStayDraftError('delete-extra-options', deleteError.message);
  }

  if (options.length === 0) {
    return;
  }

  const rows: ExtraOptionInsert[] = options.map((option, index) => ({
    stay_id: stayId,
    label: option.label,
    amount_cents: option.amountCents,
    position: index + 1
  }));

  const { error: insertError } = await supabase.from('stay_extra_options').insert(rows);
  if (insertError) {
    throw new PublishStayDraftError('insert-extra-options', insertError.message);
  }
}

export async function syncInsuranceOptions(
  supabase: SupabaseClient<Database>,
  stayId: string,
  options: Array<{ label: string; pricingMode: 'FIXED' | 'PERCENT'; amountCents: number | null; percentValue: number | null }>
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('insurance_options')
    .delete()
    .eq('stay_id', stayId);

  if (deleteError) {
    throw new PublishStayDraftError('delete-insurance-options', deleteError.message);
  }

  if (options.length === 0) {
    return;
  }

  const rows: InsuranceOptionInsert[] = options.map((option) => ({
    stay_id: stayId,
    session_id: null,
    label: option.label,
    pricing_mode: option.pricingMode,
    amount_cents: option.pricingMode === 'FIXED' ? option.amountCents : null,
    percent_value: option.pricingMode === 'PERCENT' ? option.percentValue : null,
    rules_json: {}
  }));

  const { error: insertError } = await supabase.from('insurance_options').insert(rows);
  if (insertError) {
    throw new PublishStayDraftError('insert-insurance-options', insertError.message);
  }
}

export async function syncTransportOptions(
  supabase: SupabaseClient<Database>,
  stayId: string,
  options: ParsedTransportOption[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('transport_options')
    .delete()
    .eq('stay_id', stayId);

  if (deleteError) {
    throw new PublishStayDraftError('delete-transport-options', deleteError.message);
  }

  if (options.length === 0) {
    return;
  }

  const { data: liveSessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id,start_date,end_date')
    .eq('stay_id', stayId)
    .order('start_date', { ascending: true });

  if (sessionsError) {
    throw new PublishStayDraftError('list-sessions-for-transport', sessionsError.message);
  }

  const sessions = liveSessions ?? [];
  const rows: TransportOptionInsert[] = [];

  for (const option of options) {
    const excluded = new Set(option.excludedSessionKeys ?? []);
    const includedSessions = sessions.filter((s, i) => !excluded.has(liveSessionStableKey(s, i)));

    if (includedSessions.length === 0) {
      continue;
    }

    const base = {
      stay_id: stayId,
      departure_city: option.departureCity,
      return_city: option.returnCity,
      amount_cents: option.amountCents
    };

    if (sessions.length === 0) {
      rows.push({ ...base, session_id: null });
      continue;
    }

    if (includedSessions.length === sessions.length) {
      rows.push({ ...base, session_id: null });
    } else {
      for (const s of includedSessions) {
        rows.push({ ...base, session_id: s.id });
      }
    }
  }

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from('transport_options').insert(rows);
  if (insertError) {
    throw new PublishStayDraftError('insert-transport-options', insertError.message);
  }
}

async function syncAccommodation(
  supabase: SupabaseClient<Database>,
  draft: StayDraftRow,
  stayId: string,
  currentAccommodationId: string | null,
  extractedAccommodationSource: Json | null,
  parsedAccommodation: {
    title: string;
    description: string | null;
    bedInfo: string | null;
    bathroomInfo: string | null;
    cateringInfo: string | null;
    accessibilityInfo: string | null;
    accommodationType: string;
    centerLatitude: number | null;
    centerLongitude: number | null;
  } | null
): Promise<string | null> {
  const { error: deleteLinksError } = await supabase
    .from('stay_accommodations')
    .delete()
    .eq('stay_id', stayId);

  if (deleteLinksError) {
    throw new PublishStayDraftError('delete-stay-accommodations', deleteLinksError.message);
  }

  if (!parsedAccommodation) {
    if (!currentAccommodationId) {
      return null;
    }

    const { data: existingAccommodation, error: existingAccommodationError } = await supabase
      .from('accommodations')
      .select('id')
      .eq('id', currentAccommodationId)
      .eq('organizer_id', draft.organizer_id)
      .maybeSingle();

    if (existingAccommodationError) {
      throw new PublishStayDraftError(
        'resolve-existing-accommodation',
        existingAccommodationError.message
      );
    }

    if (!existingAccommodation?.id) {
      throw new PublishStayDraftError(
        'resolve-existing-accommodation',
        "L'hébergement sélectionné pour le draft est introuvable."
      );
    }

    const { error: relinkError } = await supabase.from('stay_accommodations').insert({
      stay_id: stayId,
      accommodation_id: currentAccommodationId
    });
    if (relinkError) {
      throw new PublishStayDraftError('relink-stay-accommodation', relinkError.message);
    }

    return currentAccommodationId;
  }

  const now = new Date().toISOString();
  let accommodationId = currentAccommodationId;
  const accommodationValidatedAt = draft.validated_at ?? now;
  const accommodationValidatedByUserId = draft.validated_by_user_id ?? null;
  const extractedData: Json = {
    source: 'stay_draft_publication',
    draft_id: draft.id,
    stay_id: stayId,
    source_url: draft.source_url ?? null,
    extracted_accommodation: extractedAccommodationSource
  };

  if (accommodationId) {
    const updatePayload: AccommodationUpdate = {
      name: parsedAccommodation.title,
      description: parsedAccommodation.description,
      bed_info: parsedAccommodation.bedInfo,
      bathroom_info: parsedAccommodation.bathroomInfo,
      catering_info: parsedAccommodation.cateringInfo,
      accessibility_info: parsedAccommodation.accessibilityInfo,
      accommodation_type: parsedAccommodation.accommodationType,
      center_latitude: parsedAccommodation.centerLatitude,
      center_longitude: parsedAccommodation.centerLongitude,
      source_url: draft.source_url,
      ai_extracted_data: extractedData,
      status: 'VALIDATED',
      validated_at: accommodationValidatedAt,
      validated_by_user_id: accommodationValidatedByUserId,
      updated_at: now
    };

    const { data: updatedAccommodation, error: updateError } = await supabase
      .from('accommodations')
      .update(updatePayload)
      .eq('id', accommodationId)
      .eq('organizer_id', draft.organizer_id)
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw new PublishStayDraftError('update-accommodation', updateError.message);
    }

    if (!updatedAccommodation?.id) {
      accommodationId = null;
    }
  }

  if (!accommodationId) {
    const insertPayload: AccommodationInsert = {
      organizer_id: draft.organizer_id,
      name: parsedAccommodation.title,
      description: parsedAccommodation.description,
      bed_info: parsedAccommodation.bedInfo,
      bathroom_info: parsedAccommodation.bathroomInfo,
      catering_info: parsedAccommodation.cateringInfo,
      accessibility_info: parsedAccommodation.accessibilityInfo,
      source_url: draft.source_url,
      accommodation_type: parsedAccommodation.accommodationType,
      center_latitude: parsedAccommodation.centerLatitude,
      center_longitude: parsedAccommodation.centerLongitude,
      ai_extracted_data: extractedData,
      status: 'VALIDATED',
      validated_at: accommodationValidatedAt,
      validated_by_user_id: accommodationValidatedByUserId,
      created_at: now,
      updated_at: now
    };

    const { data: insertedAccommodation, error: insertError } = await supabase
      .from('accommodations')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError || !insertedAccommodation) {
      throw new PublishStayDraftError(
        'insert-accommodation',
        insertError?.message ?? "Impossible de créer l'hébergement."
      );
    }

    accommodationId = insertedAccommodation.id;
  }

  const { error: insertLinkError } = await supabase.from('stay_accommodations').insert({
    stay_id: stayId,
    accommodation_id: accommodationId
  });

  if (insertLinkError) {
    throw new PublishStayDraftError('insert-stay-accommodation-link', insertLinkError.message);
  }

  return accommodationId;
}

/**
 * Crée ou met à jour une fiche hébergement « brouillon » (statut DRAFT) à chaque sauvegarde du stay_draft,
 * pour qu’elle apparaisse tout de suite dans la liste des hébergements organisateur.
 */
export async function syncStayDraftPreviewAccommodation(
  supabase: SupabaseClient<Database>,
  draft: StayDraftRow
): Promise<StayDraftRow> {
  const rawPayload = asObject(draft.raw_payload);
  if (readImportedExistingAccommodationId(rawPayload)) {
    return draft;
  }

  const rawAiExtracted = isPlainObject(rawPayload.ai_extracted) ? rawPayload.ai_extracted : null;
  const accommodationSource =
    draft.accommodations_json ?? (rawAiExtracted?.accommodations_json as Json | undefined) ?? null;

  const parsed = parseAccommodation(accommodationSource, {
    locationText: draft.location_text
  });

  if (!parsed) {
    return draft;
  }

  const previewId = readDraftAccommodationPreviewId(rawPayload);
  const now = new Date().toISOString();
  const extractedData: Json = {
    source: 'stay_draft_save_preview',
    draft_id: draft.id,
    source_url: draft.source_url ?? null,
    extracted_accommodation: accommodationSource
  };

  let accommodationId: string | null = previewId;

  if (accommodationId) {
    const updatePayload: AccommodationUpdate = {
      name: parsed.title,
      description: parsed.description,
      bed_info: parsed.bedInfo,
      bathroom_info: parsed.bathroomInfo,
      catering_info: parsed.cateringInfo,
      accessibility_info: parsed.accessibilityInfo,
      accommodation_type: parsed.accommodationType,
      center_latitude: parsed.centerLatitude,
      center_longitude: parsed.centerLongitude,
      source_url: draft.source_url,
      ai_extracted_data: extractedData,
      status: 'DRAFT',
      validated_at: null,
      validated_by_user_id: null,
      updated_at: now
    };

    const { data: updated, error } = await supabase
      .from('accommodations')
      .update(updatePayload)
      .eq('id', accommodationId)
      .eq('organizer_id', draft.organizer_id)
      .select('id')
      .maybeSingle();

    if (error || !updated?.id) {
      accommodationId = null;
    }
  }

  if (!accommodationId) {
    const insertPayload: AccommodationInsert = {
      organizer_id: draft.organizer_id,
      name: parsed.title,
      description: parsed.description,
      bed_info: parsed.bedInfo,
      bathroom_info: parsed.bathroomInfo,
      catering_info: parsed.cateringInfo,
      accessibility_info: parsed.accessibilityInfo,
      source_url: draft.source_url,
      accommodation_type: parsed.accommodationType,
      center_latitude: parsed.centerLatitude,
      center_longitude: parsed.centerLongitude,
      ai_extracted_data: extractedData,
      status: 'DRAFT',
      validated_at: null,
      validated_by_user_id: null,
      created_at: now,
      updated_at: now
    };

    const { data: inserted, error: insertError } = await supabase
      .from('accommodations')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError || !inserted?.id) {
      console.error('[stay-draft-preview-accommodation] insert failed', insertError?.message);
      return draft;
    }

    accommodationId = inserted.id;
  }

  const nextRaw: Record<string, unknown> = {
    ...rawPayload,
    draft_accommodation_preview: {
      accommodation_id: accommodationId,
      updated_at: now
    }
  };

  const { data: updatedDraft, error: draftError } = await supabase
    .from('stay_drafts')
    .update({ raw_payload: nextRaw as Json })
    .eq('id', draft.id)
    .eq('organizer_id', draft.organizer_id)
    .select('*')
    .maybeSingle();

  if (draftError || !updatedDraft) {
    console.error('[stay-draft-preview-accommodation] draft raw_payload update failed', draftError?.message);
    return draft;
  }

  return updatedDraft as StayDraftRow;
}

async function resolveStayId(
  supabase: SupabaseClient<Database>,
  draft: StayDraftRow,
  rawPayload: Record<string, unknown>
): Promise<string | null> {
  const livePublication = readLivePublication(rawPayload);

  if (livePublication.stayId) {
    const { data: linkedStay, error } = await supabase
      .from('stays')
      .select('id')
      .eq('id', livePublication.stayId)
      .eq('organizer_id', draft.organizer_id)
      .maybeSingle();

    if (error) {
      throw new PublishStayDraftError('resolve-linked-stay', error.message);
    }

    if (linkedStay?.id) {
      return linkedStay.id;
    }
  }

  const bySourceUrl = await findExistingStayBySourceUrl(supabase, draft.organizer_id, draft.source_url);
  if (bySourceUrl) {
    return bySourceUrl;
  }

  return null;
}

export async function publishStayDraftToLive(
  input: PublishStayDraftToLiveInput
): Promise<PublishStayDraftToLiveResult> {
  const { supabase, draft } = input;
  console.info('[publish-stay-draft] entrée', {
    draftId: draft.id,
    organizerId: draft.organizer_id,
    status: draft.status,
    validatedAt: draft.validated_at
  });

  if (draft.status !== 'validated') {
    throw new PublishStayDraftError(
      'validate-draft-status',
      "Le draft doit être validé avant la publication live."
    );
  }

  const title = normalizeStayTitle(draft.title ?? '');
  if (!title) {
    throw new PublishStayDraftError('validate-title', 'Le titre est requis pour publier.');
  }

  const rawPayload = asObject(draft.raw_payload);
  const livePublication = readLivePublication(rawPayload);
  const importedExistingAccommodationId = readImportedExistingAccommodationId(rawPayload);
  const categoryMapping = mapDraftCategoriesToLiveCategories(draft.categories);
  const categoryInferenceSource = [
    draft.summary,
    draft.activities_text,
    draft.program_text,
    draft.description,
    draft.title
  ]
    .map((value) => normalizeWhitespace(value ?? ''))
    .filter(Boolean)
    .join('\n');
  const inferredCategories = inferLiveCategoriesFromContent(categoryInferenceSource);
  const mergedCategories = Array.from(
    new Set(
      categoryMapping.liveValues.length > 0
        ? [...categoryMapping.liveValues, ...inferredCategories]
        : inferredCategories
    )
  );
  const categories = ensurePrimaryStaySettingCategory(
    mergedCategories,
    [draft.location_text, draft.region_text, draft.summary, draft.description, draft.program_text].join(' ')
  );
  const ages = normalizeAges(draft.ages, draft.age_min, draft.age_max);
  const rawAiExtracted = isPlainObject(rawPayload.ai_extracted) ? rawPayload.ai_extracted : null;
  const sessionsSource =
    draft.sessions_json ??
    (rawAiExtracted?.sessions_json as Json | undefined) ??
    null;
  const sessions = parseSessions(sessionsSource);
  const { extraOptions, insuranceOptions } = parseExtraAndInsuranceOptions(draft, rawPayload);
  const transportSource =
    (rawPayload.transport_variants as Json | undefined) ??
    (rawPayload.transport_price_debug as Json | undefined) ??
    (rawPayload.transport_matrix as Json | undefined) ??
    draft.transport_options_json ??
    (rawAiExtracted?.transport_options_json as Json | undefined) ??
    null;
  const transportOptions = parseTransportOptionsFromJson(transportSource);
  const accommodationSource = importedExistingAccommodationId
    ? null
    : draft.accommodations_json ??
      (rawAiExtracted?.accommodations_json as Json | undefined) ??
      null;
  const accommodation = parseAccommodation(accommodationSource, {
    locationText: draft.location_text
  });
  const images = Array.from(
    new Set(asStringArray(draft.images).filter((url) => /^https?:\/\//i.test(url)))
  ).slice(0, 20);
  console.info('[publish-stay-draft] mapping catégories', {
    draftId: draft.id,
    draftCategories: categoryMapping.draftReceived,
    liveCategories: categoryMapping.liveLabels,
    inferredCategories: inferredCategories.map((value) => categoryValueToLogLabel(value)),
    rejectedCategories: categoryMapping.rejected
  });
  if (categories.length === 0) {
    console.warn('[publish-stay-draft] no-valid-live-category-after-mapping', {
      draftId: draft.id,
      draftCategories: categoryMapping.draftReceived
    });
  }
  console.info('[publish-stay-draft] draft validé, parsing terminé', {
    draftId: draft.id,
    categories: categories.map((value) => categoryValueToLogLabel(value)),
    ages: ages.length,
    sessions: sessions.length,
    extraOptions: extraOptions.length,
    insuranceOptions: insuranceOptions.length,
    transportOptions: transportOptions.length,
    images: images.length,
    hasAccommodation: Boolean(accommodation),
    linkedStayIdInRaw: livePublication.stayId
  });

  const transportMode = normalizeTransportMode(
    draft.transport_mode,
    Boolean(toNullableText(draft.transport_text)),
    transportOptions
  );

  const resolvedStayId = await resolveStayId(supabase, draft, rawPayload);
  console.info('[publish-stay-draft] résolution du stay live', {
    draftId: draft.id,
    resolvedStayId
  });

  const stayId = await updateOrInsertStay(
    supabase,
    draft,
    resolvedStayId,
    categories,
    ages,
    transportMode,
    sessions
  );
  console.info('[publish-stay-draft] stay upserté', {
    draftId: draft.id,
    stayId
  });

  const syncedTables = ['stays'] as string[];

  console.info('[publish-stay-draft] sync sessions', { stayId, sessions: sessions.length });
  await syncSessions(supabase, stayId, sessions);
  syncedTables.push('sessions', 'session_prices');

  console.info('[publish-stay-draft] sync médias', { stayId, images: images.length });
  await syncStayMedia(supabase, draft.organizer_id, stayId, images);
  syncedTables.push('stay_media');

  console.info('[publish-stay-draft] sync options extras', { stayId, extraOptions: extraOptions.length });
  await syncExtraOptions(supabase, stayId, extraOptions);
  syncedTables.push('stay_extra_options');

  console.info('[publish-stay-draft] sync assurances', {
    stayId,
    insuranceOptions: insuranceOptions.length
  });
  await syncInsuranceOptions(supabase, stayId, insuranceOptions);
  syncedTables.push('insurance_options');

  console.info('[publish-stay-draft] sync options transport', {
    stayId,
    transportOptions: transportOptions.length
  });
  await syncTransportOptions(supabase, stayId, transportOptions);
  syncedTables.push('transport_options');

  console.info('[publish-stay-draft] sync hébergement', {
    stayId,
    hasAccommodation: Boolean(accommodation)
  });
  const previewAccommodationId = readDraftAccommodationPreviewId(rawPayload);
  const accommodationId = await syncAccommodation(
    supabase,
    draft,
    stayId,
    importedExistingAccommodationId ??
      livePublication.accommodationId ??
      previewAccommodationId,
    accommodationSource,
    accommodation
  );
  syncedTables.push('stay_accommodations', 'accommodations');

  const publishedAt = new Date().toISOString();
  const nextLivePublication: LivePublication = {
    stay_id: stayId,
    published_at: publishedAt,
    synced_tables: Array.from(new Set(syncedTables)),
    accommodation_id: accommodationId
  };

  const nextRawPayload: Record<string, unknown> = {
    ...rawPayload,
    live_publication: nextLivePublication,
    published_at: publishedAt,
    publish_error: null
  };
  delete nextRawPayload.draft_accommodation_preview;

  console.info('[publish-stay-draft] sortie succès', {
    draftId: draft.id,
    stayId,
    publishedAt,
    syncedTables: nextLivePublication.synced_tables,
    accommodationId
  });

  return {
    stayId,
    publishedAt,
    syncedTables: nextLivePublication.synced_tables,
    rawPayload: nextRawPayload
  };
}
