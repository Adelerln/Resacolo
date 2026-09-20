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
  createFamilyChild,
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
import type { FamilyProfile, FamilyProfileChild, FamilyProfileChildInput } from '@/types/family-profile';

const EMPTY_CHECKOUT_CHILD_FORM: FamilyProfileChildInput = {
  firstName: '',
  lastName: '',
  birthdate: '',
  gender: '',
  additionalInfo: ''
};

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
    ancvConnectMatricule: '',
    ancvConnectAmount: '',
    paymentMode: profile.paymentMode,
    parent1Status: profile.parent1Status,
    parent1StatusOther: profile.parent1StatusOther,
    acceptsTerms: false,
    acceptsPrivacy: true
  };
}

function isParticipantEmpty(participant: CheckoutParticipant | undefined) {
  if (!participant) return true;
  return (
    !participant.childId &&
    !participant.childFirstName &&
    !participant.childLastName &&
    !participant.childBirthdate
  );
}

function mapChildToParticipant(child: FamilyProfileChild, cartItemId: string): CheckoutParticipant {
  return {
    cartItemId,
    childId: child.id,
    childFirstName: child.firstName,
    childLastName: child.lastName,
    childBirthdate: child.birthdate.slice(0, 10),
    childGender: child.gender,
    additionalInfo: child.additionalInfo
  };
}

function matchesParticipantToChild(
  participant: CheckoutParticipant | undefined,
  child: FamilyProfileChild
) {
  if (!participant) return false;
  const participantBirthdate = (participant.childBirthdate ?? '').trim().slice(0, 10);
  const childBirthdate = (child.birthdate ?? '').trim().slice(0, 10);
  return (
    participant.childFirstName.trim().toLowerCase() === child.firstName.trim().toLowerCase() &&
    participant.childLastName.trim().toLowerCase() === child.lastName.trim().toLowerCase() &&
    participantBirthdate === childBirthdate
  );
}

function formatChildBirthdate(value: string) {
  if (!value.trim()) return 'Date non renseignée';
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
}

