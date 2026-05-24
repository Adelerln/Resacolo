import type { CheckoutContact, CheckoutParticipant } from '@/types/checkout';

export type ParentStatus = 'pere' | 'mere' | 'grand-parent' | 'autre';

export type FamilyProfileChild = {
  firstName: string;
  lastName: string;
  birthdate: string;
  gender: '' | 'MASCULIN' | 'FEMININ';
  additionalInfo: string;
};

export type FamilyProfile = {
  userId: string;
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
  paymentMode: CheckoutContact['paymentMode'];
  parent1Status: ParentStatus;
  parent1StatusOther: string;
  parent2Name: string;
  parent2Status: ParentStatus;
  parent2StatusOther: string;
  parent2Phone: string;
  parent2Email: string;
  parent2HasDifferentAddress: boolean;
  parent2AddressLine1: string;
  parent2AddressLine2: string;
  parent2PostalCode: string;
  parent2City: string;
  children: FamilyProfileChild[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type FamilyReservation = {
  orderId: string;
  orderStatus: string;
  title: string;
  dates: string;
  child: string;
  children: string[];
  status: string;
  sessionStartDate: string | null;
  sessionEndDate: string | null;
  isPast: boolean;
  totalCents: number;
  currency: string;
  paymentMode: CheckoutContact['paymentMode'];
  paymentModeLabel: string;
  remainingBalanceCents: number;
  transportLine: string | null;
  transportOutboundLine: string | null;
  transportReturnLine: string | null;
  insuranceLine: string | null;
  extraLines: string[];
  organizerContactEmail: string | null;
  organizerName: string | null;
  hasSuccessfulPayment: boolean;
};

export type FamilyCseAffiliation = {
  collectivityId: string;
  name: string;
  code: string;
  offerMode: string;
  financeMode: string;
  brandPrimaryColor: string | null;
  logoUrl: string | null;
  logoScale: number | null;
  logoOffsetX: number | null;
  logoOffsetY: number | null;
  heroEnabled: boolean;
  heroTitle: string | null;
  heroBody: string | null;
  heroCtaLabel: string | null;
  heroCtaUrl: string | null;
  isWhiteLabel: boolean;
};

export type FamilyProfileSnapshot = {
  profile: FamilyProfile;
  reservations: FamilyReservation[];
  cseAffiliation: FamilyCseAffiliation | null;
};

export type FamilyParent2Patch = {
  parent2Name?: string;
  parent2Status?: ParentStatus;
  parent2StatusOther?: string;
  parent2Phone?: string;
  parent2Email?: string;
  parent2HasDifferentAddress?: boolean;
  parent2AddressLine1?: string;
  parent2AddressLine2?: string;
  parent2PostalCode?: string;
  parent2City?: string;
};

export type FamilyCheckoutSyncInput = {
  contact: CheckoutContact;
  participants: CheckoutParticipant[];
};
