'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckoutFrame } from '@/components/checkout/CheckoutFrame';
import { CheckoutCartSummary } from '@/components/checkout/CheckoutCartSummary';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import {
  CheckoutAccountExistsError,
  repriceCheckout,
  registerCheckoutClientAccount
} from '@/lib/checkout/client';
import { buildDevMockPricing, isDevBypassCheckout } from '@/lib/checkout/dev-bypass';
import {
  fetchFamilyProfileSnapshot,
  syncFamilyProfileFromCheckout
} from '@/lib/account-profile/client';
import {
  isPasswordPolicyValid,
  PASSWORD_POLICY_HTML_PATTERN,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_MIN_LENGTH
} from '@/lib/auth/password-policy';
import {
  createCheckoutId,
  type CheckoutContact,
  type CheckoutParticipant,
  type CheckoutPricing
} from '@/types/checkout';
import type { FamilyProfile, FamilyProfileChild } from '@/types/family-profile';

const INPUT_CLASS =
  'mt-1.5 min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tracking-normal text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100';
/** Champs plus compacts pour la carte participant (checkout informations). */
const PARTICIPANT_INPUT_CLASS =
  'mt-1 min-h-[30px] w-full rounded-md border border-slate-200/50 bg-white px-2.5 py-1 text-xs tracking-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100';
const PARTICIPANT_CARD_CLASS =
  'rounded-xl border border-transparent bg-transparent px-0 py-1 shadow-none';
const SECTION_CARD_CLASS =
  'rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_16px_44px_rgba(15,23,42,0.05)] sm:px-6';
const LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400';
/** Libellés type « fashion » : interlettrage plus serré (carte participant, avantages complémentaires). */
const COMPACT_LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const FORM_ID = 'checkout-informations-form';

function mapFamilyProfileToCheckoutContact(profile: FamilyProfile): CheckoutContact {
  return {
    billingFirstName: profile.billingFirstName,
    billingLastName: profile.billingLastName,
    email: profile.email,
    phone: profile.phone,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    postalCode: profile.postalCode,
    city: profile.city,
    country: profile.country || 'France',
    hasSeparateBillingAddress: profile.hasSeparateBillingAddress,
    billingAddressLine1: profile.billingAddressLine1,
    billingAddressLine2: profile.billingAddressLine2,
    billingPostalCode: profile.billingPostalCode,
    billingCity: profile.billingCity,
    billingCountry: profile.billingCountry || 'France',
    cseOrganization: profile.cseOrganization,
    vacafNumber: profile.vacafNumber,
    paymentMode: profile.paymentMode,
    acceptsTerms: false,
    acceptsPrivacy: true
  };
}

function isParticipantEmpty(participant: CheckoutParticipant | undefined) {
  if (!participant) return true;
  return !participant.childFirstName && !participant.childLastName && !participant.childBirthdate;
}

