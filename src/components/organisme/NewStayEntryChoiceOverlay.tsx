'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link2, PenLine, X } from 'lucide-react';
import { withOrganizerQuery } from '@/lib/organizers';

type NewStayEntryChoiceOverlayProps = {
  organizerId: string | null;
};

export default function NewStayEntryChoiceOverlay({
  organizerId
}: NewStayEntryChoiceOverlayProps) {
  const router = useRouter();
  const importHref = withOrganizerQuery('/organisme/sejours/new/url', organizerId);
  const manualHref = withOrganizerQuery('/organisme/sejours/new/manual', organizerId);
  const closeHref = useMemo(
    () => withOrganizerQuery('/organisme/sejours', organizerId),
    [organizerId]
  );
  const firstActionRef = useRef<HTMLAnchorElement | null>(null);

  const closeOverlay = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(closeHref);
  }, [closeHref, router]);

  useEffect(() => {
    firstActionRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeOverlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeOverlay]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-stay-entry-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
      onClick={closeOverlay}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Création de séjour
            </p>
            <h1 id="new-stay-entry-title" className="text-2xl font-semibold text-slate-900">
              Choisis ton point de départ
            </h1>
            <p className="text-sm text-slate-600">
              Sélectionne un mode, puis continue sur l&apos;écran suivant.
            </p>
          </div>
          <button
            type="button"
            onClick={closeOverlay}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={importHref}
            ref={firstActionRef}
            className="group rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Link2 className="h-5 w-5" />
            </span>
            <span className="block text-base font-semibold text-slate-900">Import via URL</span>
            <span className="mt-1 block text-sm text-slate-600">
              Pré-remplis un brouillon à partir d&apos;une fiche existante.
            </span>
          </Link>

          <Link
            href={manualHref}
            className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <PenLine className="h-5 w-5" />
            </span>
            <span className="block text-base font-semibold text-slate-900">Brouillon manuel</span>
            <span className="mt-1 block text-sm text-slate-600">
              Crée un brouillon vide puis passe directement à la relecture.
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
