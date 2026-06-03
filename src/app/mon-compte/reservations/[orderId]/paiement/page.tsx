'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { confirmPaymentManually } from '@/lib/checkout/client';
import { createOrderBalancePaymentIntent } from '@/lib/account-profile/client';
import { formatMoneyCentsFr } from '@/lib/format-money-fr';

export default function BalancePaiementPage() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [amountLabel, setAmountLabel] = useState<string | null>(null);

  async function handlePay() {
    if (!orderId) return;

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
          mode: 'mock' | 'live';
          paymentUrl: string;
          formMethod: 'POST';
          formFields: Record<string, string>;
        };
      };

      let paymentData: PaymentCache | null = null;

      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PaymentCache | null;
        if (parsed?.orderId && parsed?.paymentId) {
          paymentData = parsed;
        } else {
          sessionStorage.removeItem(cacheKey);
        }
      }

      if (!paymentData) {
        const response = await createOrderBalancePaymentIntent(orderId);
        paymentData = response;
        setAmountLabel(formatMoneyCentsFr(response.amountCents, response.currency));
        sessionStorage.setItem(cacheKey, JSON.stringify(response));

        if (response.monetico.mode === 'live') {
          const form = document.createElement('form');
          form.method = response.monetico.formMethod;
          form.action = response.monetico.paymentUrl;
          for (const [key, value] of Object.entries(response.monetico.formFields)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
          }
          document.body.appendChild(form);
          form.submit();
          return;
        }
      } else if (!amountLabel && paymentData.amountCents) {
        setAmountLabel(formatMoneyCentsFr(paymentData.amountCents, paymentData.currency));
      }

      if (paymentData?.monetico?.mode === 'live') {
        const form = document.createElement('form');
        form.method = paymentData.monetico.formMethod;
        form.action = paymentData.monetico.paymentUrl;
        for (const [key, value] of Object.entries(paymentData.monetico.formFields)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
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
      router.push(`/checkout/confirmation/${paymentData.orderId}?mode=balance-paid`);
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
            Vous allez être redirigé vers le terminal de paiement sécurisé Monetico pour régler le solde de votre
            réservation.
          </p>

          {amountLabel ? (
            <p className="mt-4 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-700">
              Montant à régler : {amountLabel}
            </p>
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
            <button type="button" onClick={handlePay} className="btn btn-primary btn-md" disabled={isSubmitting}>
              {isSubmitting ? 'Traitement...' : 'Payer le solde'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
