'use client';

import Link from 'next/link';
import { Link2, PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { withOrganizerQuery } from '@/lib/organizers';

type NewStayChoiceModalTriggerProps = {
  organizerId: string | null;
};

export default function NewStayChoiceModalTrigger({
  organizerId
}: NewStayChoiceModalTriggerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Nouveau séjour
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Créer un séjour</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Choisis la méthode de création qui convient le mieux.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href={withOrganizerQuery('/organisme/sejours/new/manual', organizerId)}
                className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-4 text-center text-sm font-semibold leading-snug text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                  <PenLine className="h-5 w-5" aria-hidden />
                </span>
                <span>Saisie manuelle</span>
              </Link>
              <Link
                href={withOrganizerQuery('/organisme/sejours/new', organizerId)}
                className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-sm font-semibold leading-snug text-slate-900 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Link2 className="h-5 w-5" aria-hidden />
                </span>
                <span>Import via une URL</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
