import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { ResendConfirmationButton } from '@/components/auth/ResendConfirmationButton';

export const metadata = {
  title: 'Confirmez votre e-mail | Resacolo'
};

function sanitizeRelativePath(value: string | undefined) {
  if (!value) return '/mon-compte';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/mon-compte';
  return trimmed;
}

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams?: Promise<{ email?: string; redirectTo?: string; mailWarning?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const email = (params.email ?? '').trim();
  const mailWarning = params.mailWarning === '1';
  const loginHref = `/login/familles?redirectTo=${encodeURIComponent(sanitizeRelativePath(params.redirectTo))}`;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <MailCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-center text-2xl font-semibold text-slate-900">
          Vérifiez votre boîte mail
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
          Votre compte a bien été créé.
          {email ? (
            <>
              {' '}
              Un e-mail de confirmation a été envoyé à{' '}
              <span className="font-semibold text-slate-800">{email}</span>.
            </>
          ) : (
            <> Un e-mail de confirmation vient de vous être envoyé.</>
          )}
        </p>
        {mailWarning ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
            L’envoi automatique a rencontré un problème (souvent une limite anti-spam). Attendez une
            minute puis cliquez sur « Renvoyer l’e-mail de confirmation ».
          </p>
        ) : null}
        <p className="mt-3 text-center text-sm text-slate-600">
          Cliquez sur le lien dans le message pour activer votre compte, puis connectez-vous.
        </p>
        <ul className="mt-5 space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <li>Pensez à vérifier vos spams / courriers indésirables.</li>
          <li>Le lien est valable 24 heures.</li>
        </ul>
        <div className="mt-6 space-y-3">
          <Link
            href={loginHref}
            className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#FA8500] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ef7d00]"
          >
            Aller à la connexion
          </Link>
          {email ? <ResendConfirmationButton email={email} /> : null}
          <Link
            href="/"
            className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
