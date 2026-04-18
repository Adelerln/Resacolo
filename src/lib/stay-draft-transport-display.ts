/**
 * Regroupement des options transport pour le brouillon (une ville + prix).
 * Module sans Cheerio : utilisable côté client (formulaire de relecture).
 */

export type TransportVariantForDraft = {
  departure_city: string;
  return_city: string;
  amount_cents: number | null;
  currency?: 'EUR';
  source_url?: string;
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

function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
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

function isBaseReference(value: string | null | undefined): boolean {
  const key = simplifyForMatch(value ?? '');
  if (!key) return false;
  return TRANSPORT_BASE_REFERENCE_KEYS.some((candidate) =>
    key.includes(simplifyForMatch(candidate))
  );
}

function sanitizeTransportLabel(value: string | null | undefined): string {
  if (!value) return '';
  return normalizeWhitespace(value)
    .replace(/\u00A0/g, ' ')
    .replace(/\s*[\(\[]?\+?\s*[0-9][0-9\s.,]*\s*(?:€|euros?)[^\)\]]*[\)\]]?/gi, '')
    .replace(/\s*-\s*\+?\s*[0-9][0-9\s.,]*\s*(?:€|euros?)/gi, '')
    .replace(/^transport\s*(aller|retour)?\s*[:\-]\s*/i, '')
    .trim();
}

