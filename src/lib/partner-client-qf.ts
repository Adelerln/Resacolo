import { normalizePartnerCatalogRules } from '@/lib/partner-catalog-rules';
import type { PartnerCatalogRules } from '@/types/partner-catalog-rules';

function normalizeFamilyQuotientExpiresOn(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const datePart = trimmed.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  return datePart;
}

export function parseStoredFamilyQuotient(value: number | string | null | undefined) {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

export function isFamilyQuotientCurrent(
  expiresOn: string | null | undefined,
  referenceDate = new Date()
) {
  const normalized = normalizeFamilyQuotientExpiresOn(expiresOn);
  // No expiration date → QF stays valid until the CSE sets one that has passed.
  if (!normalized) return true;
  const today = referenceDate.toISOString().slice(0, 10);
  return normalized >= today;
}

export function catalogRulesUseQfScale(rules: PartnerCatalogRules) {
  return rules.qfScale.length > 0 || rules.financialRules.aidMode === 'QF_SCALE';
}

export function withCatalogQfScaleAidMode(rules: PartnerCatalogRules): PartnerCatalogRules {
  if (rules.qfScale.length === 0 || rules.financialRules.aidMode === 'QF_SCALE') {
    return rules;
  }
  return {
    ...rules,
    financialRules: {
      ...rules.financialRules,
      aidMode: 'QF_SCALE'
    }
  };
}

export function resolveClientQfForAidSimulation(input: {
  rules: PartnerCatalogRules;
  familyQuotient: number | null;
  familyQuotientExpiresOn: string | null;
}): number | null {
  const rules = withCatalogQfScaleAidMode(input.rules);

  if (catalogRulesUseQfScale(rules)) {
    if (input.familyQuotient == null || !isFamilyQuotientCurrent(input.familyQuotientExpiresOn)) {
      return null;
    }

    const { qfMin, qfMax } = rules.financialRules;
    if (qfMin != null && input.familyQuotient < qfMin) return null;
    if (qfMax != null && input.familyQuotient > qfMax) return null;
    return input.familyQuotient;
  }

  if (rules.financialRules.qfMax != null) {
    return ((rules.financialRules.qfMin ?? 0) + rules.financialRules.qfMax) / 2;
  }

  return rules.financialRules.qfMin ?? null;
}

/**
 * Prefer published catalogue rules; fall back to draft when nothing is published,
 * or when only the draft carries a usable QF scale (common after partial saves).
 */
export function resolveCatalogRulesForCseAid(input: {
  published: unknown;
  draft?: unknown;
}): PartnerCatalogRules | null {
  const publishedRaw = input.published ?? null;
  const draftRaw = input.draft ?? null;
  if (publishedRaw == null && draftRaw == null) return null;

  const published = publishedRaw != null
    ? withCatalogQfScaleAidMode(normalizePartnerCatalogRules(publishedRaw))
    : null;
  const draft = draftRaw != null
    ? withCatalogQfScaleAidMode(normalizePartnerCatalogRules(draftRaw))
    : null;

  if (published && draft) {
    if (published.qfScale.length === 0 && draft.qfScale.length > 0) {
      return draft;
    }
    return published;
  }

  return published ?? draft;
}

/**
 * MANUAL financement defaults to "quote" until CSE can price the stay.
 * Once catalogue rules + (for QF scale) a current QF are known, the family amount
 * is determinate — even when aid is 0€ (ineligible stay / no matching tranche).
 */
export function resolveManualFinanceRequiresQuote(input: {
  cseRules: PartnerCatalogRules | null;
  qfValue: number | null;
  cseAidCents: number;
}): boolean {
  if (input.cseAidCents > 0) return false;
  if (!input.cseRules) return true;
  if (catalogRulesUseQfScale(input.cseRules)) {
    return input.qfValue == null;
  }
  return false;
}
