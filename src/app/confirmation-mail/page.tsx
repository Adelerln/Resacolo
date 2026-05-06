import Link from 'next/link';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';

type ConfirmationStatus = 'success' | 'error';

function normalizeStatus(value: string | undefined): ConfirmationStatus {
  return value === 'success' ? 'success' : 'error';
}

export default async function EmailConfirmationPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const { status } = searchParams ? await searchParams : {};
  const normalizedStatus = normalizeStatus(status);
  const session = await getCurrentUser();
  const primaryHref = session ? '/mon-compte' : '/';
  const isSuccess = normalizedStatus === 'success';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-orange-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          {isSuccess ? (
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
              <CheckCircle2 className="h-7 w-7" />
            </div>
          ) : (
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
              <AlertTriangle className="h-7 w-7" />
            </div>
          )}
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Confirmation du compte
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">
            {isSuccess ? 'Email confirmé' : 'Lien invalide ou expiré'}
          </h1>
        </div>

        <div className="mt-6 text-center">
          {isSuccess ? (
            <p className="text-base leading-relaxed text-slate-700">
              Votre compte a bien été confirmé, vous pouvez continuer.
            </p>
          ) : (
            <p className="text-base leading-relaxed text-slate-700">
              Le lien de confirmation n’est plus valide. Demandez un nouveau lien et réessayez.
            </p>
          )}

          <p className="mx-auto mt-4 max-w-lg text-sm text-slate-600">
            {session
              ? 'Votre session est active. Vous pouvez ouvrir directement votre espace.'
              : 'Vous pouvez retourner à l’accueil ou vous connecter à votre espace famille.'}
          </p>

          <div className="mx-auto mt-6 h-px w-full max-w-md bg-slate-200" />

          <div className="mx-auto mt-6 max-w-md space-y-3">
            <Link
              href={primaryHref}
              className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2b8fcb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              {session ? 'Aller à mon compte' : 'Aller à l’accueil'}
            </Link>
            <Link
              href="/login?mode=family"
              className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
