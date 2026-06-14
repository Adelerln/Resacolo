export type InvoicedBillingPeriod = {
  startIso: string;
  endExclusiveIso: string;
};

export type BillingPeriodValidation = {
  allowed: boolean;
  nextStartDate: string | null;
  conflictMessage: string | null;
};

export function billingPeriodsOverlap(
  aStartIso: string,
  aEndExclusiveIso: string,
  bStartIso: string,
  bEndExclusiveIso: string
): boolean {
  return aStartIso < bEndExclusiveIso && aEndExclusiveIso > bStartIso;
}

export function computeNextBillingStartDate(periods: InvoicedBillingPeriod[]): string | null {
  if (periods.length === 0) return null;

  let maxEndExclusiveIso = periods[0]!.endExclusiveIso;
  for (const period of periods.slice(1)) {
    if (period.endExclusiveIso > maxEndExclusiveIso) {
      maxEndExclusiveIso = period.endExclusiveIso;
    }
  }

  return maxEndExclusiveIso.slice(0, 10);
}

export function formatBillingStartDateFr(isoDay: string): string {
  const date = new Date(`${isoDay}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return isoDay;
  return date.toLocaleDateString('fr-FR');
}

export function validateMnemosBillingPeriod(
  invoicedPeriods: InvoicedBillingPeriod[],
  startIso: string,
  endExclusiveIso: string,
  periodStartIso: (startDate: string) => string
): BillingPeriodValidation {
  const nextStartDate = computeNextBillingStartDate(invoicedPeriods);

  for (const period of invoicedPeriods) {
    if (billingPeriodsOverlap(startIso, endExclusiveIso, period.startIso, period.endExclusiveIso)) {
      return {
        allowed: false,
        nextStartDate,
        conflictMessage: nextStartDate
          ? `Cette période chevauche une facturation déjà enregistrée. Prochaine date de début possible : ${formatBillingStartDateFr(nextStartDate)}.`
          : 'Cette période chevauche une facturation déjà enregistrée.'
      };
    }
  }

  if (nextStartDate && startIso < periodStartIso(nextStartDate)) {
    return {
      allowed: false,
      nextStartDate,
      conflictMessage: `La date de début doit être au plus tôt le ${formatBillingStartDateFr(nextStartDate)} (après la dernière période facturée).`
    };
  }

  return {
    allowed: true,
    nextStartDate,
    conflictMessage: null
  };
}

export function parseInvoicedBillingPeriod(metadata: unknown): InvoicedBillingPeriod | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  const startIso = typeof record.period_start === 'string' ? record.period_start.trim() : '';
  const endExclusiveIso =
    typeof record.period_end_exclusive === 'string' ? record.period_end_exclusive.trim() : '';
  if (!startIso || !endExclusiveIso) return null;
  return { startIso, endExclusiveIso };
}
