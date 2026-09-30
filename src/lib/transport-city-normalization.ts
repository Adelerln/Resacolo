function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Alias de clés canoniques pour fusionner des variantes fréquentes
 * (pluriel / tiret / orthographe commerciale).
 */
const TRANSPORT_CITY_KEY_ALIASES: Record<string, string> = {
  'champagne ardennes tgv': 'champagne ardenne tgv',
  'champagne ardenne tgv': 'champagne ardenne tgv',
  'champagne ardenne': 'champagne ardenne tgv',
  'champagne ardennes': 'champagne ardenne tgv'
};

/** Libellés d’affichage préférés pour les hubs connus. */
const TRANSPORT_CITY_DISPLAY_LABELS: Record<string, string> = {
  'champagne ardenne tgv': 'Champagne-Ardenne TGV'
};

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

function polishTransportCityLabel(value: string) {
  return value
    .replace(/\s*-\s*/g, '-')
    .replace(/\bTgv\b/gi, 'TGV')
    .replace(/\bSncf\b/gi, 'SNCF')
    .replace(/\bCdg\b/gi, 'CDG')
    .replace(/\bOrly\b/gi, 'Orly');
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

  const primary = parts.length === 1 || new Set(parts.map((part) => normalizeForKey(part))).size === 1
    ? parts[0]!
    : parts[0]!;

  return normalizeWhitespace(
    primary
      .replace(/\s*\([^)]*\)\s*$/g, ' ')
      .replace(/\s*-\s*(?:gare|aeroport|aéroport|rdv|rendez-vous)\b.*$/i, ' ')
  );
}

export function canonicalTransportCityKey(input: string | null | undefined) {
  const normalized = normalizeTransportCityRaw(input);
  if (!normalized) return '';
  const key = normalizeForKey(normalized);
  return TRANSPORT_CITY_KEY_ALIASES[key] ?? key;
}

export function formatTransportCityLabel(input: string | null | undefined) {
  const key = canonicalTransportCityKey(input);
  if (!key) return '';

  const preferred = TRANSPORT_CITY_DISPLAY_LABELS[key];
  if (preferred) return preferred;

  const normalized = normalizeTransportCityRaw(input);
  if (!normalized) return '';

  const polished = polishTransportCityLabel(
    normalized === normalized.toUpperCase() ? toTitleCase(normalized) : normalized
  );
  return polished;
}
