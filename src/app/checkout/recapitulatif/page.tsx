'use client';

import { Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import {
  createCheckoutSession,
  repriceCheckout,
  validateCheckoutContact,
  validateCheckoutParticipants
} from '@/lib/checkout/client';
import { buildDevMockPricing, isDevBypassCheckout } from '@/lib/checkout/dev-bypass';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';
import type { CheckoutContact, CheckoutParticipant, CheckoutPricing } from '@/types/checkout';

function formatBirthdateFr(iso: string | undefined) {
  if (!iso?.trim()) return '—';
  const d = new Date(`${iso.trim()}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR');
}

function bornWordForGender(gender: CheckoutParticipant['childGender'] | undefined) {
  if (gender === 'FEMININ') return 'née';
  if (gender === 'MASCULIN') return 'né';
  return 'né(e)';
}

function formatParticipantRecapLine(participant: CheckoutParticipant | undefined) {
  const first = participant?.childFirstName?.trim() || '';
  const lastRaw = participant?.childLastName?.trim() || '';
  const last = lastRaw ? lastRaw.toUpperCase() : '';
  const name =
    first || last
      ? [first, last].filter(Boolean).join(' ')
      : '—';
  const birth = formatBirthdateFr(participant?.childBirthdate);
  const born = bornWordForGender(participant?.childGender);
  return `${name}, ${born} le ${birth}`;
}

const INPUT_CLASS =
  'mt-1.5 min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tracking-normal text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100';
const SECTION_CARD_CLASS =
  'rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_44px_rgba(15,23,42,0.05)] sm:px-6';
const COMPACT_LABEL_BOLD_CLASS = 'text-[11px] font-bold uppercase tracking-wide text-slate-900';

const PAYMENT_MODES: Array<{ value: CheckoutContact['paymentMode']; label: string }> = [
  { value: 'FULL', label: 'Paiement de la totalité' },
  { value: 'DEPOSIT_200', label: "Paiement d'un acompte (200 €)" },
  { value: 'CV_CONNECT', label: 'Paiement en ANCV Connect' },
  { value: 'CV_PAPER', label: 'Paiement en ANCV papier' },
  { value: 'DEFERRED', label: 'Paiement différé' }
];

export default function CheckoutRecapitulatifPage() {
  const router = useRouter();
  const { items } = useCart();
  const { hydrated, checkoutId, contact, participants, setContact, setCheckoutId } = useCheckout();
  const [pricing, setPricing] = useState<CheckoutPricing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentSubmitError, setPaymentSubmitError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  useEffect(() => {
    router.prefetch('/checkout/paiement');
  }, [router]);

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
      if (isDevBypassCheckout()) {
        setPricing(buildDevMockPricing(items));
        return;
      }
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

  function patchContact(patch: Partial<CheckoutContact>) {
    setContact({ ...contact, ...patch });
  }

  async function handleContinueToPayment() {
    setPaymentSubmitError(null);
    if (!contact.acceptsTerms) {
      setPaymentSubmitError('Vous devez accepter les conditions générales pour continuer.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      if (isDevBypassCheckout()) {
        router.push('/checkout/paiement');
        return;
      }

      const session = await createCheckoutSession(items);
      const normalizedContact: CheckoutContact = {
        ...contact,
        email: contact.email.trim().toLowerCase(),
        vacafNumber: (contact.vacafNumber ?? '').toUpperCase()
      };

      await validateCheckoutContact(session.checkoutId, normalizedContact);

      const participantPayload = items.map((item) => {
        const participant = participants[item.id];
        return {
          cartItemId: item.id,
          childFirstName: participant?.childFirstName ?? '',
          childLastName: participant?.childLastName ?? '',
          childBirthdate: participant?.childBirthdate ?? '',
          childGender: participant?.childGender ?? '',
          additionalInfo: participant?.additionalInfo ?? ''
        };
      });

      await validateCheckoutParticipants(session.checkoutId, participantPayload);
      setCheckoutId(session.checkoutId);
      setContact(normalizedContact);
      router.push('/checkout/paiement');
    } catch (error) {
      setPaymentSubmitError(
        error instanceof Error ? error.message : 'Impossible de continuer vers le paiement.'
      );
    } finally {
      setIsSubmittingPayment(false);
    }
  }

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

  if (!isDevBypassCheckout() && !isContactComplete) {
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

  if (!isDevBypassCheckout() && !isParticipantsComplete) {
    return (
      <CheckoutFrame
        step="recapitulatif"
        title="Participants incomplets"
        subtitle="Complétez les informations enfant avant de passer au paiement."
      >
        <Link href="/checkout/informations#checkout-participants" className="btn btn-primary btn-md">
          Compléter les participants
        </Link>
      </CheckoutFrame>
    );
  }

  return (
    <CheckoutFrame
      step="recapitulatif"
      title="Récapitulatif"
      subtitle="Vérifiez votre panier, les avantages complémentaires et le mode de paiement avant le règlement ou la finalisation de la réservation."
    >
      <div className="space-y-6">
        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        ) : null}

        <section className={SECTION_CARD_CLASS}>
          <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Votre panier</h2>
          <div className="mt-5 space-y-6">
            {items.map((item, index) => {
              const p = participants[item.id];
              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/90 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
                    <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-slate-200 sm:h-36 sm:w-44">
                      <Image
                        src={item.coverImage || getMockImageUrl(mockImages.sejours.fallbackCover, 400, 80)}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 176px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Séjour {index + 1}
                      </p>
                      <p className="mt-1 font-display text-lg font-bold text-slate-900">{item.title}</p>
                      {item.location ? (
                        <p className="mt-0.5 text-sm text-slate-600">{item.location}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">Vendu par : {item.organizerName}</p>

                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Informations du participant
                        </p>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900">
                          {formatParticipantRecapLine(p)}
                        </p>
                        {p?.additionalInfo?.trim() ? (
                          <div className="mt-3 text-sm">
                            <p className="text-slate-500">Infos complémentaires</p>
                            <p className="mt-0.5 font-medium whitespace-pre-wrap text-slate-900">
                              {p.additionalInfo.trim()}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={SECTION_CARD_CLASS}>
          <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Avantages complémentaires</h2>
          <div className="mt-5 space-y-5">
            <div className="space-y-3">
              <div>
                <label htmlFor="recap-cse-affiliation" className={`${COMPACT_LABEL_BOLD_CLASS} block`}>
                  Code d&apos;affiliation à un CSE (facultatif)
                </label>
                <p
                  id="recap-cse-affiliation-hint"
                  className="mt-1.5 text-sm leading-relaxed text-slate-500"
                >
                  Saisir votre code CSE, votre affiliation sera vérifiée.
                </p>
              </div>
              <input
                id="recap-cse-affiliation"
                type="text"
                value={contact.cseOrganization}
                onChange={(event) => patchContact({ cseOrganization: event.target.value })}
                className={INPUT_CLASS}
                aria-describedby="recap-cse-affiliation-hint"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="recap-vacaf" className={`${COMPACT_LABEL_BOLD_CLASS} block`}>
                  Matricule VACAF (facultatif)
                </label>
                <p
                  id="recap-vacaf-hint"
                  className="mt-1.5 text-sm leading-relaxed text-slate-500"
                >
                  Si l&apos;organisateur accepte les bons VACAF, ils pourront être pris en compte dans le traitement
                  final de votre réservation.
                </p>
              </div>
              <input
                id="recap-vacaf"
                type="text"
                value={contact.vacafNumber}
                onChange={(event) =>
                  patchContact({ vacafNumber: event.target.value.toUpperCase() })
                }
                className={INPUT_CLASS}
                aria-describedby="recap-vacaf-hint"
              />
            </div>
          </div>
        </section>

        <section className={SECTION_CARD_CLASS}>
          <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Mode de paiement</h2>
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PAYMENT_MODES.map((mode) => {
                const isActive = contact.paymentMode === mode.value;
                return (
                  <label
                    key={mode.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-[18px] border px-4 py-4 text-sm font-semibold transition ${
                      isActive
                        ? 'border-accent-400 bg-accent-50 text-accent-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 transition ${
                        isActive
                          ? 'border-accent-500 bg-accent-500 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                      aria-hidden
                    >
                      {isActive ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                    </span>
                    <input
                      type="radio"
                      name="recap-payment-mode"
                      value={mode.value}
                      checked={isActive}
                      onChange={() => patchContact({ paymentMode: mode.value })}
                      className="sr-only"
                    />
                    <span className="min-w-0 flex-1 leading-snug">{mode.label}</span>
                  </label>
                );
              })}
            </div>

            <p className="text-sm leading-relaxed text-slate-600">
              Vos données personnelles seront utilisées pour traiter votre réservation, pour améliorer votre expérience
              utilisateur sur ce site, et à d&apos;autres fins décrites dans notre{' '}
              <Link href="/confidentialite" className="font-medium text-brand-500 underline">
                politique de confidentialité
              </Link>
              .
            </p>

            <div className="border-t border-slate-200 pt-5">
              <label className="flex items-start gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                <input
                  type="checkbox"
                  checked={contact.acceptsTerms}
                  onChange={(event) =>
                    patchContact({
                      acceptsTerms: event.target.checked,
                      acceptsPrivacy: event.target.checked ? true : contact.acceptsPrivacy
                    })
                  }
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 sm:h-4 sm:w-4"
                />
                <span>
                  J&apos;ai lu et j&apos;accepte les{' '}
                  <Link href="/cgv" className="text-brand-500">
                    conditions générales
                  </Link>{' '}
                  *
                </span>
              </label>
            </div>

            {paymentSubmitError ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {paymentSubmitError}
              </p>
            ) : null}
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <Link href="/checkout/informations" className="btn btn-secondary btn-md">
            Retour aux informations
          </Link>
          <button
            type="button"
            onClick={() => void handleContinueToPayment()}
            className="btn btn-primary btn-md"
            disabled={
              !pricing ||
              isLoading ||
              Boolean(errorMessage) ||
              isSubmittingPayment ||
              !contact.acceptsTerms
            }
          >
            {isSubmittingPayment ? 'Validation...' : 'Continuer vers paiement'}
          </button>
        </div>
      </div>
    </CheckoutFrame>
  );
}
