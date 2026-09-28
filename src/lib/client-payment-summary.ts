import {
  FAMILY_PAYMENT_MODE_LABELS,
  parsePaymentModeFromCheckoutPayload
} from '@/lib/order-workflow';
import type { CheckoutPaymentMode } from '@/types/checkout';

export type ClientPaymentSummaryInputPayment = {
  amount_cents: number;
  status: string;
  raw_payload: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ClientPaymentSummaryRow = {
  /** ISO date used for sorting */
  dateIso: string;
  dateLabel: string;
  label: string;
  amountCents: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function paymentKindFromPayload(rawPayload: unknown) {
  const payload = asRecord(rawPayload);
  return typeof payload?.paymentKind === 'string' ? payload.paymentKind : null;
}

function paymentDateIso(
  payment: ClientPaymentSummaryInputPayment,
  fallbackIso?: string | null
) {
  return payment.created_at ?? payment.updated_at ?? fallbackIso ?? new Date().toISOString();
}

function formatPaymentDateLabel(iso: string) {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}

/** Mode de règlement choisi au checkout (ignore les paiements de solde). */
export function resolveCheckoutPaymentModeFromPayments(
  payments: ClientPaymentSummaryInputPayment[]
): CheckoutPaymentMode {
  const chronological = [...payments].sort((left, right) => {
    const leftTime = new Date(paymentDateIso(left)).getTime();
    const rightTime = new Date(paymentDateIso(right)).getTime();
    return leftTime - rightTime;
  });

  for (const payment of chronological) {
    if (paymentKindFromPayload(payment.raw_payload) === 'BALANCE') continue;
    return parsePaymentModeFromCheckoutPayload(asRecord(payment.raw_payload));
  }

  return parsePaymentModeFromCheckoutPayload(asRecord(chronological[0]?.raw_payload) ?? null);
}

export function resolveCheckoutPaymentModeLabelFromPayments(
  payments: ClientPaymentSummaryInputPayment[]
) {
  return FAMILY_PAYMENT_MODE_LABELS[resolveCheckoutPaymentModeFromPayments(payments)];
}

function resolveOnlinePaymentRowLabel(input: {
  paymentKind: string | null;
  paymentMode: CheckoutPaymentMode;
  requestKind: string | null;
  index: number;
}) {
  if (input.paymentKind === 'BALANCE') {
    return 'Solde CB';
  }

  if (input.paymentMode === 'DEPOSIT_200') {
    return 'Acompte CB';
  }

  if (
    input.paymentMode === 'CV_CONNECT' ||
    input.requestKind === 'ANCV_CONNECT' ||
    input.paymentMode === 'CV_PAPER'
  ) {
    return 'CB complément';
  }

  if (input.index > 0) {
    return 'Solde CB';
  }

  return 'CB famille';
}

function resolveExternalPaidRowLabel(input: {
  requestKind: string | null;
  checkoutMode: CheckoutPaymentMode;
}) {
  if (input.requestKind === 'ANCV_CONNECT' || input.checkoutMode === 'CV_CONNECT') {
    return 'ANCV Connect';
  }
  if (input.checkoutMode === 'CV_PAPER') {
    return 'ANCV papier';
  }
  if (input.requestKind === 'VACAF') {
    return 'Aide VACAF';
  }
  return 'Aide externe';
}

/**
 * Récapitulatif des paiements client — même sémantique que le modèle facture CB
 * (Acompte CB / Solde CB / CB famille / ANCV…), pour PDF et espace Mon compte.
 */
export function buildClientPaymentSummaryRows(input: {
  payments: ClientPaymentSummaryInputPayment[];
  externalPaidCents: number;
  requestKind: string | null;
  fallbackDateIso?: string | null;
}): ClientPaymentSummaryRow[] {
  const checkoutMode = resolveCheckoutPaymentModeFromPayments(input.payments);
  const hasExternalPaid = Math.max(0, input.externalPaidCents) > 0;

  const succeededOnline = input.payments
    .filter((payment) => payment.status === 'SUCCEEDED' && payment.amount_cents !== 0)
    .sort((left, right) => {
      const leftTime = new Date(paymentDateIso(left, input.fallbackDateIso)).getTime();
      const rightTime = new Date(paymentDateIso(right, input.fallbackDateIso)).getTime();
      return leftTime - rightTime;
    });

  const rows: ClientPaymentSummaryRow[] = succeededOnline.map((payment, index) => {
    const dateIso = paymentDateIso(payment, input.fallbackDateIso);
    const paymentKind = paymentKindFromPayload(payment.raw_payload);
    const paymentMode = parsePaymentModeFromCheckoutPayload(asRecord(payment.raw_payload));
    const effectiveMode =
      paymentKind === 'BALANCE' ? checkoutMode : paymentMode || checkoutMode;

    return {
      dateIso,
      dateLabel: formatPaymentDateLabel(dateIso),
      label: resolveOnlinePaymentRowLabel({
        paymentKind,
        paymentMode: effectiveMode,
        requestKind: input.requestKind,
        index
      }),
      amountCents: payment.amount_cents
    };
  });

  if (hasExternalPaid) {
    const dateIso =
      input.fallbackDateIso ??
      succeededOnline.at(-1)?.updated_at ??
      succeededOnline[0]?.created_at ??
      new Date().toISOString();
    rows.push({
      dateIso,
      dateLabel: formatPaymentDateLabel(dateIso),
      label: resolveExternalPaidRowLabel({
        requestKind: input.requestKind,
        checkoutMode
      }),
      amountCents: Math.max(0, input.externalPaidCents)
    });
  }

  return rows.sort((left, right) => {
    const leftTime = new Date(left.dateIso).getTime();
    const rightTime = new Date(right.dateIso).getTime();
    return leftTime - rightTime;
  });
}
