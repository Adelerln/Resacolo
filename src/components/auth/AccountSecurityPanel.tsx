'use client';

import { useState } from 'react';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  PASSWORD_POLICY_HTML_PATTERN,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_MIN_LENGTH
} from '@/lib/auth/password-policy';

type AccountSecurityPanelProps = {
  currentEmail: string;
  className?: string;
};

export function AccountSecurityPanel({ currentEmail, className }: AccountSecurityPanelProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);

  const [email, setEmail] = useState(currentEmail);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState(false);

  async function onChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordPending(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password, confirmPassword })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setPasswordError(data.error || 'Impossible de modifier le mot de passe.');
        return;
      }
      setPassword('');
      setConfirmPassword('');
      setPasswordMessage('Mot de passe mis à jour.');
    } catch {
      setPasswordError('Erreur réseau. Réessayez.');
    } finally {
      setPasswordPending(false);
    }
  }

  async function onChangeEmail(event: React.FormEvent) {
    event.preventDefault();
    setEmailError(null);
    setEmailMessage(null);
    setEmailPending(true);
    try {
      const response = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        setEmailError(data.error || 'Impossible de modifier l’e-mail.');
        return;
      }
      setEmailMessage(data.message || 'E-mail de confirmation envoyé.');
    } catch {
      setEmailError('Erreur réseau. Réessayez.');
    } finally {
      setEmailPending(false);
    }
  }

  return (
    <section className={className ?? 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'}>
      <h2 className="font-display text-lg font-semibold text-slate-900">Sécurité du compte</h2>
      <p className="mt-1 text-sm text-slate-600">
        Modifiez votre mot de passe ou votre adresse e-mail de connexion.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={onChangePassword} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Modifier le mot de passe</h3>
          {passwordError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {passwordError}
            </p>
          ) : null}
          {passwordMessage ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {passwordMessage}
            </p>
          ) : null}
          <label className="block text-sm font-medium text-slate-700">
            Nouveau mot de passe
            <PasswordInput
              name="password"
              required
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              minLength={PASSWORD_POLICY_MIN_LENGTH}
              pattern={PASSWORD_POLICY_HTML_PATTERN}
              title={PASSWORD_POLICY_MESSAGE}
              autoComplete="new-password"
              inputClassName="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-11 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Confirmer
            <PasswordInput
              name="confirmPassword"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              autoComplete="new-password"
              inputClassName="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-11 text-sm"
            />
          </label>
          <p className="text-xs text-slate-500">{PASSWORD_POLICY_MESSAGE}</p>
          <button
            type="submit"
            disabled={passwordPending}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2b8fcb] disabled:opacity-60"
          >
            {passwordPending ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </button>
        </form>

        <form onSubmit={onChangeEmail} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Modifier l’e-mail</h3>
          {emailError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {emailError}
            </p>
          ) : null}
          {emailMessage ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {emailMessage}
            </p>
          ) : null}
          <label className="block text-sm font-medium text-slate-700">
            Nouvelle adresse e-mail
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-slate-500">
            Un e-mail de confirmation sera envoyé à la nouvelle adresse avant de finaliser le changement.
          </p>
          <button
            type="submit"
            disabled={emailPending}
            className="rounded-lg bg-[#FA8500] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ef7d00] disabled:opacity-60"
          >
            {emailPending ? 'Envoi…' : 'Envoyer la confirmation'}
          </button>
        </form>
      </div>
    </section>
  );
}
