import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

function mapLoginErrorMessage(code: string | undefined) {
  switch (code) {
    case 'db-config':
      return 'Configuration base de données invalide (DATABASE_URL). Vérifiez .env.local.';
    case 'db-unreachable':
      return 'Base de données injoignable. Vérifiez DATABASE_URL, réseau et statut Supabase.';
    case 'invalid-credentials':
      return 'Identifiants invalides.';
    case 'invalid-input':
      return 'Formulaire invalide.';
    case 'supabase':
      return 'Erreur Supabase pendant la connexion.';
    case 'server':
      return 'Erreur serveur pendant la connexion.';
    default:
      return null;
  }
}

function sanitizeRelativePath(value: string | undefined) {
  if (!value) return '/admin';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/admin';
  }
  return trimmed;
}

function canUseRedirectForRole(role: 'ADMIN' | 'ORGANISATEUR' | 'PARTENAIRE' | 'CLIENT', path: string) {
  if (role === 'ADMIN') return path.startsWith('/admin') || path.startsWith('/mnemos') || path.startsWith('/organisme');
  if (role === 'ORGANISATEUR') return path.startsWith('/organisme');
  if (role === 'PARTENAIRE') return path.startsWith('/partenaire');
  return false;
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ redirectTo?: string; error?: string }>;
}) {
  if (process.env.MOCK_UI === '1') {
    return null;
  }

  const { redirectTo, error } = searchParams ? await searchParams : {};
  const safeRedirectTo = sanitizeRelativePath(redirectTo);
  const loginError = mapLoginErrorMessage(error);

  const session = await getSession();
  if (session) {
    if (session.role === 'ADMIN') {
      redirect(canUseRedirectForRole('ADMIN', safeRedirectTo) ? safeRedirectTo : '/admin');
    }
    if (session.role === 'ORGANISATEUR') {
      redirect(canUseRedirectForRole('ORGANISATEUR', safeRedirectTo) ? safeRedirectTo : '/organisme');
    }
    if (session.role === 'PARTENAIRE') {
      redirect(canUseRedirectForRole('PARTENAIRE', safeRedirectTo) ? safeRedirectTo : '/partenaire');
    }
    if (session.role === 'CLIENT') redirect('/');
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Connexion</h1>
        <p className="mt-2 text-sm text-slate-600">
          Accédez aux espaces Resacolo.
        </p>
        {loginError ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {loginError}
          </div>
        ) : null}
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
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              name="rememberMe"
              type="checkbox"
              value="1"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            Se souvenir de moi (7 jours)
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
