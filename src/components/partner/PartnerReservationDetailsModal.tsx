'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

type PartnerReservationDetails = {
  id: string;
  createdAt: string;
  statusLabel: string;
  beneficiaryName: string;
  stayTitle: string;
  stayLocation: string;
  sessionLabel: string;
  childrenLabel: string;
  totalLabel: string;
  partnerContributionLabel: string;
  clientContributionLabel: string;
  requestKind: string | null;
  paymentMode: string;
  paymentModeLabel: string;
  vacafNumberSnapshot: string | null;
  ancvConnectMatricule: string | null;
  ancvConnectRequestedAmountLabel: string | null;
  externalAidLabel: string | null;
  externalPaidLabel: string | null;
  pendingActions: Array<{
    actorLabel: string;
    description: string;
  }>;
};

function formatOrderCode(orderId: string) {
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  const display = String(value ?? '').trim();
  const isEmpty = !display;

  return (
    <div className="flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-baseline sm:gap-x-8 sm:py-3">
      <dt className="shrink-0 text-sm font-medium text-slate-600 sm:w-52">{label}</dt>
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

export function PartnerReservationDetailsModal({ reservation }: { reservation: PartnerReservationDetails }) {
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
        className="font-medium text-slate-900 underline underline-offset-2 transition hover:text-brand-700"
      >
        {formatOrderCode(reservation.id)}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`partner-reservation-details-title-${reservation.id}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="min-w-0 pr-2">
                <h2
                  id={`partner-reservation-details-title-${reservation.id}`}
                  className="font-display text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
                >
                  Réservation {formatOrderCode(reservation.id)}
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  {reservation.beneficiaryName}
                  <span className="text-slate-300"> · </span>
                  {reservation.stayTitle}
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

            <div className="min-w-0 overflow-x-hidden overflow-y-auto px-6 pb-6 pt-2">
              <div
                className={`mb-4 min-w-0 rounded-xl px-4 py-3 ${
                  reservation.pendingActions.length > 0
                    ? 'border border-amber-200 bg-amber-50'
                    : 'border border-emerald-200 bg-emerald-50'
                }`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    reservation.pendingActions.length > 0 ? 'text-amber-800' : 'text-emerald-800'
                  }`}
                >
                  Actions en attente
                </p>
                {reservation.pendingActions.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {reservation.pendingActions.map((action, index) => (
                      <li
                        key={`${action.actorLabel}-${index}`}
                        className="min-w-0 break-words rounded-lg bg-white/70 px-3 py-2 text-sm leading-relaxed text-slate-900"
                      >
                        <span className="font-semibold">{action.actorLabel} :</span>{' '}
                        <span className="break-words">{action.description}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm font-medium text-emerald-950">
                    Aucune action en attente sur cette réservation.
                  </p>
                )}
              </div>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 px-4 sm:px-5">
                <DetailRow label="Statut" value={reservation.statusLabel} />
                {reservation.pendingActions.length > 0 ? (
                  <DetailRow
                    label="Acteurs concernés"
                    value={Array.from(new Set(reservation.pendingActions.map((action) => action.actorLabel))).join(', ')}
                  />
                ) : null}
                <DetailRow
                  label="Créée le"
                  value={new Date(reservation.createdAt).toLocaleString('fr-FR')}
                />
                <DetailRow label="Séjour" value={reservation.stayTitle} />
                <DetailRow label="Lieu" value={reservation.stayLocation} />
                <DetailRow label="Session" value={reservation.sessionLabel} />
                <DetailRow label="Participants" value={reservation.childrenLabel} />
                <DetailRow label="Total commande" value={reservation.totalLabel} />
                <DetailRow label="Part partenaire" value={reservation.partnerContributionLabel} />
                <DetailRow label="Reste client" value={reservation.clientContributionLabel} />
                <DetailRow label="Mode de règlement indiqué" value={reservation.paymentModeLabel} />
                <DetailRow
                  label="Traitement demandé"
                  value={
                    reservation.requestKind === 'VACAF'
                      ? 'VACAF / AVE'
                      : reservation.requestKind === 'ANCV_CONNECT'
                        ? 'ANCV Connect'
                        : reservation.paymentMode === 'CV_PAPER'
                          ? 'ANCV papier'
                        : 'Aucun traitement manuel'
                  }
                />
                {reservation.requestKind === 'VACAF' ? (
                  <DetailRow label="Numéro allocataire CAF" value={reservation.vacafNumberSnapshot} />
                ) : null}
                {reservation.requestKind === 'ANCV_CONNECT' ? (
                  <>
                    <DetailRow label="Matricule ANCV Connect" value={reservation.ancvConnectMatricule} />
                    <DetailRow
                      label="Montant demandé en ANCV Connect"
                      value={reservation.ancvConnectRequestedAmountLabel}
                    />
                  </>
                ) : null}
                {reservation.externalAidLabel ? (
                  <DetailRow label="Montant CAF déduit" value={reservation.externalAidLabel} />
                ) : null}
                {reservation.externalPaidLabel ? (
                  <DetailRow label="Montant ANCV encaissé" value={reservation.externalPaidLabel} />
                ) : null}
              </dl>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
