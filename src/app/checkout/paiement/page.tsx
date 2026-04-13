'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CheckoutCartSummary } from '@/components/checkout/CheckoutCartSummary';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { confirmPaymentManually, createPaymentIntent } from '@/lib/checkout/client';
import type { CheckoutPricing } from '@/types/checkout';

type PaymentInitData = {
  orderId: string;
  paymentId: string;
  pricing: CheckoutPricing;
  monetico: {
    reference: string;
    transactionId: string;
    paymentUrl: string;
    testMode: true;
  };
};

export default function CheckoutPaiementPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { hydrated, checkoutId, contact, participants, resetCheckout } = useCheckout();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentInitData | null>(null);
  const isContactComplete = useMemo(() => {
    return Boolean(
      contact.email &&
        contact.billingFirstName &&
        contact.billingLastName &&
        contact.addressLine1 &&
        contact.postalCode &&
        contact.city &&
        contact.phone
    );
  }, [contact]);

  const isParticipantsComplete = useMemo(() => {
    return items.every((item) => {
      const participant = participants[item.id];
      return Boolean(participant?.childFirstName && participant?.childLastName && participant?.childBirthdate);
    });
  }, [items, participants]);

  useEffect(() => {
    async function initializePayment() {
      if (!hydrated || items.length === 0 || !isContactComplete || !isParticipantsComplete) {
        setIsLoading(false);
        return;
      }

      const cacheKey = `resacolo-payment-v2-${checkoutId}`;

      setErrorMessage(null);
      setIsLoading(true);

      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Partial<PaymentInitData> | null;
          if (
            parsed &&
            typeof parsed.orderId === 'string' &&
            typeof parsed.paymentId === 'string' &&
            parsed.pricing &&
            parsed.monetico
          ) {
            setPaymentData(parsed as PaymentInitData);
            setIsLoading(false);
            return;
          }

          sessionStorage.removeItem(cacheKey);
        }

        const response = await createPaymentIntent({
          checkoutId,
          items,
          contact,
          participants: items.map((item) => {
            const participant = participants[item.id];
            return {
              cartItemId: item.id,
              childFirstName: participant?.childFirstName ?? '',
              childLastName: participant?.childLastName ?? '',
              childBirthdate: participant?.childBirthdate ?? '',
              childGender: participant?.childGender ?? '',
              additionalInfo: participant?.additionalInfo ?? ''
            };
          })
        });

        const payload: PaymentInitData = {
          orderId: response.orderId,
          paymentId: response.paymentId,
          pricing: response.pricing,
          monetico: response.monetico
        };

        setPaymentData(payload);
        sessionStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Impossible de préparer le paiement.');
      } finally {
        setIsLoading(false);
      }
    }

    initializePayment();
  }, [checkoutId, contact, hydrated, isContactComplete, isParticipantsComplete, items, participants]);

  if (!hydrated) {
    return (
      <CheckoutFrame step="paiement" title="Paiement" subtitle="Chargement du checkout...">
        <p className="text-sm text-slate-500">Chargement...</p>
      </CheckoutFrame>
    );
  }

  if (items.length === 0) {
    return (
      <CheckoutFrame
        step="paiement"
        title="Panier vide"
        subtitle="Ajoutez au moins un séjour avant de lancer le checkout."
      >
        <Link href="/sejours" className="btn btn-primary btn-md">
          Voir les séjours
        </Link>
      </CheckoutFrame>
    );
  }

  if (!isContactComplete || !isParticipantsComplete) {
    return (
      <CheckoutFrame
        step="paiement"
        title="Informations incomplètes"
        subtitle="Terminez d’abord les étapes précédentes."
      >
        <Link href="/checkout/recapitulatif" className="btn btn-primary btn-md">
          Retour au récapitulatif
        </Link>
      </CheckoutFrame>
    );
  }

  async function handlePay() {
    if (!paymentData) return;

    const cacheKey = `resacolo-payment-v2-${checkoutId}`;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await confirmPaymentManually({
        checkoutId,
        orderId: paymentData.orderId,
        paymentId: paymentData.paymentId
      });

      sessionStorage.removeItem(cacheKey);
      clearCart();
      resetCheckout();
      router.push(`/checkout/confirmation/${paymentData.orderId}?mode=monetico-mock`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Le paiement a échoué.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CheckoutFrame
      step="paiement"
      title="Paiement"
      subtitle="Réglez votre commande directement sur le site."
      aside={<CheckoutCartSummary items={items} pricing={paymentData?.pricing ?? null} />}
    >
      {isLoading ? <p className="text-sm text-slate-500">Préparation du paiement...</p> : null}

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {!isLoading && paymentData ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Paiement Monetico (mock)</p>
          <p className="text-sm text-slate-600">
            Référence: <span className="font-medium text-slate-900">{paymentData.monetico.reference}</span>
          </p>
          <p className="text-sm text-slate-600">
            Transaction: <span className="font-medium text-slate-900">{paymentData.monetico.transactionId}</span>
          </p>
          <p className="text-xs text-slate-500">
            Mode test local: le clic sur « Payer maintenant » simule la réponse Monetico et confirme la commande.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link href="/checkout/recapitulatif" className="btn btn-secondary btn-md">
          Retour
        </Link>
        <button
          type="button"
          onClick={handlePay}
          className="btn btn-primary btn-md"
          disabled={isLoading || isSubmitting || !paymentData}
        >
          {isSubmitting ? 'Traitement...' : 'Payer maintenant'}
        </button>
      </div>
    </CheckoutFrame>
  );
}
