import Link from 'next/link';
import { redirect } from 'next/navigation';
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
  'mt-1.5 min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tracking-normal text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100';

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
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Espace familles</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Créer un compte
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
            Centralisez vos informations famille pour retrouver vos réservations et gérer votre espace personnel.
          </p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-xl font-semibold text-slate-900">Votre espace en un seul endroit</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                Retrouver vos informations parent et enfants.
              </li>
              <li className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                Suivre les réservations de séjours depuis votre compte.
              </li>
              <li className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                Modifier vos données famille à tout moment.
              </li>
            </ul>
            <p className="mt-5 text-sm text-slate-600">
              Vous avez déjà un compte ?{' '}
              <Link href={loginHref} className="font-semibold text-brand-600 hover:text-brand-700">
                Se connecter
              </Link>
              .
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-xl font-semibold text-slate-900">Informations du compte</h2>

            {params.error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {params.error}
              </p>
            ) : null}

            <form className="mt-5 space-y-4" action="/api/auth/register-client" method="post">
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
              <p className="text-xs text-slate-500">{PASSWORD_POLICY_MESSAGE}</p>

              <details className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                  Ajouter un parent 2 (facultatif)
                </summary>
                <div className="mt-4 space-y-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Nom complet
                    <input name="parent2Name" type="text" className={INPUT_CLASS} />
                  </label>
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

              <button
                type="submit"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
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
