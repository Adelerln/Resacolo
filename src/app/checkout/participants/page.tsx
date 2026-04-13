'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckoutCartSummary } from '@/components/checkout/CheckoutCartSummary';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { validateCheckoutParticipants } from '@/lib/checkout/client';

export default function CheckoutParticipantsPage() {
  const router = useRouter();
  const { items } = useCart();
  const { hydrated, contact, checkoutId, participants, updateParticipant } = useCheckout();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!hydrated) {
    return (
      <CheckoutFrame step="participants" title="Participants" subtitle="Chargement du checkout...">
        <p className="text-sm text-slate-500">Chargement...</p>
      </CheckoutFrame>
    );
  }

  if (items.length === 0) {
    return (
      <CheckoutFrame
        step="participants"
        title="Panier vide"
        subtitle="Ajoutez au moins un séjour avant de lancer le checkout."
      >
        <Link href="/sejours" className="btn btn-primary btn-md">
          Voir les séjours
        </Link>
      </CheckoutFrame>
    );
  }

  if (!contact.email) {
    return (
      <CheckoutFrame
        step="participants"
        title="Informations manquantes"
        subtitle="Renseignez d’abord les informations du responsable légal."
      >
        <Link href="/checkout/informations" className="btn btn-primary btn-md">
          Aller aux informations
        </Link>
      </CheckoutFrame>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload = items.map((item) => {
        const participant = participants[item.id];
        return {
          cartItemId: item.id,
          childFirstName: participant?.childFirstName ?? '',
          childLastName: participant?.childLastName ?? '',
          childBirthdate: participant?.childBirthdate ?? ''
        };
      });
      await validateCheckoutParticipants(checkoutId, payload);
      router.push('/checkout/recapitulatif');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Impossible de valider les participants.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CheckoutFrame
      step="participants"
      title="Participants"
      subtitle="Renseignez l’enfant concerné pour chaque séjour du panier."
      aside={<CheckoutCartSummary items={items} />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {items.map((item, index) => {
          const participant = participants[item.id];
          return (
            <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Séjour {index + 1}</p>
              <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{item.organizerName}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Prénom de l’enfant
                  <input
                    type="text"
                    required
                    value={participant?.childFirstName ?? ''}
                    onChange={(event) =>
                      updateParticipant(item.id, {
                        childFirstName: event.target.value
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Nom de l’enfant
                  <input
                    type="text"
                    required
                    value={participant?.childLastName ?? ''}
                    onChange={(event) =>
                      updateParticipant(item.id, {
                        childLastName: event.target.value
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Date de naissance
                  <input
                    type="date"
                    required
                    value={participant?.childBirthdate ?? ''}
                    onChange={(event) =>
                      updateParticipant(item.id, {
                        childBirthdate: event.target.value
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
            </article>
          );
        })}

        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Link href="/checkout/informations" className="btn btn-secondary btn-md">
            Retour
          </Link>
          <button type="submit" className="btn btn-primary btn-md" disabled={isSubmitting}>
            {isSubmitting ? 'Validation...' : 'Continuer'}
          </button>
        </div>
      </form>
    </CheckoutFrame>
  );
}
