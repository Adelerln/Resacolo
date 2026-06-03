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

/** Source de vérité — libellés des pastilles statut dans Mon compte. */
export const FAMILY_ORDER_STATUS_LABELS = {
  REQUESTED: 'Demande à traiter',
  PENDING_PAYMENT: 'En attente de paiement',
  PARTIALLY_PAID: 'Partiellement payée',
  PAID: 'Payée',
  CONFIRMED: 'Payée',
  CANCELLED: 'Annulée',
  TRANSFERRED: 'Transférée',
  VALIDATED: 'En attente de paiement',
  BOOKED: 'En attente de paiement',
  CART: 'Panier'
} as const satisfies Record<string, string>;

/** Modes de paiement choisis au checkout (info complémentaire, pas un statut). */
export const FAMILY_PAYMENT_MODE_LABELS: Record<CheckoutContact['paymentMode'], string> = {
  FULL: 'Paiement de la totalité en CB',
  DEPOSIT_200: "Paiement d'un acompte (200 €) en CB",
  CV_CONNECT: 'Paiement en ANCV Connect',
  CV_PAPER: 'Paiement en ANCV papier',
  DEFERRED: 'Paiement différé'
};

/** Statuts techniques en base (`payments.status`) — ne pas afficher tels quels aux familles. */
export const PAYMENT_RECORD_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED'] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export function parsePaymentModeFromCheckoutPayload(
  rawPayload: Record<string, unknown> | null | undefined
): CheckoutContact['paymentMode'] {
  const contact = rawPayload?.contact;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    return 'FULL';
  }

  const paymentMode = (contact as { paymentMode?: unknown }).paymentMode;
  if (
    paymentMode === 'FULL' ||
    paymentMode === 'DEPOSIT_200' ||
    paymentMode === 'CV_CONNECT' ||
    paymentMode === 'CV_PAPER' ||
    paymentMode === 'DEFERRED'
  ) {
    return paymentMode;
  }

  return 'FULL';
}

export function resolveFamilyPaymentModeLabel(
  rawPayload: Record<string, unknown> | null | undefined
) {
  return FAMILY_PAYMENT_MODE_LABELS[parsePaymentModeFromCheckoutPayload(rawPayload)];
}

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

/** Une commande avec solde restant ne peut pas être considérée comme payée (PAID / CONFIRMED). */
export function reconcileOrderStatusWithBalance(input: {
  status: OrderStatus | string | null | undefined;
  remainingBalanceCents: number;
  onlinePaidCents?: number | null;
  externalPaidCents?: number | null;
}): OrderStatus {
  const status = (input.status ?? 'PENDING_PAYMENT') as OrderStatus;
  if (input.remainingBalanceCents <= 0) {
    return status;
  }

  if (status === 'PAID' || status === 'CONFIRMED') {
    if ((input.onlinePaidCents ?? 0) > 0 || (input.externalPaidCents ?? 0) > 0) {
      return 'PARTIALLY_PAID';
    }
    return 'PENDING_PAYMENT';
  }

  return status;
}

export function resolveOrderStatusLabel(input: {
  status: OrderStatus | string | null | undefined;
  remainingBalanceCents: number;
  onlinePaidCents?: number | null;
  externalPaidCents?: number | null;
}) {
  return orderStatusLabel(
    reconcileOrderStatusWithBalance({
      status: input.status,
      remainingBalanceCents: input.remainingBalanceCents,
      onlinePaidCents: input.onlinePaidCents,
      externalPaidCents: input.externalPaidCents
    })
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

/** Code court affiché aux familles (ex. #F5E4DFBB). */
export function formatOrderReservationCode(orderId: string) {
  const compact = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `#${compact}`;
}

export function formatCheckoutConfirmationOrderStatus(
  status: OrderStatus | string | null | undefined,
  options?: { isPartnerTotalCoverage?: boolean }
) {
  if (options?.isPartnerTotalCoverage) {
    return 'Prise en charge totale';
  }
  return orderStatusLabel(status);
}

export function paymentStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'PENDING':
      return 'En attente';
    case 'SUCCEEDED':
      return 'Validé';
    case 'FAILED':
      return 'Échoué';
    default:
      return status?.trim() ? status : '—';
  }
}

export function inferOrderRequestKind(input: {
  requestKind?: OrderRequestKind | string | null;
  paymentRawPayload?: Record<string, unknown> | null;
}): OrderRequestKind | null {
  if (input.requestKind === 'VACAF' || input.requestKind === 'ANCV_CONNECT') {
    return input.requestKind;
  }

  const contact = input.paymentRawPayload?.contact;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    return null;
  }

  const contactRecord = contact as { paymentMode?: string; vacafNumber?: string };
  if (typeof contactRecord.vacafNumber === 'string' && contactRecord.vacafNumber.trim()) {
    return 'VACAF';
  }
  if (contactRecord.paymentMode === 'CV_CONNECT') {
    return 'ANCV_CONNECT';
  }

  return null;
}

