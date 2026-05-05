'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { FamilyReservation } from '@/types/family-profile';

function formatEuroFromCents(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(cents / 100);
}

function DetailRow({
  label,
  value,
  accent = false
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const display = value.trim();
  const isEmpty = !display;
  return (
    <div className="grid gap-1 py-3.5 sm:grid-cols-[minmax(180px,220px)_1fr] sm:items-start sm:gap-4 sm:py-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd
        className={`min-w-0 flex-1 text-sm leading-relaxed sm:text-[0.9375rem] ${
          isEmpty
            ? 'text-slate-400'
            : accent
              ? 'font-semibold text-accent-600'
              : 'font-medium text-slate-900'
        }`}
      >
        {isEmpty ? <span className="font-normal italic">Non renseigné</span> : display}
      </dd>
    </div>
  );
}

export default function FamilyReservationDetailsModal({ reservation }: { reservation: FamilyReservation }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm"
      >
        Voir les détails
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`family-reservation-title-${reservation.orderId}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] bg-white shadow-2xl ring-1 ring-slate-900/5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="overflow-y-auto">
              <div className="relative bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 px-5 py-5 text-white sm:px-7 sm:py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">Réservation</p>
                    <h2
                      id={`family-reservation-title-${reservation.orderId}`}
                      className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-[1.95rem]"
                    >
                      {reservation.title}
                    </h2>
                    <p className="mt-2 text-sm text-brand-100">{reservation.dates}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="shrink-0 rounded-full bg-white/10 p-2.5 text-white/80 transition hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    aria-label="Fermer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-slate-900 ring-1 ring-white/70">
                    {reservation.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50/65 px-5 py-4 sm:px-7 sm:py-5">
                <div className={`grid gap-3 ${reservation.remainingBalanceCents > 0 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Montant total</p>
                    <p className="mt-1.5 text-xl font-bold text-slate-900 sm:text-2xl">
                      {formatEuroFromCents(reservation.totalCents, reservation.currency)}
                    </p>
                  </div>
                  {reservation.remainingBalanceCents > 0 ? (
                    <div className="rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-700">Solde restant</p>
                      <p className="mt-1.5 text-xl font-bold text-accent-700 sm:text-2xl">
                        {formatEuroFromCents(reservation.remainingBalanceCents, reservation.currency)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="px-5 pb-6 pt-3 sm:px-7 sm:pb-7">
                <dl className="divide-y divide-slate-100">
                  <DetailRow label="Participant(s)" value={reservation.children.join(', ') || reservation.child} />
                  <DetailRow label="Mode de paiement" value={reservation.paymentModeLabel} />
                  {reservation.transportOutboundLine || reservation.transportReturnLine ? (
                    <>
                      {reservation.transportOutboundLine ? (
                        <DetailRow label="Transport aller" value={reservation.transportOutboundLine} />
                      ) : null}
                      {reservation.transportReturnLine ? (
                        <DetailRow label="Transport retour" value={reservation.transportReturnLine} />
                      ) : null}
                    </>
                  ) : (
                    <DetailRow label="Transport" value={reservation.transportLine ?? 'Non renseigné'} />
                  )}
                  <DetailRow label="Assurance" value={reservation.insuranceLine ?? 'Aucune'} />
                  <DetailRow
                    label="Options complémentaires"
                    value={reservation.extraLines.length > 0 ? reservation.extraLines.join(' | ') : 'Aucune'}
                  />
                </dl>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