function normalizeCityLabel(value: string | null | undefined): string | null {
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

/** Ville « principale » (hors dépôt centre / sur place). */
export function pickPrimaryTransportCityLabel(variant: TransportVariantForDraft): string | null {
  const depNorm = normalizeCityLabel(variant.departure_city);
  const retNorm = normalizeCityLabel(variant.return_city);
  const dep = (depNorm ?? variant.departure_city ?? '').trim();
  const ret = (retNorm ?? variant.return_city ?? '').trim();
  const depBase =
    isBaseReference(dep) || isBaseReference(variant.departure_label_raw ?? undefined);
  const retBase = isBaseReference(ret) || isBaseReference(variant.return_label_raw ?? undefined);

  if (dep && ret && simplifyForMatch(dep) === simplifyForMatch(ret)) {
    return depNorm ?? dep;
  }
  if (!depBase && dep) return depNorm ?? dep;
  if (!retBase && ret) return retNorm ?? ret;
  if (dep) return depNorm ?? dep;
  if (ret) return retNorm ?? ret;
  return null;
}

function rankForMerge(variant: TransportVariantForDraft): number {
  let score = 0;
  if (typeof variant.amount_cents === 'number' && Number.isFinite(variant.amount_cents)) {
    score += variant.amount_cents;
  }
  if (variant.confidence === 'high') score += 50_000;
  else if (variant.confidence === 'medium') score += 30_000;
  else if (variant.confidence === 'low') score += 10_000;
  if (
    variant.pricing_method === 'session_delta' ||
    variant.pricing_method === 'thalie_pbpdt_delta' ||
    variant.pricing_method === 'thalie_option_url_delta'
  ) {
    score += 5_000;
  }
  return score;
}

/** Clé de regroupement : Thalie = ville × session (sinon on écrase les suppléments entre dates). */
function collapseTransportVariantGroupKey(variant: TransportVariantForDraft): string | null {
  if (variant.pricing_method === 'thalie_pbpdt_delta') {
    const cityRaw = normalizeWhitespace(variant.departure_label_raw ?? '');
    const dateRaw = normalizeWhitespace(variant.return_label_raw ?? '');
    if (cityRaw && dateRaw) {
      return `thalie|${simplifyForMatch(cityRaw)}|${simplifyForMatch(dateRaw)}`;
    }
    const combo = normalizeWhitespace(variant.departure_city ?? '');
    if (combo) return `thalie|${simplifyForMatch(combo)}`;
  }
  const city = pickPrimaryTransportCityLabel(variant);
  if (!city) return null;
  const key = simplifyForMatch(city);
  return key || null;
}

/**
 * Une entrée par ville (et par session pour Thalie PBP), variante la plus fiable en cas d’ex aequo.
 */
export function collapseTransportVariantsForDraft(
  variants: TransportVariantForDraft[]
): TransportVariantForDraft[] {
  const map = new Map<string, TransportVariantForDraft>();
  for (const variant of variants) {
    if (typeof variant.amount_cents !== 'number' || !Number.isFinite(variant.amount_cents)) continue;
    const groupKey = collapseTransportVariantGroupKey(variant);
    if (!groupKey) continue;
    const city = pickPrimaryTransportCityLabel(variant) ?? variant.departure_city;
    const merged: TransportVariantForDraft = {
      ...variant,
      departure_city: city || variant.departure_city,
      return_city: city || variant.return_city
    };
    const existing = map.get(groupKey);
    if (!existing || rankForMerge(merged) > rankForMerge(existing)) {
      map.set(groupKey, merged);
    }
  }
  return Array.from(map.values()).sort((left, right) => {
    const a = pickPrimaryTransportCityLabel(left) ?? left.departure_city ?? '';
    const b = pickPrimaryTransportCityLabel(right) ?? right.departure_city ?? '';
    return a.localeCompare(b, 'fr');
  });
}

export function buildDraftTransportOptionsFromVariants(
  transportVariants: TransportVariantForDraft[]
): Array<Record<string, unknown>> {
  return collapseTransportVariantsForDraft(transportVariants)
    .filter((variant) => typeof variant.amount_cents === 'number' && Number.isFinite(variant.amount_cents))
    .map((variant) => {
      const city = pickPrimaryTransportCityLabel(variant) ?? variant.departure_city;
      const label =
        variant.pricing_method === 'thalie_pbpdt_delta' &&
        normalizeWhitespace(variant.departure_label_raw ?? '') &&
        normalizeWhitespace(variant.return_label_raw ?? '')
          ? `${normalizeWhitespace(variant.departure_label_raw ?? '')} — ${normalizeWhitespace(variant.return_label_raw ?? '')}`
          : city;
      return {
        label,
        departure_city: city,
        return_city: city,
        amount_cents: variant.amount_cents,
        price:
          typeof variant.amount_cents === 'number'
            ? Number((variant.amount_cents / 100).toFixed(2))
            : null,
        currency: variant.currency ?? 'EUR',
        source_url: variant.source_url ?? '',
        departure_label_raw: variant.departure_label_raw ?? null,
        return_label_raw: variant.return_label_raw ?? null
      };
    });
}

function recordToVariant(row: Record<string, unknown>): TransportVariantForDraft | null {
  const dep = String(row.departure_city ?? '').trim();
  const ret = String(row.return_city ?? '').trim();
  const label = String(row.label ?? '').trim();
  const amountCents =
    typeof row.amount_cents === 'number' && Number.isFinite(row.amount_cents)
      ? Math.round(row.amount_cents)
      : typeof row.price === 'number' && Number.isFinite(row.price)
        ? Math.round(row.price * 100)
        : null;
  if (amountCents === null) return null;

  const base: TransportVariantForDraft = {
    departure_city: dep,
    return_city: ret,
    amount_cents: amountCents,
    currency: 'EUR',
    source_url: String(row.source_url ?? row.variant_url ?? ''),
    departure_label_raw: (row.departure_label_raw as string | null | undefined) ?? null,
    return_label_raw: (row.return_label_raw as string | null | undefined) ?? null,
    confidence: (row.confidence as TransportVariantForDraft['confidence']) ?? undefined,
    pricing_method: (row.pricing_method as TransportVariantForDraft['pricing_method']) ?? undefined
  };

  if (dep || ret) return base;

  if (!label) return null;
  const slash = label.split(/\s*\/\s*/).map((s) => s.trim());
  if (slash.length === 2 && slash[0] && slash[1]) {
    return { ...base, departure_city: slash[0], return_city: slash[1] };
  }
  return { ...base, departure_city: label, return_city: label };
}

/** Regroupe les lignes déjà enregistrées dans le brouillon. */
export function collapseTransportDraftOptionsJson(
  rows: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  if (rows.length === 0) return rows;
  const variants = rows.map(recordToVariant);
  if (variants.some((row) => row === null)) return rows;
  return buildDraftTransportOptionsFromVariants(variants as TransportVariantForDraft[]);
}