function formatChildOptionLabel(child: FamilyProfileChild) {
  const identity = [child.firstName, child.lastName.toUpperCase()].filter(Boolean).join(' ').trim();
  return `${identity} · ${formatChildBirthdate(child.birthdate)}`;
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
  const [availableChildren, setAvailableChildren] = useState<FamilyProfileChild[]>([]);
  const [showAddChildForm, setShowAddChildForm] = useState(false);
  const [newChildForm, setNewChildForm] = useState<FamilyProfileChildInput>(EMPTY_CHECKOUT_CHILD_FORM);
  const [childFormError, setChildFormError] = useState<string | null>(null);
  const [isSavingChild, setIsSavingChild] = useState(false);
  const [addingChildForItemId, setAddingChildForItemId] = useState<string | null>(null);

  function isAuthRequiredProfileError(error: unknown) {
    if (!(error instanceof Error)) return false;
    const normalized = error.message.toLowerCase();
    return normalized.includes('connexion famille requise') || normalized.includes('auth_required');
  }

  async function refreshAvailableChildren() {
    const snapshot = await fetchFamilyProfileSnapshot();
    setIsFamilyAuthenticated(true);
    setAvailableChildren(snapshot.profile.children);
    return snapshot.profile.children;
  }

  async function handleCreateChildForItem(cartItemId: string) {
    setChildFormError(null);
    setIsSavingChild(true);
    try {
      const payload: FamilyProfileChildInput = {
        firstName: newChildForm.firstName.trim(),
        lastName: newChildForm.lastName.trim(),
        birthdate: newChildForm.birthdate,
        gender: newChildForm.gender,
        additionalInfo: newChildForm.additionalInfo.trim()
      };
      const response = await createFamilyChild(payload);
      setAvailableChildren((prev) => {
        const without = prev.filter((child) => child.id !== response.child.id);
        return [response.child, ...without].sort((left, right) =>
          right.birthdate.localeCompare(left.birthdate)
        );
      });
      updateParticipant(cartItemId, mapChildToParticipant(response.child, cartItemId));
      setNewChildForm(EMPTY_CHECKOUT_CHILD_FORM);
      setShowAddChildForm(false);
      setAddingChildForItemId(null);
    } catch (error) {
      setChildFormError(error instanceof Error ? error.message : "Impossible d'enregistrer l'enfant.");
    } finally {
      setIsSavingChild(false);
    }
  }

  useEffect(() => {
    router.prefetch('/checkout/recapitulatif');
  }, [router]);

  useEffect(() => {
    setForm(contact);
  }, [contact]);

  const isParticipantsComplete = useMemo(() => {
    return items.every((item) => {
      const participant = participants[item.id];
      return Boolean(participant?.childId);
    });
  }, [items, participants]);
  const canCreateAccountBeforeChildren = !isFamilyAuthenticated && availableChildren.length === 0;

  useEffect(() => {
    // Même en mode dev bypass, on peut être connecté(e) : on pré-remplit depuis le profil si possible,
    // pour éviter de redemander mot de passe / adresse.
    if (!hydrated || hasPrefilledFromProfile) return;

    let cancelled = false;

    async function prefillFromAccountProfile() {
      try {
        const snapshot = await fetchFamilyProfileSnapshot();
        if (cancelled) return;

        setIsFamilyAuthenticated(true);
        setAvailableChildren(snapshot.profile.children);
        const nextContact = mapFamilyProfileToCheckoutContact(snapshot.profile);
        setContact(nextContact);
        setForm(nextContact);

        // Toujours réaligner les participants sur les IDs réels (évite les doublons / ids obsolètes).
        items.forEach((item, index) => {
          const participant = participants[item.id];
          const byId = participant?.childId
            ? snapshot.profile.children.find((child) => child.id === participant.childId)
            : null;
          if (byId) {
            updateParticipant(item.id, mapChildToParticipant(byId, item.id));
            return;
          }
          const matchedChild = snapshot.profile.children.find((child) =>
            matchesParticipantToChild(participant, child)
          );
          if (matchedChild) {
            updateParticipant(item.id, mapChildToParticipant(matchedChild, item.id));
            return;
          }
          if (isParticipantEmpty(participant) && snapshot.profile.children[index]) {
            updateParticipant(
              item.id,
              mapChildToParticipant(snapshot.profile.children[index]!, item.id)
            );
          }
        });
      } catch (error) {
        if (cancelled) return;
        if (isAuthRequiredProfileError(error)) {
          setIsFamilyAuthenticated(false);
          setAvailableChildren([]);
        }
        // Ne pas vider la liste sur une erreur réseau : ça bloquait à tort la sélection d'enfant.
      } finally {
        if (cancelled) return;
        setHasPrefilledFromProfile(true);
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

  useEffect(() => {
    if (!hydrated || !hasPrefilledFromProfile) return;

    let cancelled = false;

    async function reloadChildren() {
      try {
        const children = await refreshAvailableChildren();
        if (cancelled) return;
        items.forEach((item) => {
          const participant = participants[item.id];
          if (participant?.childId) return;
          const matchedChild = children.find((child) => matchesParticipantToChild(participant, child));
          if (!matchedChild) return;
          updateParticipant(item.id, mapChildToParticipant(matchedChild, item.id));
        });
      } catch {
        // Ignore refresh errors (ex. session expirée).
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void reloadChildren();
      }
    }

    window.addEventListener('focus', reloadChildren);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', reloadChildren);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // Intentionnellement limité : recharger au retour sur l'onglet, pas à chaque keystroke participant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPrefilledFromProfile, hydrated]);

  useEffect(() => {
    if (isFamilyAuthenticated && availableChildren.length === 0) {
      setShowAddChildForm(true);
    }
  }, [availableChildren.length, isFamilyAuthenticated]);
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

      if (!form.parent1Status) {
        throw new Error('Indiquez votre rôle (père, mère, grand-parent ou autre).');
      }
      if (form.parent1Status === 'autre' && !form.parent1StatusOther.trim()) {
        throw new Error('Précisez votre statut parental.');
      }

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
        if (availableChildren.length === 0) {
          router.push('/mon-compte');
          return;
        }
        for (const [index, item] of items.entries()) {
          const selectedChild = availableChildren[index] ?? availableChildren[0];
          if (!selectedChild) continue;
          updateParticipant(item.id, mapChildToParticipant(selectedChild, item.id));
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

      const participantsPayload: CheckoutParticipant[] = canCreateAccountBeforeChildren
        ? []
        : items.map((item) => {
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
          });

      await syncFamilyProfileFromCheckout({
        contact: normalizedContact,
        participants: participantsPayload
      });

      if (canCreateAccountBeforeChildren) {
        router.push('/mon-compte');
        return;
      }

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

          {isFamilyAuthenticated ? (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              <p className="font-semibold">Vous êtes déjà connecté(e).</p>
              <p className="mt-1 text-emerald-900/80">
                Vos coordonnées ont été préremplies depuis votre compte et restent modifiables ici pour finaliser la
                réservation.
              </p>
            </div>
          ) : null}

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
            <label className={COMPACT_LABEL_CLASS}>
              Statut *
              <select
                required
                value={form.parent1Status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    parent1Status: event.target.value as CheckoutContact['parent1Status'],
                    parent1StatusOther:
                      event.target.value === 'autre' ? prev.parent1StatusOther : ''
                  }))
                }
                className={INPUT_CLASS}
              >
                <option value="">Sélectionner</option>
                <option value="pere">Père</option>
                <option value="mere">Mère</option>
                <option value="grand-parent">Grand-parent</option>
                <option value="autre">Autre</option>
              </select>
            </label>
            {form.parent1Status === 'autre' ? (
              <label className={COMPACT_LABEL_CLASS}>
                Précisez le statut *
                <input
                  type="text"
                  required
                  value={form.parent1StatusOther}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, parent1StatusOther: event.target.value }))
                  }
                  className={INPUT_CLASS}
                  placeholder="Ex. tuteur, belle-mère…"
                />
              </label>
            ) : null}
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
            {!isFamilyAuthenticated ? (
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
            ) : null}
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
              <span>Mon adresse de facturation est différente de mon adresse principale</span>
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
                  {availableChildren.length > 0 ? (
                    <div className="mt-2.5 space-y-3">
                      <label className={COMPACT_LABEL_CLASS}>
                        Enfant *
                        <select
                          form={FORM_ID}
                          required
                          value={participant?.childId ?? ''}
                          onChange={(event) => {
                            const selectedChild =
                              availableChildren.find((child) => child.id === event.target.value) ?? null;
                            if (!selectedChild) {
                              updateParticipant(item.id, {
                                childId: null,
                                childFirstName: '',
                                childLastName: '',
                                childBirthdate: '',
                                childGender: '',
                                additionalInfo: ''
                              });
                              return;
                            }
                            updateParticipant(item.id, mapChildToParticipant(selectedChild, item.id));
                          }}
                          className={PARTICIPANT_INPUT_CLASS}
                        >
                          <option value="">Sélectionner un enfant</option>
                          {availableChildren.map((child) => (
                            <option key={child.id} value={child.id}>
                              {formatChildOptionLabel(child)}
                            </option>
                          ))}
                        </select>
                      </label>

                      {participant?.childId ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">
                            {[participant.childFirstName, participant.childLastName.toUpperCase()]
                              .filter(Boolean)
                              .join(' ')}
                          </p>
                          <p className="mt-1">Né(e) le {formatChildBirthdate(participant.childBirthdate)}</p>
                          {participant.childGender ? (
                            <p className="mt-1">Genre : {participant.childGender === 'FEMININ' ? 'Féminin' : 'Masculin'}</p>
                          ) : null}
                          {participant.additionalInfo.trim() ? (
                            <p className="mt-2 whitespace-pre-wrap text-slate-600">
                              {participant.additionalInfo.trim()}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {isFamilyAuthenticated ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand-700 underline"
                          onClick={() => {
                            setAddingChildForItemId(item.id);
                            setShowAddChildForm(true);
                            setChildFormError(null);
                          }}
                        >
                          Ajouter un autre enfant
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      <p className="font-semibold">Aucun enfant enregistré sur ce compte.</p>
                      {isFamilyAuthenticated ? (
                        <p className="mt-1">Ajoutez un enfant ci-dessous pour poursuivre la réservation.</p>
                      ) : (
                        <>
                          <p className="mt-1">
                            Créez votre compte (ou connectez-vous), puis ajoutez un enfant pour sélectionner le
                            participant.
                          </p>
                          <Link
                            href="/mon-compte"
                            className="mt-3 inline-flex text-sm font-semibold text-amber-900 underline"
                          >
                            Gérer mes enfants
                          </Link>
                        </>
                      )}
                      {isFamilyAuthenticated ? (
                        <button
                          type="button"
                          className="mt-3 inline-flex text-sm font-semibold text-amber-900 underline"
                          onClick={() => {
                            setAddingChildForItemId(item.id);
                            setShowAddChildForm(true);
                            setChildFormError(null);
                          }}
                        >
                          Ajouter un enfant
                        </button>
                      ) : null}
                    </div>
                  )}

                  {isFamilyAuthenticated &&
                  showAddChildForm &&
                  (addingChildForItemId === item.id || (!addingChildForItemId && availableChildren.length === 0)) ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nouvel enfant</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className={COMPACT_LABEL_CLASS}>
                          Prénom *
                          <input
                            type="text"
                            value={newChildForm.firstName}
                            onChange={(event) =>
                              setNewChildForm((prev) => ({ ...prev, firstName: event.target.value }))
                            }
                            className={PARTICIPANT_INPUT_CLASS}
                            required
                          />
                        </label>
                        <label className={COMPACT_LABEL_CLASS}>
                          Nom *
                          <input
                            type="text"
                            value={newChildForm.lastName}
                            onChange={(event) =>
                              setNewChildForm((prev) => ({ ...prev, lastName: event.target.value }))
                            }
                            className={PARTICIPANT_INPUT_CLASS}
                            required
                          />
                        </label>
                        <label className={COMPACT_LABEL_CLASS}>
                          Date de naissance *
                          <input
                            type="date"
                            value={newChildForm.birthdate}
                            onChange={(event) =>
                              setNewChildForm((prev) => ({ ...prev, birthdate: event.target.value }))
                            }
                            className={PARTICIPANT_INPUT_CLASS}
                            required
                          />
                        </label>
                        <label className={COMPACT_LABEL_CLASS}>
                          Genre
                          <select
                            value={newChildForm.gender}
                            onChange={(event) =>
                              setNewChildForm((prev) => ({
                                ...prev,
                                gender: event.target.value as FamilyProfileChildInput['gender']
                              }))
                            }
                            className={PARTICIPANT_INPUT_CLASS}
                          >
                            <option value="">Non précisé</option>
                            <option value="MASCULIN">Masculin</option>
                            <option value="FEMININ">Féminin</option>
                          </select>
                        </label>
                      </div>
                      {childFormError ? (
                        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          {childFormError}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isSavingChild}
                          className="btn btn-primary btn-sm"
                          onClick={() => void handleCreateChildForItem(item.id)}
                        >
                          {isSavingChild ? 'Enregistrement...' : 'Enregistrer l’enfant'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setShowAddChildForm(false);
                            setAddingChildForItemId(null);
                            setChildFormError(null);
                            setNewChildForm(EMPTY_CHECKOUT_CHILD_FORM);
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : null}
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
                (!isParticipantsComplete && !canCreateAccountBeforeChildren) ||
                (!isDevBypassCheckout() && !hasSelectedSessionForAllItems)
              }
            >
              {isSubmitting
                ? 'Enregistrement...'
                : canCreateAccountBeforeChildren
                  ? 'Créer mon compte pour ajouter un enfant'
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
