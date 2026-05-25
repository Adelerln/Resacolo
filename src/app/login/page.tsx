import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { PasswordInput } from '@/components/auth/PasswordInput';

type LoginMode = 'family' | 'pro';

function mapLoginErrorMessage(code: string | undefined) {
  switch (code) {
    case 'invalid-credentials':
      return 'Identifiants invalides.';
    case 'email-not-confirmed':
      return 'Compte non validé. Vérifiez votre boîte mail et cliquez sur le lien de confirmation.';
    case 'wrong-login-space-family':
      return 'Ce compte n’appartient pas à l’espace Famille. Sélectionnez l’espace Organisateur / Partenaire.';
    case 'wrong-login-space-pro':
      return 'Ce compte n’appartient pas à l’espace Organisateur / Partenaire. Sélectionnez l’espace Famille.';
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

function sanitizeRelativePath(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }
  return trimmed;
}

function canUseRedirectForRole(
  role: 'MNEMOS' | 'ADMIN' | 'ADMIN_SALES' | 'ORGANISATEUR' | 'PARTENAIRE' | 'CLIENT',
  path: string
) {
  if (role === 'MNEMOS') {
    return (
      path.startsWith('/mnemos') ||
      path.startsWith('/admin') ||
      path.startsWith('/organisme') ||
      path.startsWith('/partenaire')
    );
  }
  if (role === 'ADMIN') return path.startsWith('/admin');
  if (role === 'ADMIN_SALES') return path.startsWith('/admin');
  if (role === 'ORGANISATEUR') return path.startsWith('/organisme');
  if (role === 'PARTENAIRE') return path.startsWith('/partenaire');
  return !path.startsWith('/admin') && !path.startsWith('/mnemos') && !path.startsWith('/organisme') && !path.startsWith('/partenaire');
}

function normalizeMode(mode: string | undefined): LoginMode {
  const normalized = (mode ?? '').trim().toLowerCase();
  if (normalized === 'family' || normalized === 'famille' || normalized === 'familles') return 'family';
  if (normalized === 'pro' || normalized === 'organisateur' || normalized === 'partenaire') return 'pro';
  return 'family';
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{
    redirectTo?: string;
    error?: string;
    mode?: string;
    registered?: string;
    reset?: string;
    forceLogin?: string;
  }>;
}) {
  if (process.env.MOCK_UI === '1') {
    return null;
  }

  const { redirectTo, error, mode, registered, reset, forceLogin } = searchParams ? await searchParams : {};
  const effectiveMode = normalizeMode(mode);
  const shouldBypassSessionRedirect = forceLogin === '1';
  const safeRedirectTo = sanitizeRelativePath(
    redirectTo,
    effectiveMode === 'family' ? '/mon-compte' : '/admin'
  );
  const loginError = mapLoginErrorMessage(error);

  if (!shouldBypassSessionRedirect) {
    const session = await getCurrentUser();
    if (session) {
      if (session.role === 'MNEMOS') {
        redirect(canUseRedirectForRole('MNEMOS', safeRedirectTo) ? safeRedirectTo : '/mnemos');
      }
      if (session.role === 'ADMIN') {
        redirect(canUseRedirectForRole('ADMIN', safeRedirectTo) ? safeRedirectTo : '/admin');
      }
      if (session.role === 'ADMIN_SALES') {
        redirect(canUseRedirectForRole('ADMIN_SALES', safeRedirectTo) ? safeRedirectTo : '/admin');
      }
      if (session.role === 'ORGANISATEUR') {
        redirect(canUseRedirectForRole('ORGANISATEUR', safeRedirectTo) ? safeRedirectTo : '/organisme');
      }
      if (session.role === 'PARTENAIRE') {
        redirect(canUseRedirectForRole('PARTENAIRE', safeRedirectTo) ? safeRedirectTo : '/partenaire');
      }
      if (session.role === 'CLIENT') {
        redirect(canUseRedirectForRole('CLIENT', safeRedirectTo) ? safeRedirectTo : '/mon-compte');
      }
    }
  }

  const familyHref = `/login?mode=family&redirectTo=${encodeURIComponent(safeRedirectTo)}`;
  const proHref = `/login?mode=pro&redirectTo=${encodeURIComponent(safeRedirectTo)}`;
  const createAccountHref = `/login/familles/creer-compte?redirectTo=${encodeURIComponent(safeRedirectTo)}`;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Connexion</h1>
        <p className="mt-2 text-sm text-slate-600">Choisissez votre espace puis connectez-vous.</p>

        <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-semibold">
          <Link
            href={familyHref}
            className={`flex items-center justify-center text-center rounded-lg px-3 py-2 transition ${
              effectiveMode === 'family'
                ? 'bg-[#FA8500] text-white shadow-sm hover:text-white'
                : 'text-slate-600 hover:text-slate-600'
            }`}
          >
            Famille
          </Link>
          <Link
            href={proHref}
            className={`flex items-center justify-center text-center rounded-lg px-3 py-2 transition ${
              effectiveMode === 'pro'
                ? 'bg-[var(--color-primary)] text-white shadow-sm hover:text-white'
                : 'text-slate-600 hover:text-slate-600'
            }`}
          >
            Organisateur / Partenaire
          </Link>
        </div>

        {effectiveMode === 'family' ? (
          <p className="mt-4 text-sm text-slate-600">
            Accédez à votre espace
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Accédez à votre espace
          </p>
        )}

        {effectiveMode === 'family' && registered === '1' ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Compte créé. Vérifiez votre boîte mail et validez votre compte via le lien reçu, puis connectez-vous.
          </div>
        ) : null}
        {reset === '1' ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Mot de passe mis à jour. Vous pouvez maintenant vous connecter.
          </div>
        ) : null}

        {loginError ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {loginError}
          </div>
        ) : null}
        <form className="mt-6 space-y-4" action="/api/auth/login" method="post">
          <input type="hidden" name="redirectTo" value={safeRedirectTo} />
          <input type="hidden" name="loginPath" value="/login" />
          <input type="hidden" name="loginMode" value={effectiveMode} />
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
            <PasswordInput
              name="password"
              required
              inputClassName="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 pr-11 text-sm"
            />
          </label>
          <div className="-mt-1 text-right">
            <Link href="/login/mot-de-passe-oublie" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Mot de passe oublié ?
            </Link>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              name="rememberMe"
              type="checkbox"
              value="1"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            Se souvenir de moi
          </label>
          <button
            type="submit"
            className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              effectiveMode === 'family'
                ? 'bg-[#FA8500] hover:bg-[#ef7d00]'
                : 'bg-[var(--color-primary)] hover:bg-[#2b8fcb]'
            }`}
          >
            Se connecter
          </button>
        </form>

        {effectiveMode === 'family' ? (
          <Link
            href={createAccountHref}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-accent-500 px-4 py-2 text-sm font-semibold text-accent-600 hover:bg-accent-50"
          >
            Créer un compte
          </Link>
        ) : null}
      </div>
    </div>
  );
}
