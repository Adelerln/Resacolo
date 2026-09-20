'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export type OrganizerReservationCoverageForm = {
  organizerId: string;
  orderId: string;
  requestKind: 'VACAF' | 'ANCV_CONNECT';
  referenceLabel: string;
  amountPlaceholder: string;
  submitLabel: string;
  currentAmountLabel?: string | null;
};

export type OrganizerReservationDetails = {
  id: string;
  reservationCode: string;
  clientName: string;
  participantName: string;
  paymentModeLabel: string;
  /** Matricule CAF / VACAF — null si non renseigné à la commande. */
  cafNumber: string | null;
  /** Matricule ANCV Connect — null si non demandé. */
  ancvConnectMatricule: string | null;
  ancvConnectRequestedAmountLabel: string | null;
  externalAidLabel: string | null;
  externalPaidLabel: string | null;
  email: string;
  primaryPhone: string;
  secondaryPhone: string;
  postalAddress: string;
  billingAddress: string;
  coverageForm?: OrganizerReservationCoverageForm | null;
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
  reservation,
  resolveAction
}: {
  reservation: OrganizerReservationDetails;
  resolveAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const coverageForm = reservation.coverageForm ?? null;

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
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="min-w-0 pr-2">
                <h2
                  id={`reservation-details-title-${reservation.id}`}
                  className="font-display text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
                >
                  Réservation {reservation.reservationCode}
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

            <div className="min-w-0 overflow-y-auto px-6 pb-6 pt-2">
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 px-4 sm:px-5">
                <DetailRow label="Référence" value={reservation.reservationCode} />
                <DetailRow label="Mode de paiement" value={reservation.paymentModeLabel} />
                {reservation.cafNumber ? (
                  <DetailRow label="N° allocataire CAF" value={reservation.cafNumber} />
                ) : null}
                {reservation.ancvConnectMatricule ? (
                  <>
                    <DetailRow label="Matricule ANCV Connect" value={reservation.ancvConnectMatricule} />
                    {reservation.ancvConnectRequestedAmountLabel ? (
                      <DetailRow
                        label="Montant ANCV demandé"
                        value={reservation.ancvConnectRequestedAmountLabel}
                      />
                    ) : null}
                  </>
                ) : null}
                {reservation.externalAidLabel ? (
                  <DetailRow label="Prise en charge CAF" value={reservation.externalAidLabel} />
                ) : null}
                {reservation.externalPaidLabel ? (
                  <DetailRow label="Montant ANCV encaissé" value={reservation.externalPaidLabel} />
                ) : null}
                <DetailRow label="Adresse postale" value={reservation.postalAddress} />
                {reservation.billingAddress !== reservation.postalAddress ? (
                  <DetailRow label="Adresse de facturation" value={reservation.billingAddress} />
                ) : null}
                <DetailRow label="Mail" value={reservation.email} />
                <DetailRow label="Téléphone parent 1" value={reservation.primaryPhone} />
                <DetailRow label="Téléphone parent 2" value={reservation.secondaryPhone} />
              </dl>

              {coverageForm && resolveAction ? (
                <form
                  action={resolveAction}
                  className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
                >
                  <input type="hidden" name="organizer_id" value={coverageForm.organizerId} />
                  <input type="hidden" name="order_id" value={coverageForm.orderId} />
                  <input type="hidden" name="request_kind" value={coverageForm.requestKind} />
                  <p className="text-sm font-semibold text-amber-950">Montant de prise en charge</p>
                  <p className="text-xs text-amber-900/80">{coverageForm.referenceLabel}</p>
                  {coverageForm.currentAmountLabel ? (
                    <p className="text-xs text-amber-900">
                      Montant actuel : <strong>{coverageForm.currentAmountLabel}</strong>
                    </p>
                  ) : null}
                  <input
                    name="resolved_amount_euros"
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder={coverageForm.amountPlaceholder}
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    {coverageForm.submitLabel}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
