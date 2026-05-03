'use client';

import { useRouter } from 'next/navigation';

export default function ForbiddenPage() {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Accès refusé</h1>
        <p className="mt-3 text-sm text-slate-700">
          Votre compte n&apos;a pas les droits nécessaires pour accéder à cet espace organisme.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez votre organisme de rattachement ou
          l&apos;équipe support.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Revenir à la page précédente
          </button>
        </div>
      </div>
    </div>
  );
}
