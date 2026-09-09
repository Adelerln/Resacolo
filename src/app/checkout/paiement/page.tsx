'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isDevBypassCheckout } from '@/lib/checkout/dev-bypass';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { confirmPaymentManually, createPaymentIntent, type CheckoutPaymentIntentResponse } from '@/lib/checkout/client';
import { hasAnyOnlineOrganizerSelection } from '@/types/checkout';

function redirectToPsp(paymentData: CheckoutPaymentIntentResponse) {
  const psp = paymentData.monetico;
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
}

export default function CheckoutPaiementPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { hydrated, checkoutId, contact, participants, resetCheckout } = useCheckout();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [queryChecked, setQueryChecked] = useState(false);
  const autoStartedRef = useRef(false);
  const paymentRequiresOnlineStep = hasAnyOnlineOrganizerSelection(contact);
  const providerLabel =
    typeof process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === 'string' &&
    process.env.NEXT_PUBLIC_PAYMENT_PROVIDER.toLowerCase() === 'axepta'
      ? 'Axepta BNP Paribas'
      : 'Monetico';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isCancelled = params.get('cancelled') === '1';
    const isFailed = params.get('failed') === '1';
    const queryError = params.get('error')?.trim();
    setCancelled(isCancelled);
    setFailed(isFailed);
    if (queryError && !isFailed && !isCancelled) {
      setErrorMessage('Le retour paiement a échoué. Vous pouvez réessayer.');
    }
    if ((isCancelled || isFailed) && checkoutId) {
      sessionStorage.removeItem(`resacolo-payment-v2-${checkoutId}`);
    }
    setQueryChecked(true);
  }, [checkoutId]);

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
      return Boolean(participant?.childId);
    });
  }, [items, participants]);

  const canStartPayment =
    hydrated &&
    items.length > 0 &&
    (isDevBypassCheckout() || (isContactComplete && isParticipantsComplete && paymentRequiresOnlineStep));

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

      // After cancel/fail, never reuse a stale PSP session.
      if (cancelled || failed) {
        sessionStorage.removeItem(cacheKey);
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
        redirectToPsp(paymentData);
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
              childId: participant?.childId ?? null,
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
          redirectToPsp(response);
          return;
        }
      }

      const mockMode = paymentData.monetico.provider === 'axepta' ? 'axepta-mock' : 'monetico-mock';
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
        `${paymentData.confirmationPath}${paymentData.confirmationPath.includes('?') ? '&' : '?'}mode=${mockMode}`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Le paiement a échoué.');
      autoStartedRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!queryChecked || cancelled || failed || !canStartPayment || errorMessage) return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void handlePay();
    // Auto-start once when the page is ready (skip intermediate click).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryChecked, cancelled, failed, canStartPayment, errorMessage]);

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

  const showManualRetry = cancelled || failed || Boolean(errorMessage);

  return (
    <CheckoutFrame
      step="paiement"
      title="Paiement"
      subtitle={
        failed
          ? 'Le paiement n’a pas abouti. Vous pouvez relancer un paiement sécurisé.'
          : showManualRetry
            ? 'Réglez votre commande directement sur le site.'
            : `Redirection vers ${providerLabel}…`
      }
    >
      {failed ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Le paiement n&apos;a pas abouti. Aucune réservation n&apos;est validée tant que le règlement n&apos;est pas
          confirmé. Vous pouvez réessayer immédiatement.
        </p>
      ) : null}
      {cancelled && !failed ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Paiement annulé. Vous pouvez réessayer quand vous le souhaitez.
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {showManualRetry ? (
        <>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Paiement sécurisé ({providerLabel})</p>
            <p className="text-sm text-slate-600">
              {failed
                ? 'Cliquez sur « Relancer le paiement » pour ouvrir à nouveau la page de paiement sécurisée.'
                : 'Cliquez sur « Payer maintenant » pour préparer la commande puis accéder à la page de paiement sécurisée.'}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/checkout/recapitulatif" className="btn btn-secondary btn-md">
              Retour
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-md"
              disabled={isSubmitting}
              onClick={() => {
                setFailed(false);
                setCancelled(false);
                void handlePay();
              }}
            >
              {isSubmitting ? 'Préparation...' : failed ? 'Relancer le paiement' : 'Payer maintenant'}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Paiement sécurisé ({providerLabel})</p>
          <p className="text-sm text-slate-600">
            {isSubmitting
              ? 'Préparation de votre commande et redirection vers la page de paiement…'
              : 'Redirection en cours…'}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/checkout/recapitulatif" className="btn btn-secondary btn-md">
              Retour
            </Link>
          </div>
        </div>
      )}
    </CheckoutFrame>
  );
}
