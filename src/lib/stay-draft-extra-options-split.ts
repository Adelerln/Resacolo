/**
 * Sépare options supplémentaires et assurances dans `extra_options_json` (même colonne DB, logique alignée sur publish-stay-draft).
 */

const INSURANCE_KEYWORDS = [
  'assurance',
  'annulation',
  'assistance',
  'rapatriement',
  'multi risque',
  'multirisque'
];

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

/** Tarif collectivités / partenaires (ex. CESL) : la remise est gérée via « Remise partenaire », pas comme option payante. */
export function isPartnerTariffExtraOptionLabel(label: string | null | undefined): boolean {
  const s = simplifyForMatch(label);
  if (!s) return false;
  return s.includes('tarif partenaire') || s.includes('tarif partenaires');
}

function isInsuranceCandidate(
  label: string,
  description: string,
  ...flags: Array<unknown>
): boolean {
  const merged = [label, description, ...flags.map((v) => (typeof v === 'string' ? v : String(v ?? '')))]
    .map((s) => normalizeWhitespace(s))
    .filter(Boolean)
    .join(' ');
  const key = simplifyForMatch(merged);
  if (!key) return false;
  return INSURANCE_KEYWORDS.some((token) => key.includes(simplifyForMatch(token)));
}

export function isInsuranceOptionRow(row: Record<string, unknown>): boolean {
  const kind = simplifyForMatch(String(row.option_kind ?? row.kind ?? ''));
  if (kind === 'insurance' || kind === 'assurance') return true;
  const cat = simplifyForMatch(String(row.category ?? row.type ?? ''));
  if (cat.includes('insurance') || cat.includes('assurance')) return true;
  const label = normalizeWhitespace(String(row.label ?? ''));
  const description = normalizeWhitespace(String(row.description ?? ''));
  return isInsuranceCandidate(label, description, row.category, row.type, row.scope);
}

export function splitDraftExtraOptionsJson(rows: Array<Record<string, unknown>>): {
  extras: Array<Record<string, unknown>>;
  insurance: Array<Record<string, unknown>>;
} {
  const extras: Array<Record<string, unknown>> = [];
  const insurance: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const label = normalizeWhitespace(String(row.label ?? ''));
    if (isPartnerTariffExtraOptionLabel(label)) continue;
    if (isInsuranceOptionRow(row)) {
      insurance.push({ ...row });
    } else {
      extras.push({ ...row });
    }
  }
  return { extras, insurance };
}

export function mergeDraftExtraOptionsJson(
  extras: Array<Record<string, unknown>>,
  insurance: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return [...extras, ...insurance];
}
