function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForKey(value: string) {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-'’]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTitleCase(value: string) {
  return value.toLowerCase().replace(/(^|[\s'-])([a-zà-öø-ÿ])/g, (_match, separator, letter) => {
    return `${separator}${letter.toUpperCase()}`;
  });
}

/**
 * Nettoyage technique des villes importées:
 * - espaces parasites
 * - labels chaînés via flèches (on garde la ville primaire)
 * - répétitions exactes type "BORDEAUX → BORDEAUX"
 */
export function normalizeTransportCityRaw(input: string | null | undefined) {
  const clean = normalizeWhitespace(input);
  if (!clean) return '';

  const parts = clean
    .split(/\s*(?:→|->)\s*/g)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    return normalizeWhitespace(
      parts[0]
        .replace(/\s*\([^)]*\)\s*$/g, ' ')
        .replace(/\s*-\s*(?:gare|aeroport|aéroport|rdv|rendez-vous)\b.*$/i, ' ')
    );
  }

  const uniqueKeys = new Set(parts.map((part) => normalizeForKey(part)));
  if (uniqueKeys.size === 1) {
    return normalizeWhitespace(
      parts[0]
        .replace(/\s*\([^)]*\)\s*$/g, ' ')
        .replace(/\s*-\s*(?:gare|aeroport|aéroport|rdv|rendez-vous)\b.*$/i, ' ')
    );
  }

  return normalizeWhitespace(
    parts[0]
      .replace(/\s*\([^)]*\)\s*$/g, ' ')
      .replace(/\s*-\s*(?:gare|aeroport|aéroport|rdv|rendez-vous)\b.*$/i, ' ')
  );
}

export function canonicalTransportCityKey(input: string | null | undefined) {
  const normalized = normalizeTransportCityRaw(input);
  if (!normalized) return '';
  return normalizeForKey(normalized);
}

export function formatTransportCityLabel(input: string | null | undefined) {
  const normalized = normalizeTransportCityRaw(input);
  if (!normalized) return '';
  if (normalized === normalized.toUpperCase()) {
    return toTitleCase(normalized);
  }
  return normalized;
}
