'use client';

import { useEffect } from 'react';

export default function MonCompteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[mon-compte] erreur de rendu', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="font-display text-xl font-semibold text-slate-900">Chargement interrompu</p>
        <p className="mt-2 text-sm text-slate-600">
          La page Mon compte n&apos;a pas pu s&apos;afficher. Réessayez dans quelques instants.
        </p>
        <button type="button" onClick={() => reset()} className="btn btn-primary btn-sm mt-5">
          Réessayer
        </button>
      </div>
    </div>
  );
}
