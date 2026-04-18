import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

export const metadata = {
  title: 'Connexion familles | Resacolo'
};

function sanitizeRelativePath(value: string | undefined) {
  if (!value) return '/mon-compte';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/mon-compte';
  }
  return trimmed;
}

export default async function FamilyLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ redirectTo?: string }>;
}) {
  if (process.env.MOCK_UI === '1') {
    return null;
  }

  const { redirectTo } = searchParams ? await searchParams : {};
  const safeRedirectTo = sanitizeRelativePath(redirectTo);
  const createAccountHref = `/login/familles/creer-compte?redirectTo=${encodeURIComponent(safeRedirectTo)}`;

  const session = await getSession();
  if (session) {
    if (session.role === 'ADMIN') redirect('/admin');
    if (session.role === 'ORGANISATEUR') redirect('/organisme');
    if (session.role === 'PARTENAIRE') redirect('/partenaire');
    redirect(safeRedirectTo);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Connexion familles</h1>
        <p className="mt-2 text-sm text-slate-600">
          Connectez-vous pour accéder à votre espace famille.
        </p>
        <form className="mt-6 space-y-4" action="/api/auth/login" method="post">
          <input type="hidden" name="redirectTo" value={safeRedirectTo} />
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mot de passe
            <input
              name="password"
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600"
          >
            Se connecter
          </button>
        </form>
        <Link
          href={createAccountHref}
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-accent-500 px-4 py-2 text-sm font-semibold text-accent-600 hover:bg-accent-50"
        >
          Créer un compte
        </Link>
        <p className="mt-4 text-sm text-slate-600">
          Accès organisateurs, partenaires et admin :{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            page de connexion générale
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
