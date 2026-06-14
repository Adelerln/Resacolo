import { describe, expect, it } from 'vitest';
import {
  billingPeriodsOverlap,
  computeNextBillingStartDate,
  validateMnemosBillingPeriod
} from '@/lib/mnemos/billing-period-guard';

const periodStartIso = (startDate: string) => new Date(`${startDate}T00:00:00.000Z`).toISOString();

describe('billingPeriodsOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(
      billingPeriodsOverlap(
        '2026-01-01T00:00:00.000Z',
        '2027-01-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z',
        '2026-12-01T00:00:00.000Z'
      )
    ).toBe(true);
  });

  it('allows adjacent non-overlapping ranges', () => {
    expect(
      billingPeriodsOverlap(
        '2026-01-01T00:00:00.000Z',
        '2026-07-01T00:00:00.000Z',
        '2026-07-01T00:00:00.000Z',
        '2027-01-01T00:00:00.000Z'
      )
    ).toBe(false);
  });
});

describe('computeNextBillingStartDate', () => {
  it('returns the day after the latest invoiced period', () => {
    expect(
      computeNextBillingStartDate([
        {
          startIso: '2026-01-01T00:00:00.000Z',
          endExclusiveIso: '2026-07-01T00:00:00.000Z'
        },
        {
          startIso: '2026-07-01T00:00:00.000Z',
          endExclusiveIso: '2027-01-01T00:00:00.000Z'
        }
      ])
    ).toBe('2027-01-01');
  });
});

describe('validateMnemosBillingPeriod', () => {
  const invoiced = [
    {
      startIso: '2026-01-01T00:00:00.000Z',
      endExclusiveIso: '2027-01-01T00:00:00.000Z'
    }
  ];

  it('blocks an overlapping period', () => {
    const result = validateMnemosBillingPeriod(
      invoiced,
      '2026-01-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
      periodStartIso
    );
    expect(result.allowed).toBe(false);
    expect(result.nextStartDate).toBe('2027-01-01');
  });

  it('allows the next contiguous period', () => {
    const result = validateMnemosBillingPeriod(
      invoiced,
      '2027-01-01T00:00:00.000Z',
      '2028-01-01T00:00:00.000Z',
      periodStartIso
    );
    expect(result.allowed).toBe(true);
  });
});
