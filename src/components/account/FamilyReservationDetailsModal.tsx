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
    <div className="flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-baseline sm:gap-x-8 sm:py-3">
      <dt className="shrink-0 text-sm font-medium text-slate-500 sm:w-44">{label}</dt>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`family-reservation-title-${reservation.orderId}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-slate-900/5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-brand-50 via-white to-accent-50 px-6 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Réservation</p>
                  <h2
                    id={`family-reservation-title-${reservation.orderId}`}
                    className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900"
                  >
                    {reservation.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500">{reservation.dates}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                  {reservation.status}
                </span>
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 sm:px-7">
              <dl className="divide-y divide-slate-100">
                <DetailRow label="Participant(s)" value={reservation.children.join(', ') || reservation.child} />
                <DetailRow label="Mode de paiement" value={reservation.paymentModeLabel} />
                <DetailRow
                  label="Montant total"
                  value={formatEuroFromCents(reservation.totalCents, reservation.currency)}
                />
                {reservation.remainingBalanceCents > 0 ? (
                  <DetailRow
                    label="Solde restant"
                    value={formatEuroFromCents(reservation.remainingBalanceCents, reservation.currency)}
                    accent
                  />
                ) : null}
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
      ) : null}
    </>
  );
}
