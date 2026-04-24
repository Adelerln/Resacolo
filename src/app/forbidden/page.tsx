import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Acces refuse</h1>
        <p className="mt-3 text-sm text-slate-700">
          Votre compte n&apos;a pas les droits necessaires pour acceder a cet espace organisme.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez votre organisme de rattachement ou
          l&apos;equipe support.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Retour a la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
