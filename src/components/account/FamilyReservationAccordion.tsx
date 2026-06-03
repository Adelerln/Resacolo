'use client';

import Link from 'next/link';
import { CalendarDays, ChevronDown, Mail, ShieldCheck, Wallet } from 'lucide-react';
import { formatMoneyCentsFr } from '@/lib/format-money-fr';
import { orderStatusBadgeClassName } from '@/lib/order-workflow';
import type { FamilyReservation } from '@/types/family-profile';

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
    <div className="grid gap-1 py-3 sm:grid-cols-[minmax(160px,200px)_1fr] sm:items-start sm:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd
        className={`min-w-0 text-sm leading-relaxed ${
          isEmpty
            ? 'text-slate-400 italic'
            : accent
              ? 'font-semibold text-accent-600'
              : 'font-medium text-slate-900'
        }`}
      >
        {isEmpty ? 'Non renseigné' : display}
      </dd>
    </div>
  );
}

function canPayBalance(reservation: FamilyReservation) {
  return (
    reservation.remainingBalanceCents > 0 &&
    reservation.orderStatus !== 'CANCELLED' &&
    reservation.orderStatus !== 'CART'
  );
}

function canContactOrganizer(reservation: FamilyReservation) {
  return (
    Boolean(reservation.organizerContactEmail) &&
    (['PAID', 'PARTIALLY_PAID', 'PENDING_PAYMENT', 'REQUESTED', 'CONFIRMED'].includes(reservation.orderStatus) ||
      reservation.hasSuccessfulPayment)
  );
}

export default function FamilyReservationAccordion({
  reservation,
  defaultOpen = false
}: {
  reservation: FamilyReservation;
  defaultOpen?: boolean;
}) {
  const showBalancePay = canPayBalance(reservation);

  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-xl border border-slate-300 bg-white text-sm shadow-sm"
    >
      <summary className="grid cursor-pointer list-none grid-cols-[96px_minmax(0,1fr)] overflow-hidden [&::-webkit-details-marker]:hidden">
        {reservation.coverImage ? (
          <div className="h-full min-h-[9rem] overflow-hidden bg-slate-100">
            <img
              src={reservation.coverImage}
              alt={reservation.title}
              className={`h-full w-full object-cover ${reservation.isPast ? 'opacity-85' : ''}`}
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className={`flex min-h-[9rem] items-center justify-center ${
              reservation.isPast
                ? 'bg-slate-200/80'
                : 'bg-gradient-to-br from-brand-100 via-blue-100 to-cyan-100'
            }`}
          >
            <CalendarDays
              className={`h-10 w-10 shrink-0 ${reservation.isPast ? 'text-slate-400' : 'text-brand-600'}`}
              aria-hidden
            />
          </div>
        )}

        <div className="flex min-w-0 flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className={`font-display text-base font-semibold leading-snug sm:text-lg ${
                  reservation.isPast ? 'text-slate-500' : 'text-slate-900'
                }`}
              >
                {reservation.title}
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>{reservation.dates}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{reservation.child}</p>
            </div>
            <ChevronDown
              className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180"
              aria-hidden
            />
          </div>

          <div className="mt-auto flex flex-col items-start gap-1 pt-3">
            <span
              className={`inline-flex w-fit max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                reservation.isPast
                  ? 'bg-slate-200 text-slate-600'
                  : orderStatusBadgeClassName(reservation.orderStatus)
              }`}
            >
              <ShieldCheck className="h-3 w-3 shrink-0" />
              {reservation.status}
            </span>
            {reservation.remainingBalanceCents > 0 ? (
              <span className="inline-flex w-fit max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <Wallet className="h-3 w-3 shrink-0" />
                Solde à régler : {formatMoneyCentsFr(reservation.remainingBalanceCents, reservation.currency)}
              </span>
            ) : null}
          </div>
        </div>
      </summary>

      <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4 sm:px-6">
        <div className={`grid gap-3 ${reservation.remainingBalanceCents > 0 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Montant total</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatMoneyCentsFr(reservation.totalCents, reservation.currency)}
            </p>
          </div>
          {reservation.remainingBalanceCents > 0 ? (
            <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-700">Solde restant</p>
              <p className="mt-1 text-xl font-bold text-accent-700">
                {formatMoneyCentsFr(reservation.remainingBalanceCents, reservation.currency)}
              </p>
            </div>
          ) : null}
        </div>

        {reservation.partnerAdjustmentMessage ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Message du partenaire</p>
            <p className="mt-1 whitespace-pre-line">{reservation.partnerAdjustmentMessage}</p>
            {reservation.partnerAdjustmentUpdatedAt ? (
              <p className="mt-2 text-xs text-amber-800/80">
                Mis à jour le {new Date(reservation.partnerAdjustmentUpdatedAt).toLocaleString('fr-FR')}
              </p>
            ) : null}
          </div>
        ) : null}

        <dl className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-4">
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
            <DetailRow label="Transport" value={reservation.transportLine ?? ''} />
          )}
          <DetailRow label="Assurance" value={reservation.insuranceLine ?? 'Aucune'} />
          <DetailRow
            label="Options complémentaires"
            value={reservation.extraLines.length > 0 ? reservation.extraLines.join(' | ') : 'Aucune'}
          />
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {showBalancePay ? (
            <Link
              href={`/mon-compte/reservations/${reservation.orderId}/paiement`}
              className="btn btn-primary btn-sm"
            >
              Régler le solde en ligne
            </Link>
          ) : null}
          {canContactOrganizer(reservation) ? (
            <a
              href={`mailto:${encodeURIComponent(reservation.organizerContactEmail ?? '')}?subject=${encodeURIComponent(
                `Réservation ${reservation.orderId} - Contact famille`
              )}&body=${encodeURIComponent(
                `Bonjour${reservation.organizerName ? ` ${reservation.organizerName}` : ''},\n\nJe vous contacte concernant ma réservation ${reservation.orderId}.\n\nCordialement,`
              )}`}
              className="btn btn-secondary btn-sm"
            >
              <Mail className="h-4 w-4" />
              Contacter l&apos;organisme
            </a>
          ) : null}
        </div>
      </div>
    </details>
  );
}
