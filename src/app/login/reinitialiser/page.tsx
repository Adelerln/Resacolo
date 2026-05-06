'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  PASSWORD_POLICY_HTML_PATTERN,
  PASSWORD_POLICY_MESSAGE,
  isPasswordPolicyValid
} from '@/lib/auth/password-policy';
import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

type RecoveryState = 'loading' | 'ready' | 'invalid-link';

export default function ResetPasswordPage() {
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => recoveryState === 'ready' && !isSubmitting && password.length > 0 && confirmPassword.length > 0,
    [recoveryState, isSubmitting, password, confirmPassword]
  );

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');

    if (!accessToken || !refreshToken || type !== 'recovery') {
      setRecoveryState('invalid-link');
      return;
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setRecoveryState('invalid-link');
          return;
        }
        setRecoveryState('ready');
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      })
      .catch(() => setRecoveryState('invalid-link'));
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!isPasswordPolicyValid(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || 'Impossible de mettre à jour le mot de passe.');
        return;
      }
      setSuccess(true);
      await supabase.auth.signOut();
      window.setTimeout(() => {
        window.location.assign('/login?reset=1');
      }, 800);
    } catch {
      setError('Erreur serveur. Réessayez dans quelques instants.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Réinitialiser le mot de passe</h1>

        {recoveryState === 'loading' ? (
          <p className="mt-4 text-sm text-slate-600">Vérification du lien en cours…</p>
        ) : null}

        {recoveryState === 'invalid-link' ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Lien invalide ou expiré. Demandez un nouveau lien de réinitialisation.
          </div>
        ) : null}

        {recoveryState === 'ready' ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Mot de passe mis à jour. Redirection vers la connexion…
              </div>
            ) : null}
            <label className="block text-sm font-medium text-slate-700">
              Nouveau mot de passe
              <PasswordInput
                name="password"
                required
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                pattern={PASSWORD_POLICY_HTML_PATTERN}
                title={PASSWORD_POLICY_MESSAGE}
                autoComplete="new-password"
                inputClassName="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 pr-11 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Confirmer le mot de passe
              <PasswordInput
                name="confirmPassword"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                autoComplete="new-password"
                inputClassName="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 pr-11 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2b8fcb] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Mettre à jour le mot de passe
            </button>
          </form>
        ) : null}

        <Link href="/login/mot-de-passe-oublie" className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Demander un nouveau lien
        </Link>
      </div>
    </div>
  );
}

