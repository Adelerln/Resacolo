import type { CheckoutContact } from '@/types/checkout';
import type { Database } from '@/types/supabase';

export type OrderStatus = Database['public']['Enums']['order_status'];
export type OrderRequestKind = 'VACAF' | 'ANCV_CONNECT' | null;

export type OrganizerCheckoutSettings = {
  accepts_ancv_paper: boolean;
  accepts_ancv_connect: boolean;
  is_vacaf_approved: boolean;
};

export const CHECKOUT_MANUAL_REQUEST_PAYMENT_MODES = new Set<CheckoutContact['paymentMode']>(['CV_CONNECT']);
export const CHECKOUT_OFFLINE_PAYMENT_MODES = new Set<CheckoutContact['paymentMode']>(['CV_PAPER', 'DEFERRED']);
export const ACTIVE_ORDER_STATUSES = new Set<OrderStatus>([
  'REQUESTED',
  'PENDING_PAYMENT',
  'PARTIALLY_PAID',
  'PAID'
]);
export const FINALIZED_ORDER_STATUSES = new Set<OrderStatus>(['PAID']);

export function parseAmountEurosToCents(value: string | null | undefined) {
  const normalized = String(value ?? '').replace(',', '.').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

export function resolveOrderRequestKind(
  contact: Pick<CheckoutContact, 'paymentMode' | 'vacafNumber'>,
  organizer: OrganizerCheckoutSettings
): OrderRequestKind {
  if (organizer.is_vacaf_approved && contact.vacafNumber.trim()) {
    return 'VACAF';
  }

  if (contact.paymentMode === 'CV_CONNECT' && organizer.accepts_ancv_connect) {
    return 'ANCV_CONNECT';
  }

  return null;
}

export function resolveInitialOrderStatus(
  contact: Pick<CheckoutContact, 'paymentMode' | 'vacafNumber'>,
  organizer: OrganizerCheckoutSettings
): OrderStatus {
  return resolveOrderRequestKind(contact, organizer) ? 'REQUESTED' : 'PENDING_PAYMENT';
}

export function computeImmediatePaymentAmountCents(
  totalCents: number,
  paymentMode: CheckoutContact['paymentMode']
) {
  if (paymentMode === 'DEPOSIT_200') {
    return Math.min(totalCents, 20_000);
  }

  if (paymentMode === 'FULL') {
    return totalCents;
  }

  return 0;
}

export function computeRemainingBalanceCents(input: {
  totalCents: number;
  externalAidCents?: number | null;
  externalPaidCents?: number | null;
  onlinePaidCents?: number | null;
}) {
  return Math.max(
    0,
    input.totalCents -
      Math.max(0, input.externalAidCents ?? 0) -
      Math.max(0, input.externalPaidCents ?? 0) -
      Math.max(0, input.onlinePaidCents ?? 0)
  );
}

export function resolvePaidOrderStatus(input: {
  totalCents: number;
  paymentMode: CheckoutContact['paymentMode'];
  externalAidCents?: number | null;
  externalPaidCents?: number | null;
  onlinePaidCents: number;
}) {
  const remainingBalanceCents = computeRemainingBalanceCents(input);
  if (remainingBalanceCents <= 0) return 'PAID' as const;
  if (input.paymentMode === 'DEPOSIT_200' || input.onlinePaidCents > 0 || (input.externalPaidCents ?? 0) > 0) {
    return 'PARTIALLY_PAID' as const;
  }
  return 'PENDING_PAYMENT' as const;
}

export function resolveStatusAfterRequestResolution(input: {
  totalCents: number;
  externalAidCents?: number | null;
  externalPaidCents?: number | null;
  onlinePaidCents?: number | null;
}) {
  const remainingBalanceCents = computeRemainingBalanceCents(input);
  if (remainingBalanceCents <= 0) return 'PAID' as const;
  if ((input.externalPaidCents ?? 0) > 0 || (input.onlinePaidCents ?? 0) > 0) {
    return 'PARTIALLY_PAID' as const;
  }
  return 'PENDING_PAYMENT' as const;
}

export function orderStatusLabel(status: OrderStatus | string | null | undefined) {
  switch (status) {
    case 'REQUESTED':
      return 'Demande à traiter';
    case 'PENDING_PAYMENT':
      return 'En attente de paiement';
    case 'PARTIALLY_PAID':
      return 'Partiellement payée';
    case 'PAID':
      return 'Payée';
    case 'CANCELLED':
      return 'Annulée';
    case 'TRANSFERRED':
      return 'Transférée';
    case 'CONFIRMED':
      return 'Payée';
    case 'VALIDATED':
    case 'BOOKED':
      return 'En attente de paiement';
    case 'CART':
      return 'Panier';
    default:
      return status ?? '-';
  }
}

export function orderStatusBadgeClassName(status: OrderStatus | string | null | undefined) {
  switch (status) {
    case 'REQUESTED':
      return 'bg-amber-100 text-amber-900';
    case 'PENDING_PAYMENT':
      return 'bg-sky-100 text-sky-900';
    case 'PARTIALLY_PAID':
      return 'bg-indigo-100 text-indigo-900';
    case 'PAID':
    case 'CONFIRMED':
      return 'bg-emerald-100 text-emerald-900';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-900';
    case 'TRANSFERRED':
      return 'bg-violet-100 text-violet-900';
    case 'VALIDATED':
    case 'BOOKED':
      return 'bg-sky-100 text-sky-900';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
