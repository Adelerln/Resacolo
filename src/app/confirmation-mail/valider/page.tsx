import Link from 'next/link';
import { MailCheck } from 'lucide-react';

type ConfirmationPageProps = {
  searchParams?: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
};

function sanitizeRelativePath(value: string | undefined) {
  const trimmed = (value ?? '').trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/confirmation-mail';
  return trimmed;
}

export default async function ValidateEmailPage({ searchParams }: ConfirmationPageProps) {
  const params = searchParams ? await searchParams : {};
  const tokenHash = (params.token_hash ?? '').trim();
  const type = (params.type ?? '').trim();
  const canConfirm = Boolean(tokenHash && type === 'email');

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-orange-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <MailCheck className="h-7 w-7" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Confirmation du compte
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
          Confirmez votre adresse e-mail
        </h1>

        {canConfirm ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Cliquez sur le bouton ci-dessous pour activer votre compte Resacolo.
            </p>
            <form action="/auth/confirm" method="post" className="mt-6">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value="email" />
              <input type="hidden" name="next" value={sanitizeRelativePath(params.next)} />
              <button
                type="submit"
                className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#FA8500] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ef7d00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                Confirmer mon adresse e-mail
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Ce lien de confirmation est incomplet. Demandez un nouvel e-mail depuis la page de connexion.
            </p>
            <Link
              href="/login?mode=family"
              className="mt-6 inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Aller à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
