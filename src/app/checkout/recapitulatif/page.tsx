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
  createPaymentIntent,
  createCheckoutSession,
  repriceCheckout,
  validateCheckoutContact,
  validateCheckoutParticipants
} from '@/lib/checkout/client';
import { buildDevMockPricing, isDevBypassCheckout } from '@/lib/checkout/dev-bypass';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';
import {
  getOrganizerSelection,
  normalizeCheckoutContact,
  patchOrganizerSelection,
  type CheckoutContact,
  type CheckoutParticipant,
  type CheckoutPricing
} from '@/types/checkout';
import { resolveOrderRequestKind } from '@/lib/order-workflow';
import { isPartnerFullCoverageCheckout } from '@/lib/partner-offers';
import { formatNoPaymentAsBeneficiaryMessage } from '@/lib/partner-beneficiary-copy';
import { fetchFamilyProfileSnapshot } from '@/lib/account-profile/client';
import {
  normalizeVacafNumberInput,
  validateVacafNumber
} from '@/lib/vacaf-number';
import {
  ANCV_CONNECT_MATRICULE_HINT,
  normalizeAncvConnectMatriculeInput,
  resolveAncvConnectOrderPayableTotalCents,
  validateAncvConnectAmountAgainstOrderTotal,
  validateAncvConnectMatricule
} from '@/lib/ancv-connect-matricule';

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
  { value: 'FULL', label: 'Paiement de la totalité en CB' },
  { value: 'DEPOSIT_200', label: "Paiement d'un acompte (200 €) en CB" },
  { value: 'CV_CONNECT', label: 'Paiement en ANCV Connect' },
  { value: 'CV_PAPER', label: 'Paiement en ANCV papier' },
  { value: 'DEFERRED', label: 'Paiement différé' }
];
const QUOTE_PAYMENT_MODES = new Set<CheckoutContact['paymentMode']>(['CV_CONNECT', 'CV_PAPER', 'DEFERRED']);

type OrganizerCheckoutSettings = {
  acceptsAncvPaper: boolean;
  acceptsAncvConnect: boolean;
  isVacafApproved: boolean;
};

function requiresOnlinePaymentStep(paymentMode: CheckoutContact['paymentMode'], isManualRequest: boolean) {
  if (isManualRequest) return false;
  return paymentMode === 'FULL' || paymentMode === 'DEPOSIT_200';
}

