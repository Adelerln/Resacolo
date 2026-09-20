'use client';

import { useState } from 'react';
import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

/** Remettre à `true` quand Facebook Login est approuvé / prêt en prod. */
const FACEBOOK_LOGIN_ENABLED = false;

type FacebookSignInButtonProps = {
  redirectTo?: string;
  loginMode?: 'family' | 'pro';
  label?: string;
  className?: string;
  /** Affiche uniquement le logo (pour une rangée côte à côte). */
  iconOnly?: boolean;
};

function sanitizeRelativePath(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  return trimmed;
}

export function FacebookSignInButton({
  redirectTo,
  loginMode = 'family',
  label = 'Continuer avec Facebook',
  className,
  iconOnly = false
}: FacebookSignInButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!FACEBOOK_LOGIN_ENABLED) {
    return null;
  }

  async function handleClick() {
    setPending(true);
    setError(null);

    try {
      const supabase = getBrowserSupabaseClient();
      const safeNext = sanitizeRelativePath(
        redirectTo,
        loginMode === 'family' ? '/mon-compte' : '/admin'
      );
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('next', safeNext);
      callback.searchParams.set('loginMode', loginMode);

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: callback.toString(),
          scopes: 'email,public_profile'
        }
      });

      if (oauthError) {
        setError(oauthError.message || 'Connexion Facebook impossible.');
        setPending(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion Facebook impossible.');
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label={label}
        title={label}
        className={
          className ??
          (iconOnly
            ? 'inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#1877F2] text-white shadow-sm transition hover:bg-[#166fe5] disabled:cursor-not-allowed disabled:opacity-60'
            : 'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#166fe5] disabled:cursor-not-allowed disabled:opacity-60')
        }
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.4V9.84c0-2.37 1.4-3.69 3.56-3.69 1.03 0 2.12.19 2.12.19v2.34h-1.2c-1.18 0-1.55.74-1.55 1.49v1.79h2.64l-.42 2.91h-2.22V22c4.78-.75 8.44-4.91 8.44-9.93z" />
        </svg>
        {iconOnly ? null : pending ? 'Redirection…' : label}
      </button>
      {error ? <p className="text-center text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
