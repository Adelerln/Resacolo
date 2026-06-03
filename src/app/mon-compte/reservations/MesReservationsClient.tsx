'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import FamilyReservationAccordion from '@/components/account/FamilyReservationAccordion';
import type { FamilyReservation } from '@/types/family-profile';

export default function MesReservationsClient({ reservations }: { reservations: FamilyReservation[] }) {
  const searchParams = useSearchParams();
  const openOrderId = searchParams.get('open');

  return (
    <div className="min-h-screen bg-slate-100">
      <section className="section-container py-10 sm:py-14">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/mon-compte"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au compte
            </Link>
            <h1 className="mt-3 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              Mes réservations en ligne
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cliquez sur une réservation pour afficher le détail, le solde restant et le paiement en ligne.
            </p>
          </div>
          <CalendarDays className="h-10 w-10 shrink-0 text-accent-500" aria-hidden />
        </header>

        {reservations.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-500">
              Vous n&apos;avez pas encore de réservation en ligne.
            </p>
            <Link href="/sejours" className="btn btn-primary btn-sm mt-4">
              Parcourir les séjours
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {reservations.map((reservation) => (
              <li key={reservation.orderId}>
                <FamilyReservationAccordion
                  reservation={reservation}
                  defaultOpen={openOrderId === reservation.orderId}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
