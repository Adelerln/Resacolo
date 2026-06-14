import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, ShieldCheck, UserRound } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  PASSWORD_POLICY_HTML_PATTERN,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_MIN_LENGTH
} from '@/lib/auth/password-policy';

export const metadata = {
  title: 'Créer un compte familles | Resacolo'
};

const INPUT_CLASS =
  'mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tracking-normal text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200';

function sanitizeRelativePath(value: string | undefined) {
  if (!value) return '/mon-compte';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/mon-compte';
  }
  return trimmed;
}

export default async function FamilyRegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ redirectTo?: string; error?: string }>;
}) {
  if (process.env.MOCK_UI === '1') {
    return null;
  }

  const params = searchParams ? await searchParams : {};
  const safeRedirectTo = sanitizeRelativePath(params.redirectTo);
  const loginHref = `/login/familles?redirectTo=${encodeURIComponent(safeRedirectTo)}`;

  const session = await getCurrentUser();
  if (session) {
    if (session.role === 'MNEMOS') redirect('/mnemos');
    if (session.role === 'ADMIN') redirect('/admin');
    if (session.role === 'ORGANISATEUR') redirect('/organisme');
    if (session.role === 'PARTENAIRE') redirect('/partenaire');
    redirect(safeRedirectTo);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-4 -z-10 h-52 rounded-[44px] bg-gradient-to-r from-brand-100/70 via-sky-100/60 to-orange-100/60 blur-3xl"
        />

        <header className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Espace familles</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Créer un compte
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
            Centralisez vos informations famille pour retrouver vos réservations et gérer votre espace personnel.
          </p>
        </header>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
          <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.4)] sm:p-6">
            <h2 className="font-display text-xl font-semibold text-slate-900">Votre espace en un seul endroit</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3.5">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <UserRound className="h-4 w-4 text-brand-600" />
                  Profil famille centralisé
                </p>
                <p className="mt-1 text-slate-600">Retrouver vos informations parent et enfants.</p>
              </li>
              <li className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3.5">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Suivi des séjours
                </p>
                <p className="mt-1 text-slate-600">Suivre les réservations de séjours depuis votre compte.</p>
              </li>
              <li className="rounded-xl border border-orange-100 bg-orange-50/70 px-4 py-3.5">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-orange-600" />
                  Données toujours modifiables
                </p>
                <p className="mt-1 text-slate-600">Modifier vos données famille à tout moment.</p>
              </li>
            </ul>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <p className="text-sm text-slate-600">
                Vous avez déjà un compte ?{' '}
                <Link href={loginHref} className="font-semibold text-brand-600 hover:text-brand-700">
                  Se connecter
                </Link>
                .
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.4)] sm:p-6">
            <h2 className="font-display text-xl font-semibold text-slate-900">Informations du compte</h2>

            {params.error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {params.error}
              </p>
            ) : null}

            <form className="mt-5 space-y-6" action="/api/auth/register-client" method="post">
              <input type="hidden" name="redirectTo" value={safeRedirectTo} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Prénom
                  <input name="firstName" type="text" className={INPUT_CLASS} required />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Nom
                  <input name="lastName" type="text" className={INPUT_CLASS} required />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input name="email" type="email" className={INPUT_CLASS} required />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Téléphone
                <input name="phone" type="tel" className={INPUT_CLASS} required />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Adresse postale
                <input name="addressLine1" type="text" className={INPUT_CLASS} required />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Complément d&apos;adresse
                <input name="addressLine2" type="text" className={INPUT_CLASS} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Code postal
                  <input name="postalCode" type="text" className={INPUT_CLASS} required />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Ville
                  <input name="city" type="text" className={INPUT_CLASS} required />
                </label>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Mot de passe
                  <PasswordInput
                    name="password"
                    required
                    minLength={PASSWORD_POLICY_MIN_LENGTH}
                    pattern={PASSWORD_POLICY_HTML_PATTERN}
                    title={PASSWORD_POLICY_MESSAGE}
                    inputClassName={INPUT_CLASS}
                  />
                </label>
                <p className="rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-800">
                  {PASSWORD_POLICY_MESSAGE}
                </p>
              </div>

              <details className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                  Ajouter un parent 2 (facultatif)
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Nom parent 2
                      <input name="parent2LastName" type="text" className={INPUT_CLASS} />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Prénom parent 2
                      <input name="parent2FirstName" type="text" className={INPUT_CLASS} />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Statut
                      <select name="parent2Status" className={INPUT_CLASS} defaultValue="">
                        <option value="">Sélectionner</option>
                        <option value="pere">Père</option>
                        <option value="mere">Mère</option>
                        <option value="grand-parent">Grand-parent</option>
                        <option value="autre">Autre</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Précision si “Autre”
                      <input name="parent2StatusOther" type="text" className={INPUT_CLASS} />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Téléphone
                      <input name="parent2Phone" type="tel" className={INPUT_CLASS} />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Email
                      <input name="parent2Email" type="email" className={INPUT_CLASS} />
                    </label>
                  </div>
                </div>
              </details>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  name="cguAccepted"
                  type="checkbox"
                  required
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  J&apos;accepte les{' '}
                  <Link
                    href="/cgu-popup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                  >
                    Conditions Générales d&apos;Utilisation
                  </Link>
                  .
                </span>
              </label>

              <button
                type="submit"
                className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(250,133,0,0.8)] transition hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
              >
                Créer mon compte
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
