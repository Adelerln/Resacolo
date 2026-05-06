'use client';

import { CircleHelp } from 'lucide-react';
import { useState } from 'react';
import { PARTNER_OFFER_DESCRIPTIONS, PARTNER_OFFER_LABELS, type PartnerOfferValue } from '@/lib/partner-offers';

export default function PartnerOfferHelp({ offer }: { offer: PartnerOfferValue }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Comprendre les offres partenaire"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
      >
        <CircleHelp className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="admin-section-title">Différence entre les offres</h3>
                <p className="admin-page-subtitle mt-1 whitespace-nowrap">
                  Le mode d&apos;offre est défini par l&apos;administration et n&apos;est pas modifiable ici.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {(['IDENTITE', 'SERENITE'] as const).map((value) => (
                <div
                  key={value}
                  className={`rounded-xl border px-4 py-4 ${
                    offer === value ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{PARTNER_OFFER_LABELS[value]}</div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{PARTNER_OFFER_DESCRIPTIONS[value]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
