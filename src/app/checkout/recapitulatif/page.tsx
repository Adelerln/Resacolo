'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckoutCartSummary } from '@/components/checkout/CheckoutCartSummary';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { repriceCheckout } from '@/lib/checkout/client';
import { formatEuroFromCents, type CheckoutPricing } from '@/types/checkout';

export default function CheckoutRecapitulatifPage() {
  const router = useRouter();
  const { items } = useCart();
  const { hydrated, checkoutId, contact, participants } = useCheckout();
  const [pricing, setPricing] = useState<CheckoutPricing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isContactComplete = Boolean(
    contact.email &&
      contact.billingFirstName &&
      contact.billingLastName &&
      contact.addressLine1 &&
      contact.postalCode &&
      contact.city &&
      contact.phone
  );

  const isParticipantsComplete = useMemo(() => {
    return items.every((item) => {
      const participant = participants[item.id];
      return Boolean(participant?.childFirstName && participant?.childLastName && participant?.childBirthdate);
    });
  }, [items, participants]);

  const loadPricing = useCallback(async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await repriceCheckout(checkoutId, items);
      setPricing(response.pricing);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Impossible de recalculer le panier.');
      setPricing(null);
    } finally {
      setIsLoading(false);
    }
  }, [checkoutId, items]);

  useEffect(() => {
    if (!hydrated || items.length === 0) {
      setIsLoading(false);
      return;
    }
    loadPricing();
  }, [hydrated, items.length, loadPricing]);

  if (!hydrated) {
    return (
      <CheckoutFrame step="recapitulatif" title="Récapitulatif" subtitle="Chargement du checkout...">
        <p className="text-sm text-slate-500">Chargement...</p>
      </CheckoutFrame>
    );
  }

  if (items.length === 0) {
    return (
      <CheckoutFrame
        step="recapitulatif"
        title="Panier vide"
        subtitle="Ajoutez au moins un séjour avant de lancer le checkout."
      >
        <Link href="/sejours" className="btn btn-primary btn-md">
          Voir les séjours
        </Link>
      </CheckoutFrame>
    );
  }

  if (!isContactComplete) {
    return (
      <CheckoutFrame
        step="recapitulatif"
        title="Informations manquantes"
        subtitle="Renseignez d’abord les informations du responsable légal."
      >
        <Link href="/checkout/informations" className="btn btn-primary btn-md">
          Aller aux informations
        </Link>
      </CheckoutFrame>
    );
  }

  if (!isParticipantsComplete) {
    return (
      <CheckoutFrame
        step="recapitulatif"
        title="Participants incomplets"
        subtitle="Complétez les informations enfant avant de passer au paiement."
      >
        <Link href="/checkout/participants" className="btn btn-primary btn-md">
          Compléter les participants
        </Link>
      </CheckoutFrame>
    );
  }

  return (
    <CheckoutFrame
      step="recapitulatif"
      title="Récapitulatif"
      subtitle="Vérifiez les montants recalculés côté serveur avant de payer."
      aside={<CheckoutCartSummary items={items} pricing={pricing} />}
    >
      {isLoading ? <p className="text-sm text-slate-500">Recalcul en cours...</p> : null}

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {pricing ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Séjour</th>
                <th className="px-4 py-3">Base</th>
                <th className="px-4 py-3">Options</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pricing.items.map((item) => (
                <tr key={item.cartItemId}>
                  <td className="px-4 py-3 text-slate-700">{item.stayTitle}</td>
                  <td className="px-4 py-3 text-slate-700">{formatEuroFromCents(item.basePriceCents)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatEuroFromCents(item.optionsPriceCents)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatEuroFromCents(item.totalPriceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link href="/checkout/participants" className="btn btn-secondary btn-md">
          Modifier participants
        </Link>
        <button
          type="button"
          onClick={() => router.push('/checkout/paiement')}
          className="btn btn-primary btn-md"
          disabled={!pricing || isLoading || Boolean(errorMessage)}
        >
          Continuer vers paiement
        </button>
      </div>
    </CheckoutFrame>
  );
}
