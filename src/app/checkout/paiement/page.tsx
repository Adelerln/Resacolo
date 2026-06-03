'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { isDevBypassCheckout } from '@/lib/checkout/dev-bypass';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { confirmPaymentManually, createPaymentIntent, type CheckoutPaymentIntentResponse } from '@/lib/checkout/client';
import { hasAnyOnlineOrganizerSelection } from '@/types/checkout';

export default function CheckoutPaiementPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { hydrated, checkoutId, contact, participants, resetCheckout } = useCheckout();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const paymentRequiresOnlineStep = hasAnyOnlineOrganizerSelection(contact);

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

  if (!isDevBypassCheckout() && (!isContactComplete || !isParticipantsComplete || !paymentRequiresOnlineStep)) {
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
    const cacheKey = `resacolo-payment-v2-${checkoutId}`;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (isDevBypassCheckout()) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('resacolo-dev-bypass-paid:dev-order', new Date().toISOString());
        }
        sessionStorage.removeItem(cacheKey);
        clearCart();
        resetCheckout();
        router.push('/checkout/confirmation/dev-order?mode=dev-bypass');
        return;
      }

      let paymentData: CheckoutPaymentIntentResponse | null = null;

      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as CheckoutPaymentIntentResponse | null;
        if (parsed?.orderId && parsed?.paymentId && Array.isArray(parsed.payments)) {
          paymentData = parsed;
        } else {
          sessionStorage.removeItem(cacheKey);
        }
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

      if (!paymentData) {
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

        paymentData = response;
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
      }

      await confirmPaymentManually({
        checkoutId,
        payments: paymentData.payments.map((payment) => ({
          orderId: payment.orderId,
          paymentId: payment.paymentId
        }))
      });

      sessionStorage.removeItem(cacheKey);
      clearCart();
      resetCheckout();
      router.push(
        `${paymentData.confirmationPath}${paymentData.confirmationPath.includes('?') ? '&' : '?'}mode=monetico-mock`
      );
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
    >
      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Paiement Monetico</p>
        <p className="text-sm text-slate-600">
          Le clic sur « Payer maintenant » prépare la commande puis vous redirige vers la page de paiement sécurisée.
        </p>
        <p className="text-xs text-slate-500">
          Tant que vous ne cliquez pas sur le bouton, aucune nouvelle commande ne doit être créée.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link href="/checkout/recapitulatif" className="btn btn-secondary btn-md">
          Retour
        </Link>
        <button
          type="button"
          onClick={handlePay}
          className="btn btn-primary btn-md"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Traitement...' : 'Payer maintenant'}
        </button>
      </div>
    </CheckoutFrame>
  );
}