function parseAncvConnectAmount(value: string) {
  const normalized = value.replace(',', '.').trim();
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

function buildGroupPricingSummary(pricingItems: CheckoutPricing['items']) {
  const financeRequiresQuote = pricingItems.some((item) => item.financeRequiresQuote);
  return {
    totalCents: pricingItems.reduce((sum, item) => sum + item.totalPriceCents, 0),
    financeRequiresQuote,
    financePartnerContributionTotalCents: pricingItems.reduce(
      (sum, item) => sum + Math.max(0, item.financePartnerContributionCents ?? 0),
      0
    ),
    financeFamilyPayableTotalCents: financeRequiresQuote
      ? null
      : pricingItems.reduce((sum, item) => sum + Math.max(0, item.financeFamilyPayableCents ?? item.totalPriceCents), 0)
  };
}

export default function CheckoutRecapitulatifPage() {
  const router = useRouter();
  const { items } = useCart();
  const { hydrated, checkoutId, contact, participants, setContact, setCheckoutId } = useCheckout();
  const [pricing, setPricing] = useState<CheckoutPricing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentSubmitError, setPaymentSubmitError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [organizerCgvUrls, setOrganizerCgvUrls] = useState<Record<string, string>>({});
  const [organizerCheckoutSettingsById, setOrganizerCheckoutSettingsById] = useState<Record<string, OrganizerCheckoutSettings>>({});
  const [hasCseAffiliation, setHasCseAffiliation] = useState<boolean | null>(null);
  const [wantsVacafAidByOrganizer, setWantsVacafAidByOrganizer] = useState<Record<string, boolean>>({});
  const organizerIds = useMemo(() => Array.from(new Set(items.map((item) => item.organizerId).filter(Boolean))), [items]);
  const primaryOrganizerId = organizerIds[0] ?? '';
  const financeMode = pricing?.financeMode ?? null;
  const financeRequiresQuote = Boolean(pricing?.financeRequiresQuote);
  const financeFamilyPayableTotalCents = pricing?.financeFamilyPayableTotalCents ?? null;
  const isPartnerTotalCoverage = pricing ? isPartnerFullCoverageCheckout(pricing) : false;
  const showCseAffiliationField = !isPartnerTotalCoverage && hasCseAffiliation === false;
  const showComplementaryBenefitsCard = showCseAffiliationField;
  const organizerGroups = useMemo(() => {
    return organizerIds.map((organizerId) => {
      const organizerItems = items.filter((item) => item.organizerId === organizerId);
      const pricingItems = pricing?.items.filter((item) => item.organizerId === organizerId) ?? [];
      const groupPricing = buildGroupPricingSummary(pricingItems);
      const settings = organizerCheckoutSettingsById[organizerId];
      const selection = getOrganizerSelection(contact, organizerId);
      const requestKind = settings
        ? resolveOrderRequestKind(
            { paymentMode: selection.paymentMode, vacafNumber: selection.vacafNumber },
            {
              accepts_ancv_paper: settings.acceptsAncvPaper,
              accepts_ancv_connect: settings.acceptsAncvConnect,
              is_vacaf_approved: settings.isVacafApproved
            }
          )
        : null;
      const groupIsPartnerTotalCoverage = !requestKind && isPartnerFullCoverageCheckout(groupPricing);
      const availablePaymentModes = PAYMENT_MODES.filter((mode) => {
        if (mode.value === 'CV_PAPER') return settings?.acceptsAncvPaper ?? false;
        if (mode.value === 'CV_CONNECT') return settings?.acceptsAncvConnect ?? false;
        return true;
      });
      const displayedPaymentModes = groupPricing.financeRequiresQuote
        ? availablePaymentModes.filter((mode) => QUOTE_PAYMENT_MODES.has(mode.value))
        : availablePaymentModes;

      return {
        organizerId,
        organizerName: organizerItems[0]?.organizerName ?? `Organisme ${organizerId}`,
        selection,
        settings,
        requestKind,
        pricing: groupPricing,
        isPartnerTotalCoverage: groupIsPartnerTotalCoverage,
        availablePaymentModes,
        displayedPaymentModes,
        hasAidSelectionOptions:
          !groupIsPartnerTotalCoverage &&
          Boolean(settings?.acceptsAncvPaper || settings?.acceptsAncvConnect || settings?.isVacafApproved)
      };
    });
  }, [contact, items, organizerCheckoutSettingsById, organizerIds, pricing]);
  const primaryGroup = organizerGroups[0] ?? null;
  const displayedPaymentModes = primaryGroup?.displayedPaymentModes ?? [];
  const organizerCheckoutSettings = primaryGroup?.settings ?? null;
  const requestKind = primaryGroup?.requestKind ?? null;
  const wantsVacafAid = primaryOrganizerId ? Boolean(wantsVacafAidByOrganizer[primaryOrganizerId]) : false;
  const organizerCgvUrl = organizerCgvUrls[primaryOrganizerId] ?? '/cgv-organisateur';
  const paymentRequiresOnlineStep = organizerGroups.some(
    (group) =>
      !group.pricing.financeRequiresQuote &&
      !group.isPartnerTotalCoverage &&
      requiresOnlinePaymentStep(group.selection.paymentMode, Boolean(group.requestKind))
  );

  useEffect(() => {
    if (paymentRequiresOnlineStep) {
      router.prefetch('/checkout/paiement');
    }
  }, [paymentRequiresOnlineStep, router]);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;

    async function loadCseAffiliation() {
      try {
        const snapshot = await fetchFamilyProfileSnapshot();
        if (!cancelled) {
          setHasCseAffiliation(Boolean(snapshot.cseAffiliation));
        }
      } catch {
        if (!cancelled) {
          setHasCseAffiliation(false);
        }
      }
    }

    void loadCseAffiliation();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    const next = Object.fromEntries(
      organizerIds.map((organizerId) => {
        const selection = getOrganizerSelection(contact, organizerId);
        return [organizerId, Boolean(selection.vacafNumber.trim())];
      })
    );
    setWantsVacafAidByOrganizer(next);
  }, [contact, organizerIds]);

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

  useEffect(() => {
    let cancelled = false;

    async function loadOrganizerContext() {
      if (organizerIds.length === 0) {
        setOrganizerCgvUrls({});
        setOrganizerCheckoutSettingsById({});
        return;
      }

      const [cgvEntries, settingsEntries] = await Promise.all([
        Promise.all(
          organizerIds.map(async (organizerId) => {
            try {
              const response = await fetch(`/api/organizers/${organizerId}/cgv-url`, { cache: 'no-store' });
              if (!response.ok) return [organizerId, '/cgv-organisateur'] as const;
              const data = (await response.json()) as { url?: unknown };
              const url = typeof data.url === 'string' && data.url.trim() ? data.url.trim() : '/cgv-organisateur';
              return [organizerId, url] as const;
            } catch {
              return [organizerId, '/cgv-organisateur'] as const;
            }
          })
        ),
        Promise.all(
          organizerIds.map(async (organizerId) => {
            try {
              const response = await fetch(`/api/organizers/${organizerId}/checkout-settings`, { cache: 'no-store' });
              if (!response.ok) {
                return [
                  organizerId,
                  {
                    acceptsAncvPaper: false,
                    acceptsAncvConnect: false,
                    isVacafApproved: false
                  }
                ] as const;
              }
              const payload = (await response.json()) as Partial<OrganizerCheckoutSettings>;
              return [
                organizerId,
                {
                  acceptsAncvPaper: Boolean(payload.acceptsAncvPaper),
                  acceptsAncvConnect: Boolean(payload.acceptsAncvConnect),
                  isVacafApproved: Boolean(payload.isVacafApproved)
                }
              ] as const;
            } catch {
              return [
                organizerId,
                {
                  acceptsAncvPaper: false,
                  acceptsAncvConnect: false,
                  isVacafApproved: false
                }
              ] as const;
            }
          })
        )
      ]);

      if (cancelled) return;
      setOrganizerCgvUrls(Object.fromEntries(cgvEntries));
      setOrganizerCheckoutSettingsById(Object.fromEntries(settingsEntries));
    }

    void loadOrganizerContext();
    return () => {
      cancelled = true;
    };
  }, [organizerIds]);

  function patchContact(patch: Partial<CheckoutContact>) {
    setContact(normalizeCheckoutContact({ ...contact, ...patch }));
  }

  function patchOrganizerPaymentSelection(
    organizerId: string,
    patch: Partial<ReturnType<typeof getOrganizerSelection>>
  ) {
    setContact(patchOrganizerSelection(contact, organizerId, patch));
  }

  function setWantsVacafAidForOrganizer(organizerId: string, next: boolean) {
    setWantsVacafAidByOrganizer((prev) => ({
      ...prev,
      [organizerId]: next
    }));
  }

  async function handleContinueToPayment() {
    setPaymentSubmitError(null);
    if (organizerGroups.some((group) => !group.settings)) {
      setPaymentSubmitError("Chargement des modalités des organismes en cours, réessayez dans un instant.");
      return;
    }
    if (!contact.acceptsTerms) {
      setPaymentSubmitError('Vous devez accepter les conditions générales pour continuer.');
      return;
    }

    for (const group of organizerGroups) {
      const settings = group.settings;
      if (!settings) continue;

      if (group.selection.vacafNumber.trim() && !settings.isVacafApproved) {
        setPaymentSubmitError(`L'organisme « ${group.organizerName} » n'est pas agréé VACAF National.`);
        return;
      }
      if (group.selection.vacafNumber.trim()) {
        const vacafError = validateVacafNumber(group.selection.vacafNumber);
        if (vacafError) {
          setPaymentSubmitError(`${group.organizerName} : ${vacafError}`);
          return;
        }
      }
      if (group.selection.paymentMode === 'CV_CONNECT') {
        if (!settings.acceptsAncvConnect) {
          setPaymentSubmitError(`L'organisme « ${group.organizerName} » n'accepte pas ANCV Connect.`);
          return;
        }
        if (!group.selection.ancvConnectMatricule.trim()) {
          setPaymentSubmitError(`Veuillez renseigner votre matricule ANCV Connect pour « ${group.organizerName} ».`);
          return;
        }
        const ancvMatriculeError = validateAncvConnectMatricule(group.selection.ancvConnectMatricule);
        if (ancvMatriculeError) {
          setPaymentSubmitError(`${group.organizerName} : ${ancvMatriculeError}`);
          return;
        }
        const ancvAmount = parseAncvConnectAmount(group.selection.ancvConnectAmount);
        if (!Number.isFinite(ancvAmount) || ancvAmount <= 0) {
          setPaymentSubmitError(`Veuillez renseigner un montant ANCV Connect valide pour « ${group.organizerName} ».`);
          return;
        }
        const orderPayableTotalCents = resolveAncvConnectOrderPayableTotalCents(
          group.pricing.financeFamilyPayableTotalCents,
          group.pricing.totalCents
        );
        const ancvAmountError = validateAncvConnectAmountAgainstOrderTotal(
          group.selection.ancvConnectAmount,
          orderPayableTotalCents
        );
        if (ancvAmountError) {
          setPaymentSubmitError(`${group.organizerName} : ${ancvAmountError}`);
          return;
        }
      }
    }

    setIsSubmittingPayment(true);
    try {
      if (isDevBypassCheckout()) {
        if (paymentRequiresOnlineStep) {
          router.push('/checkout/paiement');
        } else {
          router.push('/checkout/confirmation/dev-order?mode=dev-bypass');
        }
        return;
      }

      const session = await createCheckoutSession(items);
      const primarySelection = primaryOrganizerId ? getOrganizerSelection(contact, primaryOrganizerId) : null;
      const normalizedSelections = Object.fromEntries(
        organizerIds.map((organizerId) => {
          const selection = getOrganizerSelection(contact, organizerId);
          return [
            organizerId,
            {
              ...selection,
              vacafNumber: normalizeVacafNumberInput(selection.vacafNumber ?? ''),
              ancvConnectMatricule: normalizeAncvConnectMatriculeInput(selection.ancvConnectMatricule ?? '')
            }
          ];
        })
      );
      const normalizedContact: CheckoutContact = normalizeCheckoutContact({
        ...contact,
        email: contact.email.trim().toLowerCase(),
        paymentMode: primarySelection?.paymentMode ?? contact.paymentMode,
        vacafNumber: normalizeVacafNumberInput(primarySelection?.vacafNumber ?? contact.vacafNumber ?? ''),
        ancvConnectMatricule: normalizeAncvConnectMatriculeInput(
          primarySelection?.ancvConnectMatricule ?? contact.ancvConnectMatricule ?? ''
        ),
        ancvConnectAmount: primarySelection?.ancvConnectAmount ?? contact.ancvConnectAmount,
        organizerSelections: normalizedSelections
      });

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

      if (paymentRequiresOnlineStep) {
        router.push('/checkout/paiement');
        return;
      }

      const response = await createPaymentIntent({
        checkoutId: session.checkoutId,
        items,
        contact: normalizedContact,
        participants: participantPayload
      });

      router.push(response.confirmationPath);
    } catch (error) {
      setPaymentSubmitError(
        error instanceof Error ? error.message : 'Impossible de valider la commande.'
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

        {showComplementaryBenefitsCard ? (
          <section className={SECTION_CARD_CLASS}>
            <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Avantages complémentaires</h2>
            <div className="mt-5 space-y-5">
              {showCseAffiliationField ? (
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
              ) : null}

            </div>
          </section>
        ) : null}

        <section className={SECTION_CARD_CLASS}>
          <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Mode de paiement</h2>
          <div className="mt-5 space-y-5">
            {organizerGroups.length > 1 ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Votre panier contient des séjours provenant d&apos;organisateurs différents. ResaColo créera automatiquement une commande distincte par organisateur lors de la validation.
              </div>
            ) : null}
            <div className="space-y-4">
              {organizerGroups.map((group) => {
                const wantsVacafAid = Boolean(wantsVacafAidByOrganizer[group.organizerId]);
                const groupCgvUrl = organizerCgvUrls[group.organizerId] ?? '/cgv-organisateur';
                const groupFamilyPayableCents =
                  group.pricing.financeFamilyPayableTotalCents ?? group.pricing.totalCents;
                const currencyFormatter = new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR'
                });

                return (
                  <div
                    key={group.organizerId}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] sm:px-5"
                  >
                    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {organizerGroups.length > 1 ? 'Commande organisateur' : 'Organisateur'}
                        </p>
                        <h3 className="mt-1 font-display text-lg font-bold text-slate-900">{group.organizerName}</h3>
                      </div>
                      <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm sm:min-w-[260px]">
                        <div className="flex items-center justify-between gap-4">
                          <span>Total estimé</span>
                          <span className="font-semibold text-slate-900">
                            {currencyFormatter.format(group.pricing.totalCents / 100)}
                          </span>
                        </div>
                        {typeof group.pricing.financeFamilyPayableTotalCents === 'number' ? (
                          <div className="mt-2 flex items-center justify-between gap-4 text-slate-600">
                            <span>À régler par la famille</span>
                            <span className="font-semibold text-slate-900">
                              {currencyFormatter.format(groupFamilyPayableCents / 100)}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center justify-between gap-4 text-slate-600">
                            <span>Suite du parcours</span>
                            <span className="font-semibold text-slate-900">Demande de devis</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      {group.pricing.financeRequiresQuote ? (
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Aucun paiement n&apos;est demandé à ce stade pour {group.organizerName}. Vous êtes en train d&apos;envoyer une demande de devis à votre partenaire.
                            Vous pouvez toutefois préciser ici si vous comptez mobiliser VACAF, ANCV papier ou ANCV Connect.
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {group.displayedPaymentModes.map((mode) => {
                              const isActive = group.selection.paymentMode === mode.value;
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
                                    name={`recap-payment-mode-${group.organizerId}`}
                                    value={mode.value}
                                    checked={isActive}
                                    onChange={() =>
                                      patchOrganizerPaymentSelection(
                                        group.organizerId,
                                        mode.value === 'CV_CONNECT'
                                          ? { paymentMode: mode.value }
                                          : {
                                              paymentMode: mode.value,
                                              ancvConnectMatricule: '',
                                              ancvConnectAmount: ''
                                            }
                                      )
                                    }
                                    className="sr-only"
                                  />
                                  <span className="min-w-0 flex-1 leading-snug">{mode.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : group.isPartnerTotalCoverage ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                          Aucun paiement n&apos;est demandé lors de cette réservation auprès de {group.organizerName} : votre partenaire prendra en charge la totalité auprès de ResaColo.
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {group.displayedPaymentModes.map((mode) => {
                            const isActive = group.selection.paymentMode === mode.value;
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
                                  name={`recap-payment-mode-${group.organizerId}`}
                                  value={mode.value}
                                  checked={isActive}
                                  onChange={() =>
                                    patchOrganizerPaymentSelection(
                                      group.organizerId,
                                      mode.value === 'CV_CONNECT'
                                        ? { paymentMode: mode.value }
                                        : {
                                            paymentMode: mode.value,
                                            ancvConnectMatricule: '',
                                            ancvConnectAmount: ''
                                          }
                                    )
                                  }
                                  className="sr-only"
                                />
                                <span className="min-w-0 flex-1 leading-snug">{mode.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {group.hasAidSelectionOptions ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Aides ou règlements complémentaires</p>
                          <p className="mt-1.5 leading-relaxed text-slate-600">
                            Ces options seront transmises uniquement à {group.organizerName}. Le solde éventuel sera à régler par carte bancaire le cas échéant.
                          </p>
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {group.settings?.acceptsAncvPaper ? (
                              <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                <input
                                  type="checkbox"
                                  checked={group.selection.paymentMode === 'CV_PAPER'}
                                  onChange={(event) =>
                                    patchOrganizerPaymentSelection(
                                      group.organizerId,
                                      event.target.checked
                                        ? {
                                            paymentMode: 'CV_PAPER',
                                            ancvConnectMatricule: '',
                                            ancvConnectAmount: ''
                                          }
                                        : {
                                            paymentMode: group.pricing.financeRequiresQuote ? 'DEFERRED' : 'FULL'
                                          }
                                    )
                                  }
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                />
                                <span className="font-medium text-slate-700">ANCV papier</span>
                              </label>
                            ) : null}
                            {group.settings?.acceptsAncvConnect ? (
                              <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                <input
                                  type="checkbox"
                                  checked={group.selection.paymentMode === 'CV_CONNECT'}
                                  onChange={(event) =>
                                    patchOrganizerPaymentSelection(
                                      group.organizerId,
                                      event.target.checked
                                        ? { paymentMode: 'CV_CONNECT' }
                                        : {
                                            paymentMode: group.pricing.financeRequiresQuote ? 'DEFERRED' : 'FULL',
                                            ancvConnectMatricule: '',
                                            ancvConnectAmount: ''
                                          }
                                    )
                                  }
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                />
                                <span className="font-medium text-slate-700">ANCV Connect</span>
                              </label>
                            ) : null}
                            {group.settings?.isVacafApproved ? (
                              <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                <input
                                  type="checkbox"
                                  checked={wantsVacafAid}
                                  onChange={(event) => {
                                    setWantsVacafAidForOrganizer(group.organizerId, event.target.checked);
                                    if (!event.target.checked) {
                                      patchOrganizerPaymentSelection(group.organizerId, { vacafNumber: '' });
                                    }
                                  }}
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                />
                                <span className="font-medium text-slate-700">VACAF / AVE</span>
                              </label>
                            ) : null}
                          </div>

                          {group.settings?.isVacafApproved && wantsVacafAid ? (
                            <div className="mt-4">
                              <label
                                htmlFor={`recap-vacaf-${group.organizerId}`}
                                className="block text-sm font-medium text-slate-700"
                              >
                                Matricule allocataire
                              </label>
                              <p
                                id={`recap-vacaf-hint-${group.organizerId}`}
                                className="mt-1.5 text-sm leading-relaxed text-slate-500"
                              >
                                Format attendu : 7 chiffres, éventuellement une lettre à la fin (ex. 1234567 ou 1234567A).
                              </p>
                              <input
                                id={`recap-vacaf-${group.organizerId}`}
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={8}
                                value={group.selection.vacafNumber}
                                onChange={(event) =>
                                  patchOrganizerPaymentSelection(group.organizerId, {
                                    vacafNumber: normalizeVacafNumberInput(event.target.value)
                                  })
                                }
                                className={INPUT_CLASS}
                                placeholder="1234567A"
                                aria-describedby={`recap-vacaf-hint-${group.organizerId}`}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {group.selection.paymentMode === 'CV_CONNECT' && !group.isPartnerTotalCoverage ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`recap-ancv-matricule-${group.organizerId}`}
                              className="block text-sm font-medium text-slate-700"
                            >
                              Matricule ANCV Connect *
                            </label>
                            <p
                              id={`recap-ancv-matricule-hint-${group.organizerId}`}
                              className="mt-1.5 text-sm leading-relaxed text-slate-500"
                            >
                              {ANCV_CONNECT_MATRICULE_HINT}
                            </p>
                            <input
                              id={`recap-ancv-matricule-${group.organizerId}`}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={11}
                              value={group.selection.ancvConnectMatricule}
                              onChange={(event) =>
                                patchOrganizerPaymentSelection(group.organizerId, {
                                  ancvConnectMatricule: normalizeAncvConnectMatriculeInput(event.target.value)
                                })
                              }
                              className={INPUT_CLASS}
                              placeholder="10003377487"
                              aria-describedby={`recap-ancv-matricule-hint-${group.organizerId}`}
                              required
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`recap-ancv-amount-${group.organizerId}`}
                              className="block text-sm font-medium text-slate-700"
                            >
                              Montant souhaité en règlement (€) *
                            </label>
                            <p className="mt-1.5 text-sm leading-relaxed invisible" aria-hidden="true">
                              {ANCV_CONNECT_MATRICULE_HINT}
                            </p>
                            <input
                              id={`recap-ancv-amount-${group.organizerId}`}
                              type="text"
                              inputMode="decimal"
                              value={group.selection.ancvConnectAmount}
                              onChange={(event) =>
                                patchOrganizerPaymentSelection(group.organizerId, {
                                  ancvConnectAmount: event.target.value
                                })
                              }
                              className={INPUT_CLASS}
                              placeholder="Ex. : 150"
                              required
                            />
                          </div>
                        </div>
                      ) : null}

                      {group.requestKind ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          {group.requestKind === 'VACAF'
                            ? `Cette commande ne sera pas payée en ligne auprès de ${group.organizerName} : l'organisme devra vérifier vos droits VACAF/AVE et saisir le montant CAF applicable.`
                            : `Cette commande ne sera pas payée en ligne auprès de ${group.organizerName} : l'organisme devra vous recontacter et saisir le montant reçu en ANCV Connect.`}
                        </div>
                      ) : null}

                      {financeMode === 'PERCENT' && typeof pricing?.financePercentValue === 'number' ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                          Votre partenaire prend en charge {pricing.financePercentValue.toLocaleString('fr-FR', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2
                          })} % du tarif partenaire affiché pour cette commande.
                        </div>
                      ) : null}
                      {financeMode === 'FIXED' && group.pricing.financePartnerContributionTotalCents > 0 ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                          Votre partenaire prend en charge un montant fixe de{' '}
                          {currencyFormatter.format(group.pricing.financePartnerContributionTotalCents / 100)} sur cette commande.
                        </div>
                      ) : null}

                      <p className="text-xs leading-relaxed text-slate-500">
                        Conditions de vente de {group.organizerName} :{' '}
                        <Link
                          href={groupCgvUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-brand-500 underline"
                        >
                          consulter les CGV
                        </Link>
                        .
                      </p>
                    </div>
                  </div>
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
                  J&apos;ai lu et j&apos;accepte les conditions générales des organisateurs concernés :{' '}
                  {organizerGroups.map((group, index) => (
                    <span key={group.organizerId}>
                      {index > 0 ? ', ' : null}
                      <Link
                        href={organizerCgvUrls[group.organizerId] ?? '/cgv-organisateur'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-500"
                      >
                        {group.organizerName}
                      </Link>
                    </span>
                  ))}{' '}
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

        {pricing ? (
          <section className={SECTION_CARD_CLASS}>
            <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Totaux estimés</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span>Total catalogue</span>
                <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(pricing.totalCents / 100)}</span>
              </div>
              {pricing.financeRequiresQuote ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  Le prix affiché correspond au coût actuel du séjour, mais le montant final à régler sera confirmé par votre partenaire après étude.
                </div>
              ) : pricing.financePartnerContributionTotalCents != null && pricing.financePartnerContributionTotalCents > 0 ? (
                <>
                  <div className="flex items-center justify-between font-semibold text-emerald-700">
                    <span>Prise en charge partenaire</span>
                    <span>- {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((pricing.financePartnerContributionTotalCents ?? 0) / 100)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-bold text-slate-900">
                    <span>
                      {(pricing.financeFamilyPayableTotalCents ?? pricing.totalCents) === 0
                        ? formatNoPaymentAsBeneficiaryMessage(pricing.partnerCollectivityName)
                        : 'Reste à régler'}
                    </span>
                    <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(((pricing.financeFamilyPayableTotalCents ?? pricing.totalCents)) / 100)}</span>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

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
            {isSubmittingPayment
              ? 'Validation...'
              : paymentRequiresOnlineStep
                ? 'Continuer vers paiement'
                : financeRequiresQuote
                  ? 'Envoyer ma demande de devis'
                  : isPartnerTotalCoverage
                    ? 'Valider la réservation'
                    : 'Valider la commande'}
          </button>
        </div>
      </div>
    </CheckoutFrame>
  );
}
