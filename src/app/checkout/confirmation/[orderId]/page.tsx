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
  const displayedSubtitle = isVacafRequestMode
    ? 'Votre demande a été transmise à l’organisme pour vérification VACAF/AVE.'
    : isAncvConnectRequestMode
      ? 'Votre demande a été transmise à l’organisme pour traitement ANCV Connect.'
      : isPartnerManualQuoteMode
        ? 'Votre demande de devis a été transmise à votre partenaire.'
        : isPartnerTotalMode
          ? 'Votre réservation est enregistrée sans paiement immédiat.'
      : isCvPaperMode
    ? 'Votre commande est enregistrée. Le règlement en ANCV papier sera finalisé hors ligne.'
    : isDeferredMode
      ? 'Votre commande est enregistrée. Le règlement différé sera finalisé ultérieurement.'
      : 'Votre commande est en cours de traitement.';

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
    isVacafRequestMode,
    mode,
    orderId,
    resetCheckout
  ]);

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
        <div className="space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Numéro de commande : <span className="font-semibold text-slate-900">{order.orderId}</span>
            </p>
            {order.organizerContactEmail ? (
              <a
                href={`mailto:${encodeURIComponent(order.organizerContactEmail)}?subject=${encodeURIComponent(
                  `Réservation ${order.orderId} - Contact famille`
                )}&body=${encodeURIComponent(
                  `Bonjour${order.organizerName ? ` ${order.organizerName}` : ''},\n\nJe vous contacte concernant ma réservation ${order.orderId}.\n\nCordialement,`
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
              Statut commande : <span className="font-semibold text-slate-900">{order.status}</span>
            </p>
            <p className="text-sm text-slate-600">
              Statut paiement :{' '}
              <span className="font-semibold text-slate-900">
                {isCvPaperMode
                  ? 'En attente de règlement ANCV papier'
                  : isDeferredMode
                    ? 'Paiement différé'
                    : isVacafRequestMode
                      ? 'En attente de vérification VACAF/AVE'
                      : isAncvConnectRequestMode
                        ? 'En attente de contact organisme'
                        : isPartnerManualQuoteMode
                          ? 'En attente du devis partenaire'
                          : isPartnerTotalMode
                            ? 'Pris en charge par le partenaire'
                    : order.paymentStatus ?? 'En attente'}
              </span>
            </p>
            <p className="text-sm text-slate-600">
              Total : <span className="font-semibold text-slate-900">{formatEuroFromCents(order.totalCents)}</span>
            </p>
          </div>
          {order.paidAt ? (
            <p className="text-sm text-emerald-700">Paiement validé le {new Date(order.paidAt).toLocaleString('fr-FR')}.</p>
          ) : isVacafRequestMode ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Votre demande est bien transmise. L&apos;organisme doit maintenant contrôler vos droits
                  VACAF/AVE et saisir le montant CAF déduit.
                </span>
              </p>
            </div>
          ) : isAncvConnectRequestMode ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Votre demande est bien transmise. L&apos;organisme vous recontactera pour finaliser le règlement
                  ANCV Connect et saisir le montant reçu.
                </span>
              </p>
            </div>
          ) : isPartnerManualQuoteMode ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Votre demande de devis est bien transmise. Votre partenaire doit maintenant préciser son montant de prise en charge avant validation finale.
                </span>
              </p>
            </div>
          ) : isPartnerTotalMode ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5">
              <p className="flex items-start gap-2 text-sm font-semibold text-emerald-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Votre réservation est bien enregistrée. Aucun règlement ne vous est demandé : votre partenaire réglera la totalité auprès de ResaColo.
                </span>
              </p>
            </div>
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
