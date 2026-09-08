import { describe, expect, it } from 'vitest';
import { getDefaultPartnerCatalogRules } from '@/lib/partner-catalog-rules';
import {
  isFamilyQuotientCurrent,
  resolveCatalogRulesForCseAid,
  resolveClientQfForAidSimulation,
  resolveManualFinanceRequiresQuote,
  withCatalogQfScaleAidMode
} from '@/lib/partner-client-qf';

describe('partner-client-qf', () => {
  it('considers a quotient current when expiration is missing or still in the future', () => {
    expect(isFamilyQuotientCurrent('2026-12-31', new Date('2026-06-06'))).toBe(true);
    expect(isFamilyQuotientCurrent(null, new Date('2026-06-06'))).toBe(true);
    expect(isFamilyQuotientCurrent('', new Date('2026-06-06'))).toBe(true);
    expect(isFamilyQuotientCurrent('2026-01-01', new Date('2026-06-06'))).toBe(false);
  });

  it('uses the client quotient for qf scale rules when it is current', () => {
    const rules = withCatalogQfScaleAidMode({
      ...getDefaultPartnerCatalogRules(),
      financialRules: {
        ...getDefaultPartnerCatalogRules().financialRules,
        aidMode: 'QF_SCALE'
      },
      qfScale: [
        {
          id: 'row-0',
          minQf: 0,
          maxQf: 100,
          aidMode: 'PERCENT',
          percentValue: 50,
          fixedCents: null
        }
      ]
    });

    expect(
      resolveClientQfForAidSimulation({
        rules,
        familyQuotient: 80,
        familyQuotientExpiresOn: '2026-12-31'
      })
    ).toBe(80);
    expect(
      resolveClientQfForAidSimulation({
        rules,
        familyQuotient: 80,
        familyQuotientExpiresOn: null
      })
    ).toBe(80);
  });

  it('returns null for qf scale rules when the client quotient is missing or expired', () => {
    const rules = withCatalogQfScaleAidMode({
      ...getDefaultPartnerCatalogRules(),
      qfScale: [
        {
          id: 'row-0',
          minQf: 0,
          maxQf: null,
          aidMode: 'FIXED',
          percentValue: null,
          fixedCents: 10_000
        }
      ]
    });

    expect(
      resolveClientQfForAidSimulation({
        rules,
        familyQuotient: null,
        familyQuotientExpiresOn: '2026-12-31'
      })
    ).toBeNull();
    expect(
      resolveClientQfForAidSimulation({
        rules,
        familyQuotient: 500,
        familyQuotientExpiresOn: '2025-01-01'
      })
    ).toBeNull();
  });

  it('does not require a quote when QF is known even if CSE aid is 0', () => {
    const rules = withCatalogQfScaleAidMode({
      ...getDefaultPartnerCatalogRules(),
      qfScale: [
        {
          id: 'row-0',
          minQf: 0,
          maxQf: null,
          aidMode: 'PERCENT',
          percentValue: 40,
          fixedCents: null
        }
      ]
    });

    expect(
      resolveManualFinanceRequiresQuote({
        cseRules: rules,
        qfValue: 720,
        cseAidCents: 0
      })
    ).toBe(false);
    expect(
      resolveManualFinanceRequiresQuote({
        cseRules: rules,
        qfValue: null,
        cseAidCents: 0
      })
    ).toBe(true);
    expect(
      resolveManualFinanceRequiresQuote({
        cseRules: null,
        qfValue: 720,
        cseAidCents: 0
      })
    ).toBe(true);
  });

  it('prefers draft catalogue rules when only the draft carries a QF scale', () => {
    const draft = {
      ...getDefaultPartnerCatalogRules(),
      qfScale: [
        {
          id: 'row-0',
          minQf: 0,
          maxQf: null,
          aidMode: 'PERCENT' as const,
          percentValue: 30,
          fixedCents: null
        }
      ]
    };
    const published = getDefaultPartnerCatalogRules();

    const resolved = resolveCatalogRulesForCseAid({ published, draft });
    expect(resolved?.qfScale).toHaveLength(1);
    expect(resolved?.financialRules.aidMode).toBe('QF_SCALE');
  });
});
