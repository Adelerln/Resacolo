import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getFamilyProfileSnapshot } from '@/lib/account-profile/server';
import type { FamilyCseAffiliation, FamilyProfile, FamilyReservation } from '@/types/family-profile';
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

  if (session.role !== 'CLIENT' && !session.isClient) {
    redirect('/login?mode=family&forceLogin=1');
  }

  // Profil / réservations : chargement serveur prioritaire.
  // En cas de timeout / erreur DB, fallback client pour ne pas bloquer le login.
  let initialProfile = buildFallbackProfile(session);
  let reservations: FamilyReservation[] = [];
  let initialCseAffiliation: FamilyCseAffiliation | null = null;
  let profileLoadError: string | null = null;
  let deferAccountDataToClient = false;

  try {
    const snapshot = await getFamilyProfileSnapshot({
      userId: session.userId,
      sessionName: session.name,
      sessionEmail: session.email
    });
    initialProfile = snapshot.profile;
    reservations = snapshot.reservations;
    initialCseAffiliation = snapshot.cseAffiliation;
  } catch (error) {
    console.error('[mon-compte] chargement snapshot échoué, fallback client', error);
    profileLoadError = error instanceof Error ? error.message : 'Chargement du compte interrompu.';
    deferAccountDataToClient = true;
  }

  return (
    <MonCompteClient
      initialProfile={initialProfile}
      reservations={reservations}
      initialCseAffiliation={initialCseAffiliation}
      favoriteStays={[]}
      profileLoadError={profileLoadError}
      deferAccountDataToClient={deferAccountDataToClient}
    />
  );
}
