'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Mail } from 'lucide-react';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { getOrderStatus } from '@/lib/checkout/client';
import { isDevBypassCheckout } from '@/lib/checkout/dev-bypass';
import { formatEuroFromCents } from '@/types/checkout';

type OrderStatusResponse = {
  orderId: string;
  status: string;
  paidAt: string | null;
  paymentStatus: string | null;
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
  const isOfflineConfirmationMode = isCvPaperMode || isDeferredMode;
  const displayedSubtitle = isCvPaperMode
    ? 'Votre commande est enregistrée. Le règlement en ANCV papier sera finalisé hors ligne.'
    : isDeferredMode
      ? 'Votre commande est enregistrée. Le règlement différé sera finalisé ultérieurement.'
      : 'Votre commande est en cours de traitement.';

  useEffect(() => {
    if (!orderId) return;

    if (
      (mode === 'dev-bypass' || mode === 'dev-bypass-cv-paper' || mode === 'dev-bypass-deferred') &&
      (isDevBypassCheckout() || process.env.NODE_ENV === 'development')
    ) {
      const devBypassPaidStorageKey = `resacolo-dev-bypass-paid:${orderId}`;
      const simulatedPaidAt = typeof window !== 'undefined' ? sessionStorage.getItem(devBypassPaidStorageKey) : null;
      const isSimulatedPaymentConfirmed = Boolean(simulatedPaidAt);
      const simulatedStatus = isOfflineConfirmationMode
        ? 'REQUESTED (SIMULÉ)'
        : isSimulatedPaymentConfirmed
          ? 'PAID (SIMULÉ)'
          : 'EN ATTENTE (SIMULÉ)';
      const simulatedPaymentStatus = isCvPaperMode
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
        totalCents: 0,
        currency: 'EUR',
        organizerContactEmail: null,
        organizerName: null
      });
      setErrorMessage(null);
      setIsLoading(false);
      if ((isSimulatedPaymentConfirmed || isOfflineConfirmationMode) && !checkoutResetDoneRef.current) {
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

        if ((response.status === 'PAID' || isOfflineConfirmationMode) && !checkoutResetDoneRef.current) {
          clearCart();
          resetCheckout();
          checkoutResetDoneRef.current = true;
        }
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Impossible de récupérer le statut de la commande.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadStatus();

    interval = setInterval(() => {
      const status = orderStatusRef.current;
      if (!status || status === 'PAID' || status === 'CANCELLED') {
        return;
      }
      loadStatus();
    }, 4000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [clearCart, isCvPaperMode, isDeferredMode, isOfflineConfirmationMode, mode, orderId, resetCheckout]);

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

      {order ? (
        <div className="relative space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 pt-16 sm:pt-4">
          {order.organizerContactEmail ? (
            <div className="absolute right-4 top-4">
              <a
                href={`mailto:${encodeURIComponent(order.organizerContactEmail)}?subject=${encodeURIComponent(
                  `Réservation ${order.orderId} - Contact famille`
                )}&body=${encodeURIComponent(
                  `Bonjour${order.organizerName ? ` ${order.organizerName}` : ''},\n\nJe vous contacte concernant ma réservation ${order.orderId}.\n\nCordialement,`
                )}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300 bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(2,132,199,0.75)] transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Contacter l&apos;organisme par mail
              </a>
            </div>
          ) : null}
          <p className="text-sm text-slate-600">
            Numéro de commande: <span className="font-semibold text-slate-900">{order.orderId}</span>
          </p>
          <p className="text-sm text-slate-600">
            Statut commande: <span className="font-semibold text-slate-900">{order.status}</span>
          </p>
          <p className="text-sm text-slate-600">
            Statut paiement:{' '}
            <span className="font-semibold text-slate-900">
              {isCvPaperMode
                ? 'En attente de règlement ANCV papier'
                : isDeferredMode
                  ? 'Paiement différé'
                  : order.paymentStatus ?? 'En attente'}
            </span>
          </p>
          <p className="text-sm text-slate-600">
            Total: <span className="font-semibold text-slate-900">{formatEuroFromCents(order.totalCents)}</span>
          </p>
          {order.paidAt ? (
            <p className="text-sm text-emerald-700">Paiement validé le {new Date(order.paidAt).toLocaleString('fr-FR')}.</p>
          ) : isCvPaperMode ? (
            <p className="text-sm text-amber-700">
              Votre commande est bien enregistrée. Le règlement en ANCV papier sera traité directement avec l&apos;organisateur.
            </p>
          ) : isDeferredMode ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Votre commande est bien enregistrée. Le règlement est différé et sera finalisé ultérieurement.</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-700">Le paiement n’est pas encore confirmé. Cette page se met à jour automatiquement.</p>
          )}
          {mode === 'monetico-mock' ? (
            <p className="text-xs text-slate-500">Mode de test local: paiement Monetico mock simulé.</p>
          ) : null}
          {mode === 'dev-bypass' || mode === 'dev-bypass-cv-paper' || mode === 'dev-bypass-deferred' ? (
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
