import type { CartItem } from '@/types/cart';

export type CheckoutPaymentMode = 'FULL' | 'DEPOSIT_200' | 'CV_CONNECT' | 'CV_PAPER' | 'DEFERRED';

export type CheckoutOrganizerSelection = {
  paymentMode: CheckoutPaymentMode;
  vacafNumber: string;
  ancvConnectMatricule: string;
  ancvConnectAmount: string;
};

export type CheckoutContact = {
  billingFirstName: string;
  billingLastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  hasSeparateBillingAddress: boolean;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingPostalCode: string;
  billingCity: string;
  billingCountry: string;
  cseOrganization: string;
  vacafNumber: string;
  ancvConnectMatricule: string;
  ancvConnectAmount: string;
  paymentMode: CheckoutPaymentMode;
  organizerSelections?: Record<string, CheckoutOrganizerSelection>;
  acceptsTerms: boolean;
  acceptsPrivacy: boolean;
};

export type CheckoutParticipant = {
  cartItemId: string;
  childId: string | null;
  childFirstName: string;
  childLastName: string;
  childBirthdate: string;
  childGender: '' | 'MASCULIN' | 'FEMININ';
  additionalInfo: string;
};

export type CheckoutState = {
  checkoutId: string;
  contact: CheckoutContact;
  participants: Record<string, CheckoutParticipant>;
};

export type CheckoutPricingItem = {
  cartItemId: string;
  stayTitle: string;
  sessionId: string;
  organizerId: string;
  sessionStartDate: string | null;
  sessionEndDate: string | null;
  basePriceCents: number;
  transportPriceCents: number;
  transportLabel: string | null;
  transportDisplayLine?: string | null;
  insurancePriceCents: number;
  insuranceLabel: string | null;
  extraOptionPriceCents: number;
  optionsPriceCents: number;
  totalPriceCents: number;
  transportOptionId: string | null;
  insuranceOptionId: string | null;
  extraOptionId: string | null;
  extraOptionLabel: string | null;
  financeMode?: 'TOTAL' | 'NONE' | 'PERCENT' | 'FIXED' | 'MANUAL' | null;
  financePartnerContributionCents?: number | null;
  financeFamilyPayableCents?: number | null;
  financePercentValue?: number | null;
  financeFixedCents?: number | null;
  financeRequiresQuote?: boolean;
  cseAidCents?: number;
  familyCentsAfterAid?: number;
  cseEligible?: boolean;
  cseLabel?: string | null;
};

export type CheckoutPricing = {
  items: CheckoutPricingItem[];
  totalCents: number;
  partnerCollectivityName?: string | null;
  financeMode?: 'TOTAL' | 'NONE' | 'PERCENT' | 'FIXED' | 'MANUAL' | null;
  financePartnerContributionTotalCents?: number | null;
  financeFamilyPayableTotalCents?: number | null;
  financePercentValue?: number | null;
  financeFixedCents?: number | null;
  financeRequiresQuote?: boolean;
  familyTotalCentsAfterAid?: number;
  cseTotalAidCents?: number;
  currency: 'EUR';
};

export const EMPTY_CONTACT: CheckoutContact = {
  billingFirstName: '',
  billingLastName: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: 'France',
  hasSeparateBillingAddress: false,
  billingAddressLine1: '',
  billingAddressLine2: '',
  billingPostalCode: '',
  billingCity: '',
  billingCountry: 'France',
  cseOrganization: '',
  vacafNumber: '',
  ancvConnectMatricule: '',
  ancvConnectAmount: '',
  paymentMode: 'FULL',
  organizerSelections: {},
  acceptsTerms: false,
  acceptsPrivacy: true
};

export function createDefaultOrganizerSelection(
  overrides: Partial<CheckoutOrganizerSelection> = {}
): CheckoutOrganizerSelection {
  return {
    paymentMode: 'FULL',
    vacafNumber: '',
    ancvConnectMatricule: '',
    ancvConnectAmount: '',
    ...overrides
  };
}

