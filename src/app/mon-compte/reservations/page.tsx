import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getFamilyProfileSnapshot } from '@/lib/account-profile/server';
import type { FamilyReservation } from '@/types/family-profile';
import MesReservationsClient from './MesReservationsClient';

export const metadata = {
  title: 'Mes réservations | Resacolo'
};
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MesReservationsPage() {
  const session = await getCurrentUser();

  if (!session) {
    redirect('/login/familles');
  }

  if (session.role !== 'CLIENT') {
    redirect('/login?mode=family&forceLogin=1');
  }

  let reservations: FamilyReservation[] = [];
  try {
    const snapshot = await getFamilyProfileSnapshot({
      userId: session.userId,
      sessionName: session.name,
      sessionEmail: session.email
    });
    reservations = snapshot.reservations;
  } catch {
    reservations = [];
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <MesReservationsClient reservations={reservations} />
    </Suspense>
  );
}
