import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import type { FamilyProfile } from '@/types/family-profile';
import MonCompteClient from './MonCompteClient';

export const metadata = {
  title: 'Mon compte | Resacolo'
};
export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** Cold start Vercel après login — éviter FUNCTION_INVOCATION_TIMEOUT. */
export const maxDuration = 30;

function buildFallbackProfile(session: {
  userId: string;
  name?: string | null;
  email?: string | null;
}): FamilyProfile {
  return {
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
    paymentMode: 'FULL',
    parent1Status: '',
    parent1StatusOther: '',
    parent2Name: '',
    parent2Status: '',
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
}

export default async function MonComptePage() {
  const session = await getCurrentUser();

  if (!session) {
    redirect('/login?mode=family&redirectTo=/mon-compte');
  }

  if (session.role !== 'CLIENT') {
    redirect('/login?mode=family&forceLogin=1');
  }

  // Profil / réservations / CSE : chargés côté client via /api/account/profile
  // pour que le premier rendu après login soit immédiat (pas de cold-start DB).
  return (
    <MonCompteClient
      initialProfile={buildFallbackProfile(session)}
      reservations={[]}
      initialCseAffiliation={null}
      favoriteStays={[]}
      profileLoadError={null}
    />
  );
}
