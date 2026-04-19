import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getFamilyProfileSnapshot } from '@/lib/account-profile/server';
import type { FamilyProfileSnapshot } from '@/types/family-profile';
import MonCompteClient from './MonCompteClient';

export const metadata = {
  title: 'Mon compte | Resacolo'
};

export default async function MonComptePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login/familles');
  }

  if (session.role === 'ADMIN') {
    redirect('/admin');
  }
  if (session.role === 'ORGANISATEUR') {
    redirect('/organisme');
  }
  if (session.role === 'PARTENAIRE') {
    redirect('/partenaire');
  }

  const fallbackProfile = {
    userId: session.userId,
    billingFirstName: session.name?.split(' ')[0] ?? '',
    billingLastName: session.name?.split(' ').slice(1).join(' ') ?? '',
    email: session.email ?? '',
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
    paymentMode: 'FULL' as const,
    parent2Name: '',
    parent2Status: 'pere' as const,
    parent2StatusOther: '',
    parent2Phone: '',
    parent2Email: '',
    parent2HasDifferentAddress: false,
    parent2AddressLine1: '',
    parent2AddressLine2: '',
    parent2PostalCode: '',
    parent2City: '',
    children: [],
    createdAt: null,
    updatedAt: null
  };

  let snapshot: FamilyProfileSnapshot = {
    profile: fallbackProfile,
    upcomingReservations: []
  };
  try {
    snapshot = await getFamilyProfileSnapshot({
      userId: session.userId,
      sessionName: session.name,
      sessionEmail: session.email
    });
  } catch {
    snapshot = {
      profile: fallbackProfile,
      upcomingReservations: []
    };
  }

  return (
    <MonCompteClient
      initialProfile={snapshot.profile}
      upcomingReservations={snapshot.upcomingReservations}
    />
  );
}
