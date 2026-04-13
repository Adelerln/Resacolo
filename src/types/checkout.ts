import type { CartItem } from '@/types/cart';

export type CheckoutContact = {
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  acceptsTerms: boolean;
  acceptsPrivacy: boolean;
};

export type CheckoutParticipant = {
  cartItemId: string;
  childFirstName: string;
  childLastName: string;
  childBirthdate: string;
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
  basePriceCents: number;
  transportPriceCents: number;
  insurancePriceCents: number;
  extraOptionPriceCents: number;
  optionsPriceCents: number;
  totalPriceCents: number;
  transportOptionId: string | null;
  insuranceOptionId: string | null;
  extraOptionId: string | null;
  extraOptionLabel: string | null;
};

export type CheckoutPricing = {
  items: CheckoutPricingItem[];
  totalCents: number;
  currency: 'EUR';
};

export const EMPTY_CONTACT: CheckoutContact = {
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: 'France',
  acceptsTerms: false,
  acceptsPrivacy: false
};

export function getDefaultParticipant(cartItemId: string): CheckoutParticipant {
  return {
    cartItemId,
    childFirstName: '',
    childLastName: '',
    childBirthdate: ''
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
