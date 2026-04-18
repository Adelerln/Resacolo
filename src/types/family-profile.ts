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

export type FamilyUpcomingReservation = {
  orderId: string;
  title: string;
  dates: string;
  child: string;
  status: string;
};

export type FamilyProfileSnapshot = {
  profile: FamilyProfile;
  upcomingReservations: FamilyUpcomingReservation[];
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