function mapChildToParticipant(child: FamilyProfileChild, cartItemId: string): CheckoutParticipant {
  return {
    cartItemId,
    childFirstName: child.firstName,
    childLastName: child.lastName,
    childBirthdate: child.birthdate,
    childGender: child.gender,
    additionalInfo: child.additionalInfo
  };
}

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
  const [pricingErrorMessage, setPricingErrorMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('');
  const [isFamilyAuthenticated, setIsFamilyAuthenticated] = useState(false);
  const [hasPrefilledFromProfile, setHasPrefilledFromProfile] = useState(false);

  useEffect(() => {
    router.prefetch('/checkout/recapitulatif');
  }, [router]);

  useEffect(() => {
    setForm(contact);
  }, [contact]);

  const isParticipantsComplete = useMemo(() => {
    return items.every((item) => {
      const participant = participants[item.id];
      return Boolean(participant?.childFirstName && participant?.childLastName && participant?.childBirthdate);
    });
  }, [items, participants]);

  useEffect(() => {
    if (!hydrated || isDevBypassCheckout() || hasPrefilledFromProfile) return;

    let cancelled = false;

    async function prefillFromAccountProfile() {
      try {
        const snapshot = await fetchFamilyProfileSnapshot();
        if (cancelled) return;

        setIsFamilyAuthenticated(true);
        const nextContact = mapFamilyProfileToCheckoutContact(snapshot.profile);
        setContact(nextContact);
        setForm(nextContact);

        const canPrefillParticipants = items.every((item) => isParticipantEmpty(participants[item.id]));
        if (canPrefillParticipants && snapshot.profile.children.length > 0) {
          items.forEach((item, index) => {
            const child = snapshot.profile.children[index];
            if (!child) return;
            updateParticipant(item.id, mapChildToParticipant(child, item.id));
          });
        }
      } catch {
        if (!cancelled) {
          setIsFamilyAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setHasPrefilledFromProfile(true);
        }
      }
    }

    prefillFromAccountProfile();

    return () => {
      cancelled = true;
    };
  }, [
    hasPrefilledFromProfile,
    hydrated,
    items,
    participants,
    setContact,
    updateParticipant
  ]);
  const hasSelectedSessionForAllItems = useMemo(() => {
    return items.every((item) => Boolean(item.selection.sessionId?.trim()));
  }, [items]);

  const loadPricing = useCallback(async () => {
    setPricingErrorMessage(null);
    setIsLoadingPricing(true);
    try {
      if (isDevBypassCheckout()) {
        setPricing(buildDevMockPricing(items));
        return;
      }

      if (!hasSelectedSessionForAllItems) {
        setPricing(null);
        setPricingErrorMessage(
          'Un séjour du panier n’a pas de session sélectionnée. Retournez au panier pour finaliser la sélection.'
        );
        return;
      }

      const response = await repriceCheckout(checkoutId, items);
      setPricing(response.pricing);
    } catch (error) {
      setPricing(null);
      setPricingErrorMessage(
        error instanceof Error ? error.message : 'Impossible de recalculer le panier pour le moment.'
      );
    } finally {
      setIsLoadingPricing(false);
    }
  }, [checkoutId, hasSelectedSessionForAllItems, items]);

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

      if (isDevBypassCheckout()) {
        const email = normalizedEmail || 'dev@example.local';
        const normalizedContact: CheckoutContact = {
          ...form,
          email,
          billingFirstName: form.billingFirstName.trim() || 'Prénom',
          billingLastName: form.billingLastName.trim() || 'Nom',
          phone: form.phone.trim() || '0612345678',
          addressLine1: form.addressLine1.trim() || '1 rue Dev',
          postalCode: form.postalCode.trim() || '75001',
          city: form.city.trim() || 'Paris',
          country: form.country.trim() || 'France',
          acceptsTerms: true,
          acceptsPrivacy: true,
          vacafNumber: (form.vacafNumber ?? '').toUpperCase(),
          billingAddressLine1: form.hasSeparateBillingAddress
            ? form.billingAddressLine1.trim() || '2 rue Facturation'
            : form.billingAddressLine1,
          billingPostalCode: form.hasSeparateBillingAddress
            ? form.billingPostalCode.trim() || '75002'
            : form.billingPostalCode,
          billingCity: form.hasSeparateBillingAddress ? form.billingCity.trim() || 'Paris' : form.billingCity,
          billingCountry: form.hasSeparateBillingAddress
            ? form.billingCountry.trim() || 'France'
            : form.billingCountry
        };

        setCheckoutId(createCheckoutId());
        setContact(normalizedContact);
        for (const item of items) {
          const p = participants[item.id];
          const gender =
            p?.childGender === 'FEMININ' || p?.childGender === 'MASCULIN' ? p.childGender : 'MASCULIN';
          updateParticipant(item.id, {
            childFirstName: p?.childFirstName?.trim() || 'Enfant',
            childLastName: p?.childLastName?.trim() || 'Dev',
            childBirthdate: p?.childBirthdate || '2015-06-15',
            childGender: gender,
            additionalInfo: p?.additionalInfo ?? ''
          });
        }
        router.push('/checkout/recapitulatif');
        return;
      }

      const normalizedContact: CheckoutContact = {
        ...form,
        email: normalizedEmail,
        vacafNumber: (form.vacafNumber ?? '').toUpperCase()
      };
      setContact(normalizedContact);

      if (!isFamilyAuthenticated) {
        if (!isPasswordPolicyValid(accountPassword)) {
          throw new Error(PASSWORD_POLICY_MESSAGE);
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
        setIsFamilyAuthenticated(true);
      }

      const participantsPayload: CheckoutParticipant[] = items.map((item) => {
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

      await syncFamilyProfileFromCheckout({
        contact: normalizedContact,
        participants: participantsPayload
      });

      router.push('/checkout/recapitulatif');
    } catch (error) {
      if (error instanceof CheckoutAccountExistsError) {
        router.push('/login/familles?redirectTo=/checkout/informations');
        return;
      }
      if (error instanceof Error && error.message.toLowerCase().includes('connexion famille requise')) {
        router.push('/login/familles?redirectTo=/checkout/informations');
        return;
      }
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
          Complétez votre <span className="text-accent-500">réservation</span> !
        </span>
      }
      subtitle="Renseignez les informations de facturation et les participants."
      headerClassName="border-0 bg-transparent p-0 shadow-none"
      headingClassName="mt-8 sm:mt-10"
      contentClassName="border-0 bg-transparent p-0 shadow-none"
    >
      <form id={FORM_ID} onSubmit={onSubmit} className="space-y-6">
        {isDevBypassCheckout() ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Mode dev (checkout sans API) :</span> actif en{' '}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">next dev</code> par défaut, ou si{' '}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">NEXT_PUBLIC_DEV_BYPASS_CHECKOUT=1</code>. Pour
            tester les vraies routes :{' '}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">NEXT_PUBLIC_DEV_BYPASS_CHECKOUT=0</code> puis
            redémarrer le serveur.
          </p>
        ) : null}
        <section className={SECTION_CARD_CLASS}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
                {isFamilyAuthenticated ? 'Votre compte famille' : 'Créez votre compte'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Utilisez vos coordonnées principales, puis indiquez si l’adresse de facturation doit être différente.
              </p>
            </div>
            {isFamilyAuthenticated ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Compte prêt
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className={COMPACT_LABEL_CLASS}>
              Prénom *
              <input
                type="text"
                required
                value={form.billingFirstName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, billingFirstName: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </label>
            <label className={COMPACT_LABEL_CLASS}>
              Nom *
              <input
                type="text"
                required
                value={form.billingLastName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, billingLastName: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </label>
            <label className={`${COMPACT_LABEL_CLASS} md:col-span-2`}>
              Numéro et nom de rue *
              <input
                type="text"
                required
                value={form.addressLine1}
                onChange={(event) => setForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className={`${COMPACT_LABEL_CLASS} md:col-span-2`}>
              Complément d&apos;adresse
              <input
                type="text"
                value={form.addressLine2}
                onChange={(event) => setForm((prev) => ({ ...prev, addressLine2: event.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className={COMPACT_LABEL_CLASS}>
              Code postal *
              <input
                type="text"
                required
                value={form.postalCode}
                onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className={COMPACT_LABEL_CLASS}>
              Ville *
              <input
                type="text"
                required
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className={COMPACT_LABEL_CLASS}>
              Téléphone *
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className={COMPACT_LABEL_CLASS}>
              E-mail *
              <input
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value.trim() }))}
                className={INPUT_CLASS}
              />
            </label>
            {isFamilyAuthenticated ? (
              <p className="md:col-span-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Vous êtes connecté(e) en famille. Vos informations seront mises à jour sur ce compte.
              </p>
            ) : (
              <>
                <label className={COMPACT_LABEL_CLASS}>
                  Mot de passe *
                  <input
                    type="password"
                    required
                    minLength={PASSWORD_POLICY_MIN_LENGTH}
                    pattern={PASSWORD_POLICY_HTML_PATTERN}
                    title={PASSWORD_POLICY_MESSAGE}
                    autoComplete="new-password"
                    value={accountPassword}
                    onChange={(event) => setAccountPassword(event.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className={COMPACT_LABEL_CLASS}>
                  Confirmer le mot de passe *
                  <input
                    type="password"
                    required
                    minLength={PASSWORD_POLICY_MIN_LENGTH}
                    pattern={PASSWORD_POLICY_HTML_PATTERN}
                    title={PASSWORD_POLICY_MESSAGE}
                    autoComplete="new-password"
                    value={accountPasswordConfirm}
                    onChange={(event) => setAccountPasswordConfirm(event.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <p className="md:col-span-2 text-xs text-slate-500">{PASSWORD_POLICY_MESSAGE}</p>
              </>
            )}
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

        <div id="checkout-participants">
          {pricingErrorMessage ? (
            <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {pricingErrorMessage}
            </p>
          ) : null}
          <CheckoutCartSummary
            items={items}
            pricing={pricing}
            variant="detailed"
            renderItemExtra={(item, index) => {
              const participant = participants[item.id];
              return (
                <div className={PARTICIPANT_CARD_CLASS}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Participant {index + 1}
                    </h3>
                  </div>
                  <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
                    <label className={COMPACT_LABEL_CLASS}>
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
                        className={PARTICIPANT_INPUT_CLASS}
                      />
                    </label>
                    <label className={COMPACT_LABEL_CLASS}>
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
                        className={PARTICIPANT_INPUT_CLASS}
                      />
                    </label>
                    <label className={COMPACT_LABEL_CLASS}>
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
                        className={PARTICIPANT_INPUT_CLASS}
                      />
                    </label>
                    <fieldset className={COMPACT_LABEL_CLASS}>
                      <legend>Genre</legend>
                      <div className="mt-1 flex flex-wrap items-center gap-3 rounded-md border border-transparent bg-transparent px-0 py-1 text-xs font-semibold tracking-normal text-slate-600">
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
                    <label className={`${COMPACT_LABEL_CLASS} md:col-span-2`}>
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
                        className={`${PARTICIPANT_INPUT_CLASS} min-h-[40px] resize-y`}
                      />
                    </label>
                  </div>
                </div>
              );
            }}
          />
        </div>

        <section className={SECTION_CARD_CLASS}>
          {errorMessage ? (
            <p className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          <div className="space-y-3">
            <button
              type="submit"
              className="cta-orange-sweep mx-auto flex min-h-[46px] w-full max-w-[280px] items-center justify-center rounded-xl px-5 py-2 text-center text-sm font-bold uppercase tracking-wide text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[48px] sm:max-w-[320px] sm:text-base"
              disabled={
                isSubmitting ||
                isLoadingPricing ||
                items.length === 0 ||
                !isParticipantsComplete ||
                (!isDevBypassCheckout() && !hasSelectedSessionForAllItems)
              }
            >
              {isSubmitting
                ? 'Enregistrement...'
                : isParticipantsComplete
                  ? 'Continuer vers le récapitulatif'
                  : 'Compléter les participants'}
            </button>
            <div className="flex justify-end">
              <Link href="/panier" className="text-sm font-medium text-slate-500 underline">
                Retour panier
              </Link>
            </div>
          </div>
        </section>
      </form>
    </CheckoutFrame>
  );
}
