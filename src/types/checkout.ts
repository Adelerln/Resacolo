import type { CartItem } from '@/types/cart';

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
  paymentMode: 'FULL' | 'DEPOSIT_200' | 'CV_CONNECT' | 'CV_PAPER' | 'DEFERRED';
  acceptsTerms: boolean;
  acceptsPrivacy: boolean;
};

export type CheckoutParticipant = {
  cartItemId: string;
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
  acceptsTerms: false,
  acceptsPrivacy: true
};

export function getDefaultParticipant(cartItemId: string): CheckoutParticipant {
  return {
    cartItemId,
    childFirstName: '',
    childLastName: '',
    childBirthdate: '',
    childGender: '',
    additionalInfo: ''
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
    next[item.id] = participants[item.id] ?? getDefaultParticipant(item.id);
  }

  return next;
}
