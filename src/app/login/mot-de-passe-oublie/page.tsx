import Link from 'next/link';

function mapErrorMessage(code: string | undefined) {
  switch (code) {
    case 'invalid-email':
      return 'Merci de renseigner une adresse email valide.';
    case 'send-failed':
      return "Impossible d'envoyer l'email de réinitialisation pour le moment.";
    case 'server':
      return 'Erreur serveur. Réessayez dans quelques instants.';
    default:
      return null;
  }
}

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = searchParams ? await searchParams : {};
  const errorMessage = mapErrorMessage(error);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Mot de passe oublié</h1>
        <p className="mt-2 text-sm text-slate-600">
          Saisissez votre email. Vous recevrez un lien pour définir un nouveau mot de passe.
        </p>

        {sent === '1' ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" action="/api/auth/forgot-password" method="post">
          <input type="hidden" name="returnPath" value="/login/mot-de-passe-oublie" />
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <button type="submit" className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2b8fcb]">
            Envoyer le lien de réinitialisation
          </button>
        </form>

        <Link href="/login" className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}

