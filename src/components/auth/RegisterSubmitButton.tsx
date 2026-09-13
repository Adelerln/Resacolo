'use client';

import { useFormStatus } from 'react-dom';

export function RegisterSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(250,133,0,0.8)] transition hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? 'Création en cours…' : 'Créer mon compte'}
    </button>
  );
}
