import type { CheckoutContact, CheckoutPaymentMode } from '@/types/checkout';

/** Nombre minimal de jours avant départ pour autoriser un acompte CB (DEPOSIT_200). */
export const DEPOSIT_MIN_DAYS_BEFORE_DEPARTURE = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Jours calendaires restants jusqu’à une date ISO (YYYY-MM-DD ou datetime), depuis `from`. */
export function daysUntilIsoDate(isoDate: string | null | undefined, from: Date = new Date()): number | null {
  if (!isoDate?.trim()) return null;
  const start = new Date(`${isoDate.trim().slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(start.getTime())) return null;
  const fromNoon = new Date(from);
  fromNoon.setHours(12, 0, 0, 0);
  return Math.floor((start.getTime() - fromNoon.getTime()) / MS_PER_DAY);
}

export function earliestIsoDate(dates: Array<string | null | undefined>): string | null {
  let earliest: string | null = null;
  for (const raw of dates) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.slice(0, 10);
    if (!earliest || key < earliest) earliest = key;
  }
  return earliest;
}

/** Modes « hors CB totale/acompte » (différé / aides ANCV). */
export function isAidOrOfflinePaymentMode(paymentMode: CheckoutPaymentMode | null | undefined): boolean {
  return paymentMode === 'CV_PAPER' || paymentMode === 'CV_CONNECT' || paymentMode === 'DEFERRED';
}

/**
 * Acompte CB (DEPOSIT_200) autorisé uniquement si le départ est à ≥ 30 jours.
 * Ne dépend PAS du mode de paiement choisi (sinon l’acompte réapparaissait en cliquant ANCV).
 */
export function isCardDepositAllowed(input: {
  earliestSessionStartDate: string | null | undefined;
  from?: Date;
}): boolean {
  const days = daysUntilIsoDate(input.earliestSessionStartDate, input.from);
  if (days == null) return true;
  return days >= DEPOSIT_MIN_DAYS_BEFORE_DEPARTURE;
}

export function assertCardDepositAllowedOrThrow(input: {
  earliestSessionStartDate: string | null | undefined;
  paymentMode: CheckoutPaymentMode;
  from?: Date;
}) {
  if (input.paymentMode !== 'DEPOSIT_200') return;
  if (isCardDepositAllowed(input)) return;
  throw new Error(
    `Départ à moins de ${DEPOSIT_MIN_DAYS_BEFORE_DEPARTURE} jours : le règlement intégral est requis (acompte impossible).`
  );
}

/** Si l’acompte n’est plus autorisé, bascule le mode vers FULL. */
export function coercePaymentModeForDeparture<T extends Pick<CheckoutContact, 'paymentMode'>>(
  contact: T,
  earliestSessionStartDate: string | null | undefined,
  from?: Date
): T {
  if (
    contact.paymentMode === 'DEPOSIT_200' &&
    !isCardDepositAllowed({
      earliestSessionStartDate,
      from
    })
  ) {
    return { ...contact, paymentMode: 'FULL' };
  }
  return contact;
}

export const DEPOSIT_FULL_PAYMENT_REQUIRED_MESSAGE =
  'Départ à moins de 30 jours : le règlement intégral est requis.';
