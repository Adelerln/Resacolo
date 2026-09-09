'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { confirmPaymentManually, getOrderStatus } from '@/lib/checkout/client';
import { createOrderBalancePaymentIntent } from '@/lib/account-profile/client';
import { formatMoneyCentsFr } from '@/lib/format-money-fr';

function resolveProviderLabel() {
  return typeof process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === 'string' &&
    process.env.NEXT_PUBLIC_PAYMENT_PROVIDER.toLowerCase() === 'axepta'
    ? 'Axepta BNP Paribas'
    : 'Monetico';
}

function parseEurosInput(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export default function BalancePaiementPage() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = params.orderId;
  const providerLabel = resolveProviderLabel();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [remainingBalanceCents, setRemainingBalanceCents] = useState<number | null>(null);
  const [currency, setCurrency] = useState('EUR');
  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    const cancelled = searchParams.get('cancelled') === '1';
    const failed = searchParams.get('failed') === '1';
    if (failed) {
      setInfoMessage(
        "Le paiement n'a pas abouti. Vous pouvez modifier le montant si besoin, puis réessayer depuis cette page."
      );
    } else if (cancelled) {
      setInfoMessage('Paiement annulé. Vous êtes de retour dans votre espace client.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    async function loadBalance() {
      setIsLoadingBalance(true);
      setErrorMessage(null);
      try {
        const order = await getOrderStatus(orderId);
        if (cancelled) return;
        setRemainingBalanceCents(order.remainingBalanceCents);
        setCurrency(order.currency || 'EUR');
        setAmountInput(
          order.remainingBalanceCents > 0
            ? (order.remainingBalanceCents / 100).toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })
            : ''
        );
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error ? error.message : 'Impossible de charger le solde de la réservation.'
        );
      } finally {
        if (!cancelled) setIsLoadingBalance(false);
      }
    }

    void loadBalance();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const amountCents = useMemo(() => parseEurosInput(amountInput), [amountInput]);
  const amountValid =
    amountCents != null &&
    remainingBalanceCents != null &&
    amountCents > 0 &&
    amountCents <= remainingBalanceCents;

  async function handlePay() {
    if (!orderId || !amountValid || amountCents == null) return;

    const cacheKey = `resacolo-balance-payment-${orderId}`;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      type PaymentCache = {
        orderId: string;
        paymentId: string;
        amountCents: number;
        currency: string;
        monetico?: {
          provider?: 'monetico' | 'axepta';
          mode: 'mock' | 'live';
          paymentUrl: string;
          formMethod: 'POST' | 'GET';
          formFields: Record<string, string>;
        };
      };

      sessionStorage.removeItem(cacheKey);

      const goLive = (psp: NonNullable<PaymentCache['monetico']>) => {
        if (psp.provider === 'axepta') {
          window.location.assign(psp.paymentUrl);
          return;
        }
        const form = document.createElement('form');
        form.method = psp.formMethod || 'POST';
        form.action = psp.paymentUrl;
        for (const [key, value] of Object.entries(psp.formFields ?? {})) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      };

      const response = await createOrderBalancePaymentIntent(orderId, { amountCents });
      const paymentData: PaymentCache = response;
      sessionStorage.setItem(cacheKey, JSON.stringify(response));

      if (response.monetico.mode === 'live') {
        goLive(response.monetico);
        return;
      }

      await confirmPaymentManually({
        checkoutId: `balance-${orderId}`,
        payments: [
          {
            orderId: paymentData.orderId,
            paymentId: paymentData.paymentId
          }
        ]
      });

      sessionStorage.removeItem(cacheKey);
      router.push(`/mon-compte/reservations?open=${encodeURIComponent(orderId)}&paid=1`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Le paiement du solde a échoué.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <section className="section-container py-10 sm:py-14">
        <Link
          href={`/mon-compte/reservations?open=${orderId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux réservations
        </Link>

        <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="font-display text-2xl font-bold text-slate-900">Régler le solde restant</h1>
          <p className="mt-2 text-sm text-slate-500">
            Choisissez le montant à régler, puis vous serez redirigé vers le terminal de paiement sécurisé{' '}
            {providerLabel}.
          </p>

          {infoMessage ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {infoMessage}
            </p>
          ) : null}

          {isLoadingBalance ? (
            <p className="mt-4 text-sm text-slate-500">Chargement du solde…</p>
          ) : remainingBalanceCents != null ? (
            <div className="mt-4 space-y-3">
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Solde restant :{' '}
                <span className="font-semibold text-slate-900">
                  {formatMoneyCentsFr(remainingBalanceCents, currency)}
                </span>
              </p>
              <label className="block text-sm font-medium text-slate-700">
                Montant à payer (€)
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                  placeholder="0,00"
                />
              </label>
              <p className="text-xs text-slate-500">
                Vous pouvez payer une partie du solde ou la totalité. Le montant ne peut pas dépasser le solde
                restant.
              </p>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link href={`/mon-compte/reservations?open=${orderId}`} className="btn btn-secondary btn-md">
              Annuler
            </Link>
            <button
              type="button"
              onClick={() => void handlePay()}
              className="btn btn-primary btn-md"
              disabled={isSubmitting || isLoadingBalance || !amountValid}
            >
              {isSubmitting
                ? 'Traitement...'
                : amountCents != null
                  ? `Payer ${formatMoneyCentsFr(amountCents, currency)}`
                  : 'Payer'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
