'use client';

import { useState } from 'react';

export function ResendConfirmationButton({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onResend() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Envoi impossible pour le moment.');
      }
      setMessage('E-mail renvoyé. Il peut mettre jusqu’à une minute à arriver — vérifiez aussi les spams.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible pour le moment.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onResend}
        disabled={pending || !email}
        className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Envoi…' : 'Renvoyer l’e-mail de confirmation'}
      </button>
      {message ? <p className="text-center text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-center text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
