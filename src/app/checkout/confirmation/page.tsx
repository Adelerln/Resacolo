'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { getOrdersByCheckoutId } from '@/lib/checkout/client';
import {
  formatCheckoutConfirmationOrderStatus,
  formatOrderReservationCode
} from '@/lib/order-workflow';
import { formatEuroFromCents } from '@/types/checkout';

type BatchOrderStatus = {
  orderId: string;
  status: string;
  paidAt: string | null;
  paymentStatus: string | null;
  requestKind: string | null;
  paymentModeLabel: string | null;
  remainingBalanceCents: number;
  totalCents: number;
  currency: string;
  organizerName: string | null;
};

export default function CheckoutBatchConfirmationPage() {
  const searchParams = useSearchParams();
  const checkoutId = searchParams.get('checkoutId') ?? '';
  const { clearCart } = useCart();
  const { resetCheckout } = useCheckout();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orders, setOrders] = useState<BatchOrderStatus[]>([]);
  const resetDoneRef = useRef(false);

  useEffect(() => {
    if (!checkoutId) {
      setIsLoading(false);
      setErrorMessage('Checkout introuvable.');
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const response = await getOrdersByCheckoutId(checkoutId);
        if (cancelled) return;
        setOrders(response.orders ?? []);
        setErrorMessage(null);
        if (!resetDoneRef.current && (response.orders?.length ?? 0) > 0) {
          clearCart();
          resetCheckout();
          resetDoneRef.current = true;
        }
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Impossible de charger la confirmation.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    interval = setInterval(() => {
      void load();
    }, 4000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [checkoutId, clearCart, resetCheckout]);

  const subtitle = useMemo(() => {
    if (orders.length === 0) {
      return 'Vos commandes sont en cours de consolidation.';
    }
    return 'Vos réservations ont été réparties automatiquement par organisateur.';
  }, [orders.length]);

  return (
    <CheckoutFrame step="confirmation" title="Confirmation" subtitle={subtitle}>
      {isLoading ? <p className="text-sm text-slate-500">Chargement de la confirmation...</p> : null}

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {orders.length > 0 ? (
        <div className="space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
          {orders.map((order) => (
            <div key={order.orderId} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    {order.organizerName || 'Organisme'}
                  </p>
                  <p className="text-base font-semibold text-slate-900">
                    {formatOrderReservationCode(order.orderId)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {formatEuroFromCents(order.totalCents)}
                </p>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>
                  Statut :{' '}
                  <span className="font-semibold text-slate-900">
                    {formatCheckoutConfirmationOrderStatus(order.status)}
                  </span>
                </p>
                {order.paymentModeLabel ? (
                  <p>
                    Mode de paiement :{' '}
                    <span className="font-semibold text-slate-900">{order.paymentModeLabel}</span>
                  </p>
                ) : null}
                {order.remainingBalanceCents > 0 ? (
                  <p className="text-amber-700">
                    Solde à régler :{' '}
                    <span className="font-semibold">{formatEuroFromCents(order.remainingBalanceCents)}</span>
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
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
