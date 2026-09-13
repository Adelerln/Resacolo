import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { LoginStepsForm } from '@/components/auth/LoginStepsForm';

type LoginMode = 'family' | 'pro';

function mapLoginErrorMessageProduction(code: string | undefined) {
  switch (code) {
    case 'invalid-credentials':
      return 'Adresse e-mail ou mot de passe incorrect.';
    case 'email-not-confirmed':
      return 'Compte non validé. Vérifiez votre boîte mail et cliquez sur le lien de confirmation.';
    case 'rate-limited':
      return 'Trop de tentatives de connexion. Attendez quelques minutes puis réessayez.';
    case 'wrong-login-space-family':
      return 'Ce compte n’appartient pas à l’espace Famille. Sélectionnez l’espace Organisateur / Partenaire.';
    case 'wrong-login-space-pro':
      return 'Ce compte n’appartient pas à l’espace Organisateur / Partenaire. Sélectionnez l’espace Famille.';
    case 'invalid-input':
      return 'Veuillez vérifier les informations saisies.';
    case 'invalid-email':
      return 'Merci de renseigner une adresse e-mail valide.';
    case 'supabase':
      return 'Connexion momentanément indisponible. Réessayez dans quelques instants.';
    case 'oauth-failed':
      return 'Connexion Google impossible. Réessayez ou utilisez votre e-mail et mot de passe.';
    case 'server':
      return 'Une erreur est survenue lors de la connexion. Réessayez dans quelques instants.';
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
  return (
    !path.startsWith('/admin') &&
    !path.startsWith('/mnemos') &&
    !path.startsWith('/organisme') &&
    !path.startsWith('/partenaire')
  );
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
    magicSent?: string;
    email?: string;
    forceLogin?: string;
  }>;
}) {
  if (process.env.MOCK_UI === '1') {
    return null;
  }

  const { redirectTo, error, mode, registered, reset, magicSent, email, forceLogin } = searchParams
    ? await searchParams
    : {};
  const effectiveMode = normalizeMode(mode);
  const shouldBypassSessionRedirect = forceLogin === '1';
  const safeRedirectTo = sanitizeRelativePath(
    redirectTo,
    effectiveMode === 'family' ? '/mon-compte' : '/organisme'
  );
  const loginError = mapLoginErrorMessageProduction(error);

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

        <p className="mt-4 text-sm text-slate-600">Accédez à votre espace</p>

        {effectiveMode === 'family' && registered === '1' ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Compte créé. Vous pouvez vous connecter.
          </div>
        ) : null}
        {reset === '1' ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Mot de passe mis à jour. Vous pouvez maintenant vous connecter.
          </div>
        ) : null}
        {magicSent === '1' ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Si un compte existe avec cet e-mail, un lien de connexion vient d’être envoyé. Vérifiez votre
            boîte mail.
          </div>
        ) : null}

        {loginError ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 whitespace-pre-wrap">
            {loginError}
          </div>
        ) : null}

        <LoginStepsForm
          mode={effectiveMode}
          redirectTo={safeRedirectTo}
          createAccountHref={effectiveMode === 'family' ? createAccountHref : undefined}
          initialEmail={typeof email === 'string' ? email : ''}
          magicSent={magicSent === '1'}
        />
      </div>
    </div>
  );
}