export function normalizeOrganizerSelections(
  selections: CheckoutContact['organizerSelections']
): Record<string, CheckoutOrganizerSelection> {
  if (!selections || typeof selections !== 'object') return {};
  return Object.fromEntries(
    Object.entries(selections).map(([organizerId, selection]) => [
      organizerId,
      createDefaultOrganizerSelection(selection ?? {})
    ])
  );
}

export function normalizeCheckoutContact(contact: Partial<CheckoutContact> | null | undefined): CheckoutContact {
  return {
    ...EMPTY_CONTACT,
    ...(contact ?? {}),
    organizerSelections: normalizeOrganizerSelections(contact?.organizerSelections)
  };
}

export function getOrganizerSelection(
  contact: Pick<
    CheckoutContact,
    'paymentMode' | 'vacafNumber' | 'ancvConnectMatricule' | 'ancvConnectAmount' | 'organizerSelections'
  >,
  organizerId: string
): CheckoutOrganizerSelection {
  const storedSelection = normalizeOrganizerSelections(contact.organizerSelections)[organizerId];
  if (storedSelection) {
    return storedSelection;
  }

  return createDefaultOrganizerSelection({
    paymentMode: contact.paymentMode,
    vacafNumber: contact.vacafNumber,
    ancvConnectMatricule: contact.ancvConnectMatricule,
    ancvConnectAmount: contact.ancvConnectAmount
  });
}

export function patchOrganizerSelection(
  contact: CheckoutContact,
  organizerId: string,
  patch: Partial<CheckoutOrganizerSelection>
): CheckoutContact {
  const nextSelection = {
    ...getOrganizerSelection(contact, organizerId),
    ...patch
  };

  return {
    ...contact,
    organizerSelections: {
      ...normalizeOrganizerSelections(contact.organizerSelections),
      [organizerId]: nextSelection
    }
  };
}

export function hasAnyOnlineOrganizerSelection(
  contact: Pick<CheckoutContact, 'paymentMode' | 'vacafNumber' | 'ancvConnectMatricule' | 'ancvConnectAmount' | 'organizerSelections'>
) {
  const selections = Object.values(normalizeOrganizerSelections(contact.organizerSelections));
  if (selections.length === 0) {
    return contact.paymentMode === 'FULL' || contact.paymentMode === 'DEPOSIT_200';
  }

  return selections.some((selection) => selection.paymentMode === 'FULL' || selection.paymentMode === 'DEPOSIT_200');
}

export function getDefaultParticipant(cartItemId: string): CheckoutParticipant {
  return {
    cartItemId,
    childId: null,
    childFirstName: '',
    childLastName: '',
    childBirthdate: '',
    childGender: '',
    additionalInfo: ''
  };
}

export function normalizeCheckoutParticipant(
  participant: Partial<CheckoutParticipant> | null | undefined,
  cartItemId: string
): CheckoutParticipant {
  return {
    cartItemId,
    childId: typeof participant?.childId === 'string' && participant.childId.trim() ? participant.childId.trim() : null,
    childFirstName: participant?.childFirstName ?? '',
    childLastName: participant?.childLastName ?? '',
    childBirthdate: participant?.childBirthdate ?? '',
    childGender:
      participant?.childGender === 'MASCULIN' || participant?.childGender === 'FEMININ'
        ? participant.childGender
        : '',
    additionalInfo: participant?.additionalInfo ?? ''
  };
}

export function createCheckoutId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `checkout_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function formatEuroFromCents(cents: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(cents / 100);
}

export function ensureParticipantsForCart(
  participants: Record<string, CheckoutParticipant>,
  items: CartItem[]
): Record<string, CheckoutParticipant> {
  const next: Record<string, CheckoutParticipant> = {};

  for (const item of items) {
    next[item.id] = normalizeCheckoutParticipant(participants[item.id], item.id);
  }

  return next;
}
