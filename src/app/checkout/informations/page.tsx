'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { CheckoutCartSummary } from '@/components/checkout/CheckoutCartSummary';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import {
  createCheckoutSession,
  repriceCheckout,
  registerCheckoutClientAccount,
  validateCheckoutContact,
  validateCheckoutParticipants
} from '@/lib/checkout/client';
import { formatEuroFromCents, type CheckoutContact, type CheckoutPricing } from '@/types/checkout';

const INPUT_CLASS =
  'mt-1.5 min-h-[50px] w-full rounded-[18px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100';
const SECTION_CARD_CLASS =
  'rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_44px_rgba(15,23,42,0.05)] sm:px-6';
const LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400';
const FORM_ID = 'checkout-informations-form';
const ACCOUNT_STORAGE_KEY = 'resacolo-checkout-account-email';
const PAYMENT_MODES: Array<{ value: CheckoutContact['paymentMode']; label: string }> = [
  { value: 'FULL', label: 'Paiement de la totalité' },
  { value: 'DEPOSIT_200', label: "Paiement d'un acompte (200EUR)" },
  { value: 'CV_CONNECT', label: 'Paiement en chèques-vacances connect' },
  { value: 'CV_PAPER', label: 'Paiement en chèques-vacances papier' },
  { value: 'DEFERRED', label: 'Paiement différé' }
];

