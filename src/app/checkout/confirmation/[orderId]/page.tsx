'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { getOrderStatus } from '@/lib/checkout/client';
import { formatEuroFromCents } from '@/types/checkout';

type OrderStatusResponse = {
  orderId: string;
  status: string;
  paidAt: string | null;
  paymentStatus: string | null;
  totalCents: number;
  currency: string;
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

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function loadStatus() {
      try {
        const response = await getOrderStatus(orderId);
        if (cancelled) return;

        setOrder(response);
        orderStatusRef.current = response.status;
        setErrorMessage(null);

        if (response.status === 'PAID' && !checkoutResetDoneRef.current) {
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
  }, [clearCart, orderId, resetCheckout]);

  return (
    <CheckoutFrame
      step="confirmation"
      title="Confirmation"
      subtitle="Votre commande est en cours de traitement."
    >
      {isLoading ? <p className="text-sm text-slate-500">Chargement de la confirmation...</p> : null}

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {order ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Numéro de commande: <span className="font-semibold text-slate-900">{order.orderId}</span>
          </p>
          <p className="text-sm text-slate-600">
            Statut commande: <span className="font-semibold text-slate-900">{order.status}</span>
          </p>
          <p className="text-sm text-slate-600">
            Statut paiement: <span className="font-semibold text-slate-900">{order.paymentStatus ?? 'En attente'}</span>
          </p>
          <p className="text-sm text-slate-600">
            Total: <span className="font-semibold text-slate-900">{formatEuroFromCents(order.totalCents)}</span>
          </p>
          {order.paidAt ? (
            <p className="text-sm text-emerald-700">Paiement validé le {new Date(order.paidAt).toLocaleString('fr-FR')}.</p>
          ) : (
            <p className="text-sm text-amber-700">Le paiement n’est pas encore confirmé. Cette page se met à jour automatiquement.</p>
          )}
          {mode === 'monetico-mock' ? (
            <p className="text-xs text-slate-500">Mode de test local: paiement Monetico mock simulé.</p>
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
