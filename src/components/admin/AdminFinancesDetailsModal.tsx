'use client';

import { useState } from 'react';

type FinancesBreakdownRow = {
  label: string;
  commissionClientCents: number;
  commissionPartnerCents: number;
  publicationFeeCents: number;
  commissionDetails: Array<{
    key: string;
    organizerName: string;
    stayTitle: string;
    orderVolumeCents: number;
    commissionClientCents: number;
    lineCount: number;
  }>;
  partnerCommissionDetails: Array<{
    key: string;
    organizerName: string;
    stayTitle: string;
    orderVolumeCents: number;
    commissionClientCents: number;
    lineCount: number;
  }>;
  publicationDetails: Array<{
    key: string;
    organizerName: string;
    publicationFeeCents: number;
    stayCount: number;
    stayTitles: string[];
  }>;
};

function eurosFromCents(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function AdminFinancesDetailsModal({ row }: { row: FinancesBreakdownRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        Détails
      </button>

      {open && (
        <div className="fixed inset-0 z-[160]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Fermer le détail"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 max-h-[86vh] w-[min(980px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Détail recettes</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{row.label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <div className="max-h-[calc(86vh-88px)] space-y-6 overflow-y-auto p-5">
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900">Commissions clients</h3>
                  <p className="text-sm font-semibold text-slate-700">{eurosFromCents(row.commissionClientCents)}</p>
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-[760px] w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Organisateur</th>
                        <th className="px-3 py-2">Séjour</th>
                        <th className="px-3 py-2 text-right">CA lignes commande TTC</th>
                        <th className="px-3 py-2 text-right">Commission client</th>
                        <th className="px-3 py-2 text-right">Lignes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {row.commissionDetails.map((detail) => (
                        <tr key={detail.key}>
                          <td className="px-3 py-2 font-medium text-slate-900">{detail.organizerName}</td>
                          <td className="px-3 py-2 text-slate-700">{detail.stayTitle}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {eurosFromCents(detail.orderVolumeCents)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {eurosFromCents(detail.commissionClientCents)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{detail.lineCount}</td>
                        </tr>
                      ))}
                      {row.commissionDetails.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                            Aucune commission client sur cette ligne.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900">Commissions partenaires</h3>
                  <p className="text-sm font-semibold text-slate-700">{eurosFromCents(row.commissionPartnerCents)}</p>
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-[760px] w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Organisateur</th>
                        <th className="px-3 py-2">Séjour</th>
                        <th className="px-3 py-2 text-right">CA lignes commande TTC</th>
                        <th className="px-3 py-2 text-right">Commission partenaire</th>
                        <th className="px-3 py-2 text-right">Lignes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {row.partnerCommissionDetails.map((detail) => (
                        <tr key={detail.key}>
                          <td className="px-3 py-2 font-medium text-slate-900">{detail.organizerName}</td>
                          <td className="px-3 py-2 text-slate-700">{detail.stayTitle}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {eurosFromCents(detail.orderVolumeCents)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {eurosFromCents(detail.commissionClientCents)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{detail.lineCount}</td>
                        </tr>
                      ))}
                      {row.partnerCommissionDetails.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                            Aucune commission partenaire sur cette ligne.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
