import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getFamilyProfileSnapshot } from '@/lib/account-profile/server';
import { getFavoriteStayIdsForUserId } from '@/lib/favorites.server';
import { getStays } from '@/lib/stays';
import type { FamilyProfileSnapshot } from '@/types/family-profile';
import type { Stay } from '@/types/stay';
import MonCompteClient from './MonCompteClient';

export const metadata = {
  title: 'Mon compte | Resacolo'
};

export default async function MonComptePage() {
  const session = await getCurrentUser();

  if (!session) {
    redirect('/login/familles');
  }

  if (session.role === 'MNEMOS') {
    redirect('/mnemos');
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
  let favoriteStays: Stay[] = [];
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
  try {
    const favoriteIds = await getFavoriteStayIdsForUserId(session.userId);
    if (favoriteIds.length > 0) {
      const favoriteIdSet = new Set(favoriteIds);
      const favoriteOrder = new Map(favoriteIds.map((id, index) => [id, index]));
      favoriteStays = (await getStays())
        .filter((stay) => favoriteIdSet.has(stay.id))
        .sort((left, right) => (favoriteOrder.get(left.id) ?? 0) - (favoriteOrder.get(right.id) ?? 0));
    }
  } catch {
    favoriteStays = [];
  }

  return (
    <MonCompteClient
      initialProfile={snapshot.profile}
      upcomingReservations={snapshot.upcomingReservations}
      favoriteStays={favoriteStays}
    />
  );
}
