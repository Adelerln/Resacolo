'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { PasswordInput } from '@/components/auth/PasswordInput';

type LoginMode = 'family' | 'pro';
type Step = 'email' | 'method';
type Method = 'choice' | 'password' | 'magic';

type LoginStepsFormProps = {
  mode: LoginMode;
  redirectTo: string;
  createAccountHref?: string;
  initialEmail?: string;
  magicSent?: boolean;
};

export function LoginStepsForm({
  mode,
  redirectTo,
  createAccountHref,
  initialEmail = '',
  magicSent = false
}: LoginStepsFormProps) {
  const [step, setStep] = useState<Step>(magicSent && initialEmail ? 'method' : 'email');
  const [method, setMethod] = useState<Method>(magicSent ? 'magic' : 'choice');
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);

  const isFamily = mode === 'family';
  const primaryButtonClass = isFamily
    ? 'bg-[#FA8500] hover:bg-[#ef7d00]'
    : 'bg-[var(--color-primary)] hover:bg-[#2b8fcb]';
  const outlineButtonClass = isFamily
    ? 'border-[#FA8500] text-[#FA8500] hover:bg-orange-50'
    : 'border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-sky-50';

  const forgotPasswordHref = useMemo(() => {
    const params = new URLSearchParams();
    if (email.trim()) params.set('email', email.trim());
    const query = params.toString();
    return query ? `/login/mot-de-passe-oublie?${query}` : '/login/mot-de-passe-oublie';
  }, [email]);

  function goToMethod(event: React.FormEvent) {
    event.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail || !/.+@.+\..+/.test(nextEmail)) {
      setEmailError('Merci de renseigner une adresse e-mail valide.');
      return;
    }
    setEmailError(null);
    setEmail(nextEmail);
    setMethod('choice');
    setStep('method');
  }

  function backToEmail() {
    setStep('email');
    setMethod('choice');
  }

  return (
    <div className="mt-6">
      {step === 'email' ? (
        <div className="space-y-4">
          {isFamily ? (
            <>
              <GoogleSignInButton redirectTo={redirectTo} loginMode="family" />
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">ou</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          ) : null}

          <form className="space-y-4" onSubmit={goToMethod}>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.currentTarget.value);
                  if (emailError) setEmailError(null);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </label>
            {emailError ? <p className="text-sm text-rose-600">{emailError}</p> : null}
            <button
              type="submit"
              className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${primaryButtonClass}`}
            >
              Continuer
            </button>
          </form>

          {isFamily && createAccountHref ? (
            <Link
              href={createAccountHref}
              className="inline-flex w-full items-center justify-center rounded-lg border border-accent-500 px-4 py-2 text-sm font-semibold text-accent-600 hover:bg-accent-50"
            >
              Créer un compte
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={backToEmail}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Changer d’e-mail
          </button>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Connexion avec <span className="font-semibold text-slate-900">{email}</span>
          </div>

          {method === 'choice' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Comment souhaitez-vous vous connecter ?</p>
              <button
                type="button"
                onClick={() => setMethod('magic')}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${outlineButtonClass} bg-white`}
              >
                <Mail className="h-5 w-5 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold">Recevoir un lien par e-mail</span>
                  <span className="mt-0.5 block text-xs opacity-80">
                    Connexion en un clic, sans mot de passe
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMethod('password')}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800 transition hover:bg-slate-50"
              >
                <KeyRound className="h-5 w-5 shrink-0 text-slate-500" />
                <span>
                  <span className="block text-sm font-semibold">Utiliser mon mot de passe</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Connexion classique avec votre mot de passe
                  </span>
                </span>
              </button>
            </div>
          ) : null}

          {method === 'magic' ? (
            <form className="space-y-4" action="/api/auth/magic-link" method="post">
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input type="hidden" name="returnPath" value="/login" />
              <input type="hidden" name="loginMode" value={mode} />
              <p className="text-sm text-slate-600">
                Nous allons vous envoyer un lien magique à <span className="font-medium">{email}</span>.
              </p>
              <button
                type="submit"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm font-semibold ${outlineButtonClass}`}
              >
                Envoyer le lien de connexion
              </button>
              <button
                type="button"
                onClick={() => setMethod('choice')}
                className="w-full text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Autre méthode
              </button>
            </form>
          ) : null}

          {method === 'password' ? (
            <form className="space-y-4" action="/api/auth/login" method="post">
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input type="hidden" name="loginPath" value="/login" />
              <input type="hidden" name="loginMode" value={mode} />
              <label className="block text-sm font-medium text-slate-700">
                Mot de passe
                <PasswordInput
                  name="password"
                  required
                  autoComplete="current-password"
                  inputClassName="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 pr-11 text-sm"
                />
              </label>
              <div className="-mt-1 text-right">
                <Link href={forgotPasswordHref} className="text-xs font-medium text-brand-600 hover:text-brand-700">
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
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${primaryButtonClass}`}
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => setMethod('choice')}
                className="w-full text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Autre méthode
              </button>
            </form>
          ) : null}

          {isFamily && createAccountHref ? (
            <Link
              href={createAccountHref}
              className="inline-flex w-full items-center justify-center rounded-lg border border-accent-500 px-4 py-2 text-sm font-semibold text-accent-600 hover:bg-accent-50"
            >
              Créer un compte
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
