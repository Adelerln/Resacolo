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
  if (!normalized) return false;
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
