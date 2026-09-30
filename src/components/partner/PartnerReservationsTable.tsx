'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { orderStatusBadgeClassName } from '@/lib/order-workflow';
import { PartnerContributionAmountEditor } from '@/components/partner/PartnerContributionAmountEditor';
import { PartnerReservationDetailsModal } from '@/components/partner/PartnerReservationDetailsModal';

export type PartnerReservationTableRow = {
  id: string;
  createdAt: string;
  status: string;
  badgeStatus?: string;
  statusLabel: string;
  beneficiaryName: string;
  stayTitle: string;
  stayLocation: string;
  sessionLabel: string;
  childrenLabel: string;
  totalLabel: string;
  totalCents: number;
  partnerContributionCents: number;
  clientContributionCents: number;
  parentPaidCents: number;
  remainingBalanceCents: number;
  financeModeAtOrderLabel: string;
  requestKind: string | null;
  paymentMode: string;
  paymentModeLabel: string;
  vacafNumberSnapshot: string | null;
  vacafDepartmentCode: string | null;
  ancvConnectMatricule: string | null;
  ancvConnectRequestedAmountCents: number | null;
  externalAidCents: number;
  externalPaidCents: number;
  vacafCoverageLines: Array<{ label: string; amountCents: number }>;
  paymentLines: Array<{ dateLabel: string; label: string; amountCents: number }>;
  pendingActions: Array<{ actorLabel: string; description: string }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR');
}

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

