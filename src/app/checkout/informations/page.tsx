'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { CheckoutCartSummary } from '@/components/checkout/CheckoutCartSummary';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { createCheckoutSession, validateCheckoutContact } from '@/lib/checkout/client';
import type { CheckoutContact } from '@/types/checkout';

export default function CheckoutInformationsPage() {
  const router = useRouter();
  const { items } = useCart();
  const { hydrated, contact, setContact, setCheckoutId } = useCheckout();
  const [form, setForm] = useState<CheckoutContact>(contact);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(contact);
  }, [contact]);

  if (!hydrated) {
    return (
      <CheckoutFrame step="informations" title="Informations" subtitle="Chargement du checkout...">
        <p className="text-sm text-slate-500">Chargement...</p>
      </CheckoutFrame>
    );
  }

  if (items.length === 0) {
    return (
      <CheckoutFrame
        step="informations"
        title="Panier vide"
        subtitle="Ajoutez au moins un séjour avant de lancer le checkout."
      >
        <Link href="/sejours" className="btn btn-primary btn-md">
          Voir les séjours
        </Link>
      </CheckoutFrame>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const session = await createCheckoutSession(items);
      await validateCheckoutContact(session.checkoutId, form);
      setCheckoutId(session.checkoutId);
      setContact(form);
      router.push('/checkout/participants');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Impossible de continuer vers les participants.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CheckoutFrame
      step="informations"
      title="Vos informations"
      subtitle="Renseignez le responsable légal pour finaliser la réservation."
      aside={<CheckoutCartSummary items={items} />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Téléphone
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Adresse
            <input
              type="text"
              required
              value={form.addressLine1}
              onChange={(event) => setForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Complément d’adresse
            <input
              type="text"
              value={form.addressLine2}
              onChange={(event) => setForm((prev) => ({ ...prev, addressLine2: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Code postal
            <input
              type="text"
              required
              value={form.postalCode}
              onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Ville
            <input
              type="text"
              required
              value={form.city}
              onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Pays
            <input
              type="text"
              required
              value={form.country}
              onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.acceptsTerms}
            onChange={(event) => setForm((prev) => ({ ...prev, acceptsTerms: event.target.checked }))}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <span>J’accepte les Conditions Générales de Vente.</span>
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.acceptsPrivacy}
            onChange={(event) => setForm((prev) => ({ ...prev, acceptsPrivacy: event.target.checked }))}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <span>J’accepte la politique de confidentialité.</span>
        </label>

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Link href="/panier" className="btn btn-secondary btn-md">
            Retour panier
          </Link>
          <button type="submit" className="btn btn-primary btn-md" disabled={isSubmitting}>
            {isSubmitting ? 'Validation...' : 'Continuer'}
          </button>
        </div>
      </form>
    </CheckoutFrame>
  );
}
