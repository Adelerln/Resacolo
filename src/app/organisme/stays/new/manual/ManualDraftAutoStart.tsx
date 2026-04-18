'use client';

import { useEffect, useRef } from 'react';
import { startManualDraft } from './actions';

type ManualDraftAutoStartProps = {
  organizerId: string;
};

/**
 * Crée le brouillon et redirige vers le tunnel de relecture sans écran intermédiaire « ouvrir l’éditeur ».
 */
export default function ManualDraftAutoStart({ organizerId }: ManualDraftAutoStartProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={startManualDraft} className="space-y-4">
      <input type="hidden" name="organizerId" value={organizerId} />
      <p className="text-sm text-slate-600">Ouverture du formulaire…</p>
      <p className="text-xs text-slate-500">
        Si rien ne se passe,{' '}
        <button
          type="submit"
          className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
        >
          clique ici pour continuer
        </button>
        .
      </p>
    </form>
  );
}