export function PartnerReservationsTable({
  reservations,
  saveManualContribution
}: {
  reservations: PartnerReservationTableRow[];
  saveManualContribution: (formData: FormData) => void | Promise<void>;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function toggleExpanded(orderId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-[11%] px-2.5 py-3">Commande</th>
              <th className="w-[13%] px-2.5 py-3">Bénéficiaire</th>
              <th className="w-[16%] px-2.5 py-3">Séjour</th>
              <th className="w-[12%] px-2.5 py-3">Participants</th>
              <th className="w-[14%] px-2.5 py-3">Statut</th>
              <th className="w-[8%] px-2 py-3 text-right">Total</th>
              <th className="w-[10%] px-2 py-3 text-right">Part partenaire</th>
              <th className="w-[8%] px-2 py-3 text-right">Part client</th>
              <th className="w-[9%] px-2 py-3 text-right">Restant dû parents</th>
              <th className="w-8 px-1 py-3">
                <span className="sr-only">Détail</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation) => {
              const expanded = expandedIds.has(reservation.id);
              return (
                <Fragment key={reservation.id}>
                  <tr className="border-t border-slate-100 align-top">
                    <td className="px-2.5 py-3 text-slate-600">
                      <PartnerReservationDetailsModal
                        reservation={{
                          id: reservation.id,
                          createdAt: reservation.createdAt,
                          statusLabel: reservation.statusLabel,
                          beneficiaryName: reservation.beneficiaryName,
                          stayTitle: reservation.stayTitle,
                          stayLocation: reservation.stayLocation,
                          sessionLabel: reservation.sessionLabel,
                          childrenLabel: reservation.childrenLabel,
                          totalLabel: reservation.totalLabel,
                          partnerContributionLabel: formatCurrencyFromCents(
                            reservation.partnerContributionCents
                          ),
                          clientContributionLabel: formatCurrencyFromCents(
                            reservation.clientContributionCents
                          ),
                          requestKind: reservation.requestKind,
                          paymentMode: reservation.paymentMode,
                          paymentModeLabel: reservation.paymentModeLabel,
                          vacafNumberSnapshot: reservation.vacafNumberSnapshot,
                          vacafDepartmentCode: reservation.vacafDepartmentCode,
                          ancvConnectMatricule: reservation.ancvConnectMatricule,
                          ancvConnectRequestedAmountLabel:
                            typeof reservation.ancvConnectRequestedAmountCents === 'number'
                              ? formatCurrencyFromCents(reservation.ancvConnectRequestedAmountCents)
                              : null,
                          externalAidLabel:
                            reservation.externalAidCents > 0
                              ? formatCurrencyFromCents(reservation.externalAidCents)
                              : null,
                          externalPaidLabel:
                            reservation.externalPaidCents > 0
                              ? formatCurrencyFromCents(reservation.externalPaidCents)
                              : null,
                          pendingActions: reservation.pendingActions
                        }}
                      />
                      <p className="mt-1 text-xs text-slate-500">{formatDate(reservation.createdAt)}</p>
                    </td>
                    <td className="px-2.5 py-3 text-slate-600">
                      <p className="font-medium text-slate-900">{reservation.beneficiaryName}</p>
                    </td>
                    <td className="px-2.5 py-3 text-slate-600">
                      <p className="font-medium text-slate-900">{reservation.stayTitle}</p>
                      <p className="mt-1 text-xs text-slate-500">{reservation.stayLocation}</p>
                    </td>
                    <td className="px-2.5 py-3 text-slate-600">{reservation.childrenLabel}</td>
                    <td className="px-2.5 py-3">
                      <span
                        className={`inline-flex max-w-full rounded-full px-2 py-1 text-[11px] font-semibold leading-tight ${orderStatusBadgeClassName(
                          reservation.badgeStatus ?? reservation.status,
                          {
                            isPartnerFullCoverage:
                              reservation.statusLabel === 'Confirmée — paiement différé'
                          }
                        )}`}
                      >
                        {reservation.statusLabel}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right text-xs font-semibold text-slate-900 tabular-nums">
                      {reservation.totalLabel}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <PartnerContributionAmountEditor
                        orderId={reservation.id}
                        beneficiaryName={reservation.beneficiaryName}
                        partnerContributionCents={reservation.partnerContributionCents}
                        saveAction={saveManualContribution}
                        compact
                      />
                    </td>
                    <td className="px-2 py-3 text-right text-xs font-semibold text-slate-900 tabular-nums">
                      {formatCurrencyFromCents(reservation.clientContributionCents)}
                    </td>
                    <td className="px-2 py-3 text-right text-xs font-semibold text-slate-900 tabular-nums">
                      {formatCurrencyFromCents(reservation.remainingBalanceCents)}
                    </td>
                    <td className="px-1 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(reservation.id)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        aria-expanded={expanded}
                        aria-label={
                          expanded
                            ? `Masquer le détail de la commande`
                            : `Afficher le détail de la commande`
                        }
                      >
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-t border-slate-100 bg-slate-50/80">
                      <td colSpan={10} className="px-4 py-4">
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                              <tr>
                                <th className="px-4 py-2.5">Libellé</th>
                                <th className="px-4 py-2.5">Détail</th>
                                <th className="px-4 py-2.5 text-right">Montant</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-t border-slate-100">
                                <td className="px-4 py-2.5 font-medium text-slate-900">Prix du séjour</td>
                                <td className="px-4 py-2.5 text-slate-600">{reservation.stayTitle}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                                  {formatCurrencyFromCents(reservation.totalCents)}
                                </td>
                              </tr>
                              <tr className="border-t border-slate-100">
                                <td className="px-4 py-2.5 font-medium text-slate-900">
                                  Mode de financement partenaire
                                </td>
                                <td className="px-4 py-2.5 text-slate-600" colSpan={2}>
                                  À la commande : {reservation.financeModeAtOrderLabel}
                                </td>
                              </tr>
                              <tr className="border-t border-slate-100">
                                <td className="px-4 py-2.5 font-medium text-slate-900">
                                  Part partenaire
                                </td>
                                <td className="px-4 py-2.5 text-slate-600">Prise en charge CSE</td>
                                <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                                  −&nbsp;{formatCurrencyFromCents(reservation.partnerContributionCents)}
                                </td>
                              </tr>
                              {reservation.vacafCoverageLines.length > 0 ? (
                                reservation.vacafCoverageLines.map((line) => (
                                  <tr key={line.label} className="border-t border-slate-100">
                                    <td className="px-4 py-2.5 font-medium text-slate-900">
                                      Prise en charge VACAF
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-600">{line.label}</td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                                      −&nbsp;{formatCurrencyFromCents(line.amountCents)}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr className="border-t border-slate-100">
                                  <td className="px-4 py-2.5 font-medium text-slate-900">
                                    Prise en charge VACAF
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-500" colSpan={2}>
                                    Aucune
                                  </td>
                                </tr>
                              )}
                              {reservation.paymentLines.length > 0 ? (
                                reservation.paymentLines.map((line, index) => (
                                  <tr
                                    key={`${line.label}-${line.dateLabel}-${index}`}
                                    className="border-t border-slate-100"
                                  >
                                    <td className="px-4 py-2.5 font-medium text-slate-900">
                                      {index === 0 ? 'Paiements' : ''}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-600">
                                      {line.dateLabel} · {line.label}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                                      −&nbsp;{formatCurrencyFromCents(line.amountCents)}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr className="border-t border-slate-100">
                                  <td className="px-4 py-2.5 font-medium text-slate-900">Paiements</td>
                                  <td className="px-4 py-2.5 text-slate-500" colSpan={2}>
                                    Aucun paiement enregistré
                                  </td>
                                </tr>
                              )}
                              <tr className="border-t border-slate-200 bg-amber-50/60">
                                <td className="px-4 py-2.5 font-semibold text-amber-950">Restant dû</td>
                                <td className="px-4 py-2.5 text-amber-900/80">Solde famille</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-amber-950">
                                  {formatCurrencyFromCents(reservation.remainingBalanceCents)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {reservations.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={10}>
                  Aucune réservation liée à votre code CSE.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
