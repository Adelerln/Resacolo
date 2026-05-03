'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export type OrganizerReservationDetails = {
  id: string;
  clientName: string;
  participantName: string;
  paymentModeLabel: string;
  cafLabel: string;
  ancvConnectLabel: string;
  email: string;
  primaryPhone: string;
  secondaryPhone: string;
  postalAddress: string;
  billingAddress: string;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  const display = value?.trim();
  const isEmpty = !display;
  return (
    <div className="flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-baseline sm:gap-x-8 sm:py-3">
      <dt className="shrink-0 text-sm font-medium text-slate-600 sm:w-44">{label}</dt>
      <dd
        className={`min-w-0 flex-1 text-sm leading-relaxed sm:text-[0.9375rem] ${
          isEmpty ? 'text-slate-400' : 'font-medium text-slate-900'
        }`}
      >
        {isEmpty ? <span className="font-normal italic">Non renseigné</span> : display}
      </dd>
    </div>
  );
}

export default function OrganizerReservationDetailsModal({
  reservation
}: {
  reservation: OrganizerReservationDetails;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
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
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
      >
        Voir détails
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`reservation-details-title-${reservation.id}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="min-w-0 pr-2">
                <h2
                  id={`reservation-details-title-${reservation.id}`}
                  className="font-display text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
                >
                  Détails de la réservation
                </h2>
                <p className="mt-1.5 truncate text-sm text-slate-500 sm:whitespace-normal sm:leading-snug">
                  {reservation.clientName}
                  <span className="text-slate-300"> · </span>
                  {reservation.participantName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 pb-6 pt-2">
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 px-4 sm:px-5">
                <DetailRow label="Mode de paiement" value={reservation.paymentModeLabel} />
                <DetailRow label="CAF" value={reservation.cafLabel} />
                <DetailRow label="ANCV Connect" value={reservation.ancvConnectLabel} />
                <DetailRow label="Adresse postale" value={reservation.postalAddress} />
                {reservation.billingAddress !== reservation.postalAddress ? (
                  <DetailRow label="Adresse de facturation" value={reservation.billingAddress} />
                ) : null}
                <DetailRow label="Mail" value={reservation.email} />
                <DetailRow label="Téléphone parent 1" value={reservation.primaryPhone} />
                <DetailRow label="Téléphone parent 2" value={reservation.secondaryPhone} />
              </dl>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