function resolveOfflineSettlementLabel(input: {
  requestKind?: OrderRequestKind | string | null;
  isCvPaperMode?: boolean;
  isDeferredMode?: boolean;
  isVacafRequest?: boolean;
  isAncvConnectRequest?: boolean;
  isPartnerManualQuoteMode?: boolean;
  isPartnerTotalMode?: boolean;
}) {
  if (input.isVacafRequest || input.requestKind === 'VACAF') {
    return 'VACAF/AVE — vérification par l’organisme';
  }
  if (input.isAncvConnectRequest || input.requestKind === 'ANCV_CONNECT') {
    return 'ANCV Connect — à finaliser avec l’organisme';
  }
  if (input.isPartnerManualQuoteMode) {
    return 'Devis partenaire — en attente';
  }
  if (input.isPartnerTotalMode) {
    return 'Pris en charge par le partenaire';
  }
  if (input.isCvPaperMode) {
    return 'ANCV papier — avec l’organisme';
  }
  if (input.isDeferredMode) {
    return 'Paiement différé';
  }
  return 'Hors ligne — avec l’organisme';
}

export function resolveCheckoutConfirmationPaymentStatusLabel(input: {
  orderStatus: string;
  paymentStatus: string | null;
  requestKind?: OrderRequestKind | string | null;
  paymentRawPayload?: Record<string, unknown> | null;
  isCvPaperMode?: boolean;
  isDeferredMode?: boolean;
  isVacafRequest?: boolean;
  isAncvConnectRequest?: boolean;
  isPartnerManualQuoteMode?: boolean;
  isPartnerTotalMode?: boolean;
}) {
  const effectiveRequestKind = inferOrderRequestKind({
    requestKind: input.requestKind,
    paymentRawPayload: input.paymentRawPayload
  });
  const context = { ...input, requestKind: effectiveRequestKind };

  if (context.isCvPaperMode) return 'En attente de règlement ANCV papier';
  if (context.isDeferredMode) return 'Paiement différé';
  if (context.isVacafRequest || effectiveRequestKind === 'VACAF') {
    return 'En attente de vérification VACAF/AVE';
  }
  if (context.isAncvConnectRequest || effectiveRequestKind === 'ANCV_CONNECT') {
    return 'En attente de contact organisme';
  }
  if (context.isPartnerManualQuoteMode) return 'En attente du devis partenaire';
  if (context.isPartnerTotalMode) return 'Pris en charge par le partenaire';

  if (context.orderStatus === 'PAID' || context.paymentStatus === 'SUCCEEDED') {
    return 'Validé';
  }
  if (context.orderStatus === 'PARTIALLY_PAID') {
    return context.paymentStatus === 'SUCCEEDED' ? 'Acompte validé' : paymentStatusLabel(context.paymentStatus);
  }
  if (context.orderStatus === 'PENDING_PAYMENT') {
    if (context.paymentStatus === 'PENDING') return 'En attente de paiement en ligne';
    if (context.paymentStatus === 'FAILED') return 'Paiement échoué';
  }
  if (context.orderStatus === 'REQUESTED') {
    return resolveOfflineSettlementLabel(context);
  }

  return paymentStatusLabel(context.paymentStatus);
}

export function resolveCheckoutConfirmationPaymentField(input: {
  orderStatus: string;
  paymentStatus: string | null;
  requestKind?: OrderRequestKind | string | null;
  paymentRawPayload?: Record<string, unknown> | null;
  isCvPaperMode?: boolean;
  isDeferredMode?: boolean;
  isVacafRequest?: boolean;
  isAncvConnectRequest?: boolean;
  isPartnerManualQuoteMode?: boolean;
  isPartnerTotalMode?: boolean;
}) {
  const effectiveRequestKind = inferOrderRequestKind({
    requestKind: input.requestKind,
    paymentRawPayload: input.paymentRawPayload
  });
  const context = { ...input, requestKind: effectiveRequestKind };
  const usesOnlinePaymentLabel =
    context.orderStatus === 'PAID' ||
    context.orderStatus === 'PARTIALLY_PAID' ||
    context.orderStatus === 'PENDING_PAYMENT' ||
    context.paymentStatus === 'SUCCEEDED' ||
    context.paymentStatus === 'FAILED';

  if (!usesOnlinePaymentLabel) {
    return {
      label: 'Règlement',
      value: resolveOfflineSettlementLabel(context)
    };
  }

  return {
    label: 'Statut paiement',
    value: resolveCheckoutConfirmationPaymentStatusLabel(context)
  };
}

export type CheckoutConfirmationFollowUpMessage = {
  tone: 'success' | 'warning' | 'neutral';
  message: string;
};

