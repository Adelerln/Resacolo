'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Mail } from 'lucide-react';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { getOrderStatus } from '@/lib/checkout/client';
import { isDevBypassCheckout } from '@/lib/checkout/dev-bypass';
import { formatEuroFromCents } from '@/types/checkout';
import {
  formatCheckoutConfirmationOrderStatus,
  formatOrderReservationCode,
  resolveCheckoutConfirmationFollowUpMessage,
  resolveCheckoutConfirmationSubtitle
} from '@/lib/order-workflow';

type OrderStatusResponse = {
  orderId: string;
  status: string;
  paidAt: string | null;
  paymentStatus: string | null;
  requestKind: string | null;
  paymentModeLabel: string | null;
  remainingBalanceCents: number;
  totalCents: number;
  currency: string;
  organizerContactEmail: string | null;
  organizerName: string | null;
};

export default function CheckoutConfirmationPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = String(params.orderId ?? '');
  const mode = searchParams.get('mode');
  const { clearCart } = useCart();
  const { resetCheckout } = useCheckout();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderStatusResponse | null>(null);
  const checkoutResetDoneRef = useRef(false);
  const orderStatusRef = useRef<string | null>(null);
  const isCvPaperMode = mode === 'cv-paper' || mode === 'dev-bypass-cv-paper';
  const isDeferredMode = mode === 'deferred' || mode === 'dev-bypass-deferred';
  const isVacafRequestMode = mode === 'requested-vacaf' || mode === 'dev-bypass-requested-vacaf';
  const isAncvConnectRequestMode =
    mode === 'requested-ancv-connect' || mode === 'dev-bypass-requested-ancv-connect';
  const isPartnerTotalMode = mode === 'partner-total' || mode === 'dev-bypass-partner-total';
  const isPartnerManualQuoteMode =
    mode === 'partner-manual-quote' || mode === 'dev-bypass-partner-manual-quote';
  const isManualConfirmationMode =
    isCvPaperMode ||
    isDeferredMode ||
    isVacafRequestMode ||
    isAncvConnectRequestMode ||
    isPartnerTotalMode ||
    isPartnerManualQuoteMode;
  const confirmationContext = useMemo(() => {
    const requestKind = order?.requestKind ?? null;
    const isVacafRequest = isVacafRequestMode || requestKind === 'VACAF';
    const isAncvConnectRequest = isAncvConnectRequestMode || requestKind === 'ANCV_CONNECT';
    const contextInput = {
      orderStatus: order?.status ?? '',
      paymentStatus: order?.paymentStatus ?? null,
      requestKind,
      paidAt: order?.paidAt ?? null,
      isCvPaperMode,
      isDeferredMode,
      isVacafRequest,
      isAncvConnectRequest,
      isPartnerManualQuoteMode,
      isPartnerTotalMode
    };

    return {
      isVacafRequest,
      isAncvConnectRequest,
      subtitle: resolveCheckoutConfirmationSubtitle(contextInput),
      followUpMessage: resolveCheckoutConfirmationFollowUpMessage(contextInput)
    };
  }, [
    isAncvConnectRequestMode,
    isCvPaperMode,
    isDeferredMode,
    isPartnerManualQuoteMode,
    isPartnerTotalMode,
    isVacafRequestMode,
    order
  ]);
  const displayedSubtitle = confirmationContext.subtitle;

  useEffect(() => {
    if (!orderId) return;

    if (
      (
        mode === 'dev-bypass' ||
        mode === 'dev-bypass-cv-paper' ||
        mode === 'dev-bypass-deferred' ||
        mode === 'dev-bypass-partner-total' ||
        mode === 'dev-bypass-partner-manual-quote'
      ) &&
      (isDevBypassCheckout() || process.env.NODE_ENV === 'development')
    ) {
      const devBypassPaidStorageKey = `resacolo-dev-bypass-paid:${orderId}`;
      const simulatedPaidAt = typeof window !== 'undefined' ? sessionStorage.getItem(devBypassPaidStorageKey) : null;
      const isSimulatedPaymentConfirmed = Boolean(simulatedPaidAt);
      const simulatedStatus = isVacafRequestMode || isAncvConnectRequestMode
        ? 'REQUESTED (SIMULÉ)'
        : isSimulatedPaymentConfirmed
          ? 'PAID (SIMULÉ)'
          : 'EN ATTENTE (SIMULÉ)';
      const simulatedPaymentStatus = isVacafRequestMode
        ? 'DEMANDE VACAF (SIMULÉE)'
        : isAncvConnectRequestMode
          ? 'DEMANDE ANCV CONNECT (SIMULÉE)'
          : isPartnerManualQuoteMode
            ? 'DEMANDE DE DEVIS (SIMULÉE)'
            : isPartnerTotalMode
              ? 'PRISE EN CHARGE PARTENAIRE (SIMULÉE)'
        : isCvPaperMode
        ? 'ANCV PAPIER (SIMULÉ)'
        : isDeferredMode
          ? 'PAIEMENT DIFFÉRÉ (SIMULÉ)'
          : isSimulatedPaymentConfirmed
            ? 'PAID (SIMULÉ)'
            : 'NON PAYÉ';

      setOrder({
        orderId,
        status: simulatedStatus,
        paidAt: simulatedPaidAt,
        paymentStatus: simulatedPaymentStatus,
        requestKind: isVacafRequestMode ? 'VACAF' : isAncvConnectRequestMode ? 'ANCV_CONNECT' : null,
        paymentModeLabel: null,
        remainingBalanceCents: 0,
        totalCents: 0,
        currency: 'EUR',
        organizerContactEmail: null,
        organizerName: null
      });
      setErrorMessage(null);
      setIsLoading(false);
      if ((isSimulatedPaymentConfirmed || isManualConfirmationMode) && !checkoutResetDoneRef.current) {
        clearCart();
        resetCheckout();
        checkoutResetDoneRef.current = true;
      }
      if (simulatedPaidAt && typeof window !== 'undefined') {
        sessionStorage.removeItem(devBypassPaidStorageKey);
      }
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function loadStatus() {
      try {
        const response = await getOrderStatus(orderId);
        if (cancelled) return;

        setOrder(response);
        orderStatusRef.current = response.status;
        setErrorMessage(null);

        if (
          (response.status === 'PAID' ||
            response.status === 'PARTIALLY_PAID' ||
            response.status === 'REQUESTED' ||
            response.status === 'PENDING_PAYMENT' ||
            isManualConfirmationMode) &&
          !checkoutResetDoneRef.current
        ) {
          clearCart();
          resetCheckout();
          checkoutResetDoneRef.current = true;
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : 'Impossible de récupérer le statut de la commande.';
        if (isManualConfirmationMode && orderId) {
          setOrder({
            orderId,
            status: isPartnerTotalMode ? 'PAID' : isPartnerManualQuoteMode ? 'REQUESTED' : 'REQUESTED',
            paidAt: isPartnerTotalMode ? new Date().toISOString() : null,
            paymentStatus: null,
            requestKind: isVacafRequestMode ? 'VACAF' : isAncvConnectRequestMode ? 'ANCV_CONNECT' : null,
            paymentModeLabel: null,
            remainingBalanceCents: 0,
            totalCents: 0,
            currency: 'EUR',
            organizerContactEmail: null,
            organizerName: null
          });
          setErrorMessage(null);
          if (!checkoutResetDoneRef.current) {
            clearCart();
            resetCheckout();
            checkoutResetDoneRef.current = true;
          }
          return;
        }
        setErrorMessage(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadStatus();

    interval = setInterval(() => {
      const status = orderStatusRef.current;
      if (
        !status ||
        status === 'PAID' ||
        status === 'PARTIALLY_PAID' ||
        status === 'REQUESTED' ||
        status === 'CANCELLED' ||
        status === 'FAILED'
      ) {
        return;
      }
      loadStatus();
    }, 4000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [
    clearCart,
    isAncvConnectRequestMode,
    isCvPaperMode,
    isDeferredMode,
    isManualConfirmationMode,
    isPartnerManualQuoteMode,
    isPartnerTotalMode,
    isVacafRequestMode,
    mode,
    orderId,
    resetCheckout
  ]);

  const reservationCode = useMemo(
    () => (order ? formatOrderReservationCode(order.orderId) : null),
    [order]
  );

  return (
    <CheckoutFrame
      step="confirmation"
      title="Confirmation"
      subtitle={displayedSubtitle}
    >
      {isLoading ? <p className="text-sm text-slate-500">Chargement de la confirmation...</p> : null}

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {order && reservationCode ? (
        <div className="space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Code réservation : <span className="font-semibold text-slate-900">{reservationCode}</span>
            </p>
            {order.organizerContactEmail ? (
              <a
                href={`mailto:${encodeURIComponent(order.organizerContactEmail)}?subject=${encodeURIComponent(
                  `Réservation ${reservationCode} - Contact famille`
                )}&body=${encodeURIComponent(
                  `Bonjour${order.organizerName ? ` ${order.organizerName}` : ''},\n\nJe vous contacte concernant ma réservation ${reservationCode}.\n\nCordialement,`
                )}`}
                className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-sky-500 bg-sky-200 px-3.5 py-2 text-sm font-semibold text-sky-950 transition hover:border-sky-600 hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:bg-sky-300/90"
              >
                <Mail className="h-4 w-4 text-sky-900" aria-hidden="true" />
                Contacter l&apos;organisme par mail
              </a>
            ) : null}
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Statut :{' '}
              <span className="font-semibold text-slate-900">
                {formatCheckoutConfirmationOrderStatus(order.status, {
                  isPartnerTotalCoverage: isPartnerTotalMode
                })}
              </span>
            </p>
            {order.paymentModeLabel ? (
              <p className="text-sm text-slate-600">
                Mode de paiement :{' '}
                <span className="font-semibold text-slate-900">{order.paymentModeLabel}</span>
              </p>
            ) : null}
            {order.remainingBalanceCents > 0 ? (
              <p className="text-sm text-amber-700">
                Solde à régler :{' '}
                <span className="font-semibold">{formatEuroFromCents(order.remainingBalanceCents)}</span>
              </p>
            ) : null}
            <p className="text-sm text-slate-600">
              Total : <span className="font-semibold text-slate-900">{formatEuroFromCents(order.totalCents)}</span>
            </p>
          </div>
          {order.paidAt ? (
            <p className="text-sm text-emerald-700">
              {isPartnerTotalMode ? 'Réservation validée' : 'Paiement validé'} le{' '}
              {new Date(order.paidAt).toLocaleString('fr-FR')}.
            </p>
          ) : confirmationContext.followUpMessage ? (
            confirmationContext.followUpMessage.tone === 'success' ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5">
                <p className="flex items-start gap-2 text-sm font-semibold text-emerald-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{confirmationContext.followUpMessage.message}</span>
                </p>
              </div>
            ) : confirmationContext.followUpMessage.tone === 'warning' ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{confirmationContext.followUpMessage.message}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-amber-700">{confirmationContext.followUpMessage.message}</p>
            )
          ) : null}
          {mode === 'monetico-mock' ? (
            <p className="text-xs text-slate-500">Mode de test local : paiement Monetico mock simulé.</p>
          ) : null}
          {mode === 'dev-bypass' ||
          mode === 'dev-bypass-cv-paper' ||
          mode === 'dev-bypass-deferred' ||
          mode === 'dev-bypass-partner-total' ||
          mode === 'dev-bypass-partner-manual-quote' ? (
            <p className="text-xs text-amber-800">
              Mode dev : confirmation fictive (NEXT_PUBLIC_DEV_BYPASS_CHECKOUT=1), sans commande en base et sans
              paiement réel.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link href="/sejours" className="btn btn-primary btn-md">
          Continuer mes recherches
        </Link>
        <Link href="/mon-compte" className="btn btn-secondary btn-md">
          Aller à mon compte
        </Link>
      </div>
    </CheckoutFrame>
  );
}