export default function CheckoutInformationsPage() {
  const router = useRouter();
  const { items } = useCart();
  const {
    hydrated,
    checkoutId,
    contact,
    participants,
    setContact,
    setCheckoutId,
    updateParticipant
  } = useCheckout();
  const [form, setForm] = useState<CheckoutContact>(contact);
  const [pricing, setPricing] = useState<CheckoutPricing | null>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('');
  const [registeredAccountEmail, setRegisteredAccountEmail] = useState('');

  useEffect(() => {
    setForm(contact);
  }, [contact]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setRegisteredAccountEmail(sessionStorage.getItem(ACCOUNT_STORAGE_KEY) ?? '');
  }, []);

  const isParticipantsComplete = useMemo(() => {
    return items.every((item) => {
      const participant = participants[item.id];
      return Boolean(participant?.childFirstName && participant?.childLastName && participant?.childBirthdate);
    });
  }, [items, participants]);

  const loadPricing = useCallback(async () => {
    setIsLoadingPricing(true);
    try {
      const response = await repriceCheckout(checkoutId, items);
      setPricing(response.pricing);
    } catch {
      setPricing(null);
    } finally {
      setIsLoadingPricing(false);
    }
  }, [checkoutId, items]);

  useEffect(() => {
    if (!hydrated || items.length === 0) {
      setIsLoadingPricing(false);
      return;
    }

    loadPricing();
  }, [hydrated, items.length, loadPricing]);

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
      const normalizedEmail = form.email.trim().toLowerCase();

      if (registeredAccountEmail !== normalizedEmail) {
        if (accountPassword.length < 8) {
          throw new Error('Le mot de passe du compte doit contenir au moins 8 caractères.');
        }

        if (accountPassword !== accountPasswordConfirm) {
          throw new Error('La confirmation du mot de passe ne correspond pas.');
        }

        await registerCheckoutClientAccount({
          firstName: form.billingFirstName,
          lastName: form.billingLastName,
          email: normalizedEmail,
          password: accountPassword
        });

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(ACCOUNT_STORAGE_KEY, normalizedEmail);
        }
        setRegisteredAccountEmail(normalizedEmail);
      }

      const session = await createCheckoutSession(items);
      const normalizedContact: CheckoutContact = {
        ...form,
        email: normalizedEmail,
        vacafNumber: form.vacafNumber.toUpperCase()
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
      setPricing(session.pricing);
      router.push('/checkout/recapitulatif');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Impossible de continuer vers le récapitulatif.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CheckoutFrame
      step="informations"
      title={
        <span className="block font-display text-[2rem] leading-none sm:text-[2.8rem]">
          Confirmez votre <span className="text-accent-500">réservation</span> !
        </span>
      }
      subtitle="Renseignez les informations de facturation, les participants et les éléments utiles avant l’envoi de la réservation."
      headerClassName="border-0 bg-transparent p-0 shadow-none"
      contentClassName="border-0 bg-transparent p-0 shadow-none"
    >
      <form id={FORM_ID} onSubmit={onSubmit} className="space-y-6">
        <section className={SECTION_CARD_CLASS}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
                Créez votre compte
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Utilisez vos coordonnées principales, puis indiquez si l’adresse de facturation doit être différente.
              </p>
            </div>
            {registeredAccountEmail === form.email.trim().toLowerCase() && form.email.trim() ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                Compte prêt
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className={LABEL_CLASS}>
              Prénom *
              <input
                type="text"
                required
                value={form.billingFirstName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, billingFirstName: event.target.value }))
                }
                className={INPUT_CLASS}
                placeholder="Entrez votre prénom"
              />
            </label>
            <label className={LABEL_CLASS}>
              Nom *
              <input
                type="text"
                required
                value={form.billingLastName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, billingLastName: event.target.value }))
                }
                className={INPUT_CLASS}
                placeholder="Entrez votre nom"
              />
            </label>
            <label className={`${LABEL_CLASS} md:col-span-2`}>
              Numéro et nom de rue *
              <input
                type="text"
                required
                value={form.addressLine1}
                onChange={(event) => setForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
                className={INPUT_CLASS}
                placeholder="Numéro de voie et nom de la rue"
              />
            </label>
            <label className={`${LABEL_CLASS} md:col-span-2`}>
              Complément d&apos;adresse
              <input
                type="text"
                value={form.addressLine2}
                onChange={(event) => setForm((prev) => ({ ...prev, addressLine2: event.target.value }))}
                className={INPUT_CLASS}
                placeholder="Bâtiment, étage, appartement…"
              />
            </label>
            <label className={LABEL_CLASS}>
              Code postal *
              <input
                type="text"
                required
                value={form.postalCode}
                onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              Ville *
              <input
                type="text"
                required
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              Téléphone *
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              E-mail *
              <input
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value.trim() }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className={LABEL_CLASS}>
              Mot de passe *
              <input
                type="password"
                required={registeredAccountEmail !== form.email.trim().toLowerCase()}
                value={accountPassword}
                onChange={(event) => setAccountPassword(event.target.value)}
                className={INPUT_CLASS}
                placeholder="8 caractères minimum"
              />
            </label>
            <label className={LABEL_CLASS}>
              Confirmer le mot de passe *
              <input
                type="password"
                required={registeredAccountEmail !== form.email.trim().toLowerCase()}
                value={accountPasswordConfirm}
                onChange={(event) => setAccountPasswordConfirm(event.target.value)}
                className={INPUT_CLASS}
                placeholder="Confirmez le mot de passe"
              />
            </label>
          </div>
        </section>

        <section className={SECTION_CARD_CLASS}>
          <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
            Adresse de facturation
          </h2>
          <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
            <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.hasSeparateBillingAddress}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    hasSeparateBillingAddress: event.target.checked
                  }))
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>Je souhaite renseigner une adresse de facturation différente de mon adresse principale</span>
            </label>
          </div>
        </section>

        {form.hasSeparateBillingAddress ? (
          <section className={SECTION_CARD_CLASS}>
            <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
              Détails de facturation
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className={`${LABEL_CLASS} md:col-span-2`}>
                Numéro et nom de rue *
                <input
                  type="text"
                  required={form.hasSeparateBillingAddress}
                  value={form.billingAddressLine1}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, billingAddressLine1: event.target.value }))
                  }
                  className={INPUT_CLASS}
                  placeholder="Numéro de voie et nom de la rue"
                />
              </label>
              <label className={`${LABEL_CLASS} md:col-span-2`}>
                Complément d&apos;adresse
                <input
                  type="text"
                  value={form.billingAddressLine2}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, billingAddressLine2: event.target.value }))
                  }
                  className={INPUT_CLASS}
                  placeholder="Bâtiment, étage, appartement…"
                />
              </label>
              <label className={LABEL_CLASS}>
                Code postal *
                <input
                  type="text"
                  required={form.hasSeparateBillingAddress}
                  value={form.billingPostalCode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, billingPostalCode: event.target.value }))
                  }
                  className={INPUT_CLASS}
                />
              </label>
              <label className={LABEL_CLASS}>
                Ville *
                <input
                  type="text"
                  required={form.hasSeparateBillingAddress}
                  value={form.billingCity}
                  onChange={(event) => setForm((prev) => ({ ...prev, billingCity: event.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>
            </div>
          </section>
        ) : null}

        <CheckoutCartSummary
          items={items}
          pricing={pricing}
          variant="detailed"
          renderItemExtra={(item, index) => {
            const participant = participants[item.id];
            return (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Participant {index + 1}
                  </h3>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className={LABEL_CLASS}>
                    Prénom *
                    <input
                      form={FORM_ID}
                      type="text"
                      required
                      value={participant?.childFirstName ?? ''}
                      onChange={(event) =>
                        updateParticipant(item.id, {
                          childFirstName: event.target.value
                        })
                      }
                      className={INPUT_CLASS}
                      placeholder="Entrez le prénom"
                    />
                  </label>
                  <label className={LABEL_CLASS}>
                    Nom *
                    <input
                      form={FORM_ID}
                      type="text"
                      required
                      value={participant?.childLastName ?? ''}
                      onChange={(event) =>
                        updateParticipant(item.id, {
                          childLastName: event.target.value
                        })
                      }
                      className={INPUT_CLASS}
                      placeholder="Entrez le nom"
                    />
                  </label>
                  <label className={LABEL_CLASS}>
                    Date de naissance *
                    <input
                      form={FORM_ID}
                      type="date"
                      required
                      value={participant?.childBirthdate ?? ''}
                      onChange={(event) =>
                        updateParticipant(item.id, {
                          childBirthdate: event.target.value
                        })
                      }
                      className={INPUT_CLASS}
                    />
                  </label>
                  <fieldset className={LABEL_CLASS}>
                    <legend>Genre</legend>
                    <div className="mt-2 flex flex-wrap items-center gap-4 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 sm:text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          form={FORM_ID}
                          type="radio"
                          name={`gender-${item.id}`}
                          checked={(participant?.childGender ?? '') === 'MASCULIN'}
                          onChange={() =>
                            updateParticipant(item.id, {
                              childGender: 'MASCULIN'
                            })
                          }
                          className="h-4 w-4 border-slate-300"
                        />
                        Masculin
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          form={FORM_ID}
                          type="radio"
                          name={`gender-${item.id}`}
                          checked={(participant?.childGender ?? '') === 'FEMININ'}
                          onChange={() =>
                            updateParticipant(item.id, {
                              childGender: 'FEMININ'
                            })
                          }
                          className="h-4 w-4 border-slate-300"
                        />
                        Féminin
                      </label>
                    </div>
                  </fieldset>
                  <label className={`${LABEL_CLASS} md:col-span-2`}>
                    Infos complémentaires
                    <textarea
                      form={FORM_ID}
                      value={participant?.additionalInfo ?? ''}
                      onChange={(event) =>
                        updateParticipant(item.id, {
                          additionalInfo: event.target.value
                        })
                      }
                      rows={2}
                      className={`${INPUT_CLASS} min-h-[74px] resize-y`}
                      placeholder="Infos complémentaires"
                    />
                  </label>
                </div>
              </div>
            );
          }}
        />

        <section className={SECTION_CARD_CLASS}>
          <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Avantages complémentaires</h2>
          <div className="mt-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <label className={LABEL_CLASS}>
                CSE d&apos;affiliation (facultatif)
                <input
                  type="text"
                  value={form.cseOrganization}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, cseOrganization: event.target.value }))
                  }
                  className={INPUT_CLASS}
                  placeholder="Nom du Comité d'établissement"
                />
              </label>
              <p className="pt-5 text-base italic leading-7 text-slate-400">
                Saisir votre CSE, votre affiliation sera vérifiée. Champ utile pour bénéficier
                d&apos;avantages éventuels.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <label className={LABEL_CLASS}>
                Bons VACAF (facultatif)
                <input
                  type="text"
                  value={form.vacafNumber}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, vacafNumber: event.target.value.toUpperCase() }))
                  }
                  className={INPUT_CLASS}
                  placeholder="7 chiffres ou 7 chiffres + 1 lettre"
                />
              </label>
              <p className="pt-5 text-base italic leading-7 text-slate-400">
                Si l&apos;organisateur accepte les bons VACAF, ils pourront être pris en compte dans
                le traitement final de votre réservation.
              </p>
            </div>
          </div>
        </section>

        <section className={SECTION_CARD_CLASS}>
          <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
            Mode de réservation / paiement
          </h2>
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PAYMENT_MODES.map((mode) => {
                const isActive = form.paymentMode === mode.value;
                return (
                  <label
                    key={mode.value}
                    className={`cursor-pointer rounded-[18px] border px-4 py-4 text-sm font-semibold transition ${
                      isActive
                        ? 'border-accent-400 bg-accent-50 text-accent-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-mode"
                      value={mode.value}
                      checked={isActive}
                      onChange={() => setForm((prev) => ({ ...prev, paymentMode: mode.value }))}
                      className="sr-only"
                    />
                    {mode.label}
                  </label>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-sm">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-slate-700">
                ✓
              </span>
              <span>Demande de réservation envoyée à l&apos;organisateur du séjour</span>
            </div>

            <div className="rounded-[20px] border border-slate-200 bg-slate-100 px-4 py-4 text-base leading-7 text-slate-800 sm:text-lg sm:leading-8">
              « Votre réservation va être envoyée à l&apos;organisateur du séjour choisi. Quand elle
              sera validée, vous recevrez un mail de confirmation. L&apos;organisateur prendra contact
              avec vous dans les meilleurs délais pour finaliser la réservation et mettre en place
              le paiement. »
            </div>

            <p className="text-base leading-8 text-slate-600">
              Vos données personnelles seront utilisées pour traiter votre réservation, pour
              améliorer votre expérience utilisateur sur ce site, et à d&apos;autres fins décrites dans
              notre{' '}
              <Link href="/confidentialite" className="font-medium text-brand-500 underline">
                politique de confidentialité
              </Link>
              .
            </p>

            <div className="border-t border-slate-200 pt-5">
              <label className="flex items-start gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-sm">
                <input
                  type="checkbox"
                  checked={form.acceptsTerms}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      acceptsTerms: event.target.checked,
                      acceptsPrivacy: event.target.checked ? true : prev.acceptsPrivacy
                    }))
                  }
                  className="mt-1 h-5 w-5 rounded border-slate-300"
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

            {errorMessage ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <div className="space-y-3">
              <button
                type="submit"
                className="inline-flex min-h-[68px] w-full items-center justify-center rounded-[20px] bg-accent-500 px-6 text-center text-xl font-black uppercase tracking-[0.1em] text-white shadow-[0_14px_26px_rgba(249,134,32,0.24)] transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || isLoadingPricing || items.length === 0 || !isParticipantsComplete}
              >
                {isSubmitting
                  ? 'Validation...'
                  : isParticipantsComplete
                    ? 'Je réserve !'
                    : 'Compléter les participants'}
              </button>
              <div className="flex justify-end">
                <Link href="/panier" className="text-sm font-medium text-slate-500 underline">
                  Retour panier
                </Link>
              </div>
            </div>

            {pricing ? (
              <p className="text-right text-sm font-semibold text-slate-500">
                Total recalculé : {formatEuroFromCents(pricing.totalCents)}
              </p>
            ) : null}
          </div>
        </section>
      </form>
    </CheckoutFrame>
  );
}
