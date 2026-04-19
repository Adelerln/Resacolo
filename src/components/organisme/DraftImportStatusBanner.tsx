'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type DraftImportStatusBannerProps = {
  /** Rafraîchit la page serveur tant que l’import n’a pas abouti. */
  pollWhilePending: boolean;
  importErrorMessage: string | null;
  importWarningMessage: string | null;
};

function DraftImportAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 4000);
    return () => window.clearInterval(id);
  }, [active, router]);

  return null;
}

export default function DraftImportStatusBanner({
  pollWhilePending,
  importErrorMessage,
  importWarningMessage
}: DraftImportStatusBannerProps) {
  return (
    <>
      {pollWhilePending ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Import en cours…</p>
          <p className="mt-1 text-amber-900/90">
            Récupération et analyse de la fiche (cela peut prendre plusieurs minutes). Cette page se
            met à jour automatiquement.
          </p>
          <DraftImportAutoRefresh active />
        </div>
      ) : null}

      {importWarningMessage ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Import partiel</p>
          <p className="mt-1 whitespace-pre-wrap text-amber-900/90">{importWarningMessage}</p>
        </div>
      ) : null}

      {importErrorMessage ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
          role="alert"
        >
          <p className="font-semibold">Échec de l’import</p>
          <p className="mt-1 whitespace-pre-wrap text-red-900/90">{importErrorMessage}</p>
        </div>
      ) : null}
    </>
  );
}