export function resolveCheckoutConfirmationFollowUpMessage(input: {
  orderStatus: string;
  paymentStatus: string | null;
  requestKind?: OrderRequestKind | string | null;
  paymentRawPayload?: Record<string, unknown> | null;
  paidAt: string | null;
  isCvPaperMode?: boolean;
  isDeferredMode?: boolean;
  isVacafRequest?: boolean;
  isAncvConnectRequest?: boolean;
  isPartnerManualQuoteMode?: boolean;
  isPartnerTotalMode?: boolean;
}): CheckoutConfirmationFollowUpMessage | null {
  if (input.paidAt) return null;

  const effectiveRequestKind = inferOrderRequestKind({
    requestKind: input.requestKind,
    paymentRawPayload: input.paymentRawPayload
  });
  const context = { ...input, requestKind: effectiveRequestKind };

  if (context.isVacafRequest || effectiveRequestKind === 'VACAF') {
    return {
      tone: 'warning',
      message:
        "Votre demande est bien transmise. L'organisme doit maintenant contrôler vos droits VACAF/AVE et saisir le montant CAF déduit."
    };
  }
  if (context.isAncvConnectRequest || effectiveRequestKind === 'ANCV_CONNECT') {
    return {
      tone: 'warning',
      message:
        "Votre demande est bien transmise. L'organisme vous recontactera pour finaliser le règlement ANCV Connect et saisir le montant reçu."
    };
  }
  if (context.isPartnerManualQuoteMode) {
    return {
      tone: 'warning',
      message:
        'Votre demande de devis est bien transmise. Votre partenaire doit maintenant préciser son montant de prise en charge avant validation finale.'
    };
  }
  if (context.isPartnerTotalMode) {
    return {
      tone: 'success',
      message:
        'Votre réservation est bien enregistrée. Aucun règlement ne vous est demandé : votre partenaire réglera la totalité auprès de ResaColo.'
    };
  }
  if (context.isCvPaperMode) {
    return {
      tone: 'neutral',
      message:
        "Votre commande est bien enregistrée. Le règlement en ANCV papier sera traité directement avec l'organisateur."
    };
  }
  if (context.isDeferredMode) {
    return {
      tone: 'warning',
      message: 'Votre commande est bien enregistrée. Le règlement est différé et sera finalisé ultérieurement.'
    };
  }

  if (context.orderStatus === 'REQUESTED') {
    return {
      tone: 'warning',
      message:
        "Aucun paiement en ligne n'est demandé pour l'instant. L'organisme vous recontactera pour finaliser le règlement."
    };
  }

  if (context.orderStatus === 'PENDING_PAYMENT' && context.paymentStatus === 'PENDING') {
    return {
      tone: 'warning',
      message:
        'Votre paiement par carte bancaire est en cours de validation. Cette page se met à jour automatiquement dès confirmation.'
    };
  }

  if (context.paymentStatus === 'FAILED') {
    return {
      tone: 'warning',
      message:
        "Le paiement n'a pas abouti. Vous pouvez réessayer depuis votre compte ou contacter l'organisme."
    };
  }

  return null;
}

export function resolveCheckoutConfirmationSubtitle(input: {
  orderStatus?: string | null;
  requestKind?: OrderRequestKind | string | null;
  isCvPaperMode?: boolean;
  isDeferredMode?: boolean;
  isVacafRequest?: boolean;
  isAncvConnectRequest?: boolean;
  isPartnerManualQuoteMode?: boolean;
  isPartnerTotalMode?: boolean;
}) {
  if (input.isVacafRequest || input.requestKind === 'VACAF') {
    return 'Votre demande a été transmise à l’organisme pour vérification VACAF/AVE.';
  }
  if (input.isAncvConnectRequest || input.requestKind === 'ANCV_CONNECT') {
    return 'Votre demande a été transmise à l’organisme pour traitement ANCV Connect.';
  }
  if (input.isPartnerManualQuoteMode) {
    return 'Votre demande de devis a été transmise à votre partenaire.';
  }
  if (input.isPartnerTotalMode) {
    return 'Votre réservation est enregistrée sans paiement immédiat.';
  }
  if (input.isCvPaperMode) {
    return 'Votre commande est enregistrée. Le règlement en ANCV papier sera finalisé hors ligne.';
  }
  if (input.isDeferredMode) {
    return 'Votre commande est enregistrée. Le règlement différé sera finalisé ultérieurement.';
  }
  if (input.orderStatus === 'REQUESTED') {
    return 'Votre demande a été transmise à l’organisme.';
  }
  return 'Votre commande est en cours de traitement.';
}

export function orderStatusLabel(status: OrderStatus | string | null | undefined) {
  if (!status) return '-';
  return FAMILY_ORDER_STATUS_LABELS[status as keyof typeof FAMILY_ORDER_STATUS_LABELS] ?? status;
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
