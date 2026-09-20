'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile';

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (errorCode?: string) => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

type TurnstileFieldProps = {
  onTokenChange: (token: string) => void;
  onErrorMessage?: (message: string | null) => void;
  className?: string;
};

function resolveTurnstileSiteKey() {
  const configuredSiteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
  const configuredDevSiteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_DEV ?? '').trim();
  const vercelEnv = (process.env.NEXT_PUBLIC_VERCEL_ENV ?? '').trim().toLowerCase();
  const isPreviewOrDev =
    process.env.NODE_ENV !== 'production' || vercelEnv === 'preview' || vercelEnv === 'development';

  if (typeof window === 'undefined') {
    return configuredSiteKey || (isPreviewOrDev ? TURNSTILE_TEST_SITE_KEY : '');
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isVercelPreviewHost = hostname.endsWith('.vercel.app');
  const isProductionDeployment =
    vercelEnv === 'production' ||
    (vercelEnv === '' && !isLocalhost && !isVercelPreviewHost && process.env.NODE_ENV === 'production');

  if (isProductionDeployment) {
    return configuredSiteKey;
  }

  const previewOrDevKey = configuredDevSiteKey || configuredSiteKey;
  if (previewOrDevKey) {
    return previewOrDevKey;
  }

  if (isLocalhost || isVercelPreviewHost || isPreviewOrDev) {
    return TURNSTILE_TEST_SITE_KEY;
  }

  return configuredSiteKey;
}

export function TurnstileField({ onTokenChange, onErrorMessage, className }: TurnstileFieldProps) {
  const [siteKey, setSiteKey] = useState('');
  const [scriptReady, setScriptReady] = useState(false);
  const [widgetState, setWidgetState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onErrorMessageRef = useRef(onErrorMessage);

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    onErrorMessageRef.current = onErrorMessage;
  }, [onErrorMessage]);

  useEffect(() => {
    setSiteKey(resolveTurnstileSiteKey());
    if (window.turnstile) {
      setScriptReady(true);
    }
  }, []);

  const mountWidget = useCallback(() => {
    if (!siteKey || !widgetContainerRef.current || !window.turnstile) {
      return false;
    }

    if (widgetIdRef.current && window.turnstile.remove) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(widgetContainerRef.current, {
      sitekey: siteKey,
      theme: 'light',
      callback: (token: string) => {
        onTokenChangeRef.current(token);
        setWidgetState('ready');
        onErrorMessageRef.current?.(null);
      },
      'expired-callback': () => {
        onTokenChangeRef.current('');
      },
      'error-callback': (errorCode?: string) => {
        onTokenChangeRef.current('');
        setWidgetState('error');
        if (errorCode === '110200') {
          onErrorMessageRef.current?.(
            'Captcha indisponible (110200) : domaine non autorisé pour cette clé Turnstile. Ajoutez ce domaine dans Cloudflare > Turnstile > Hostname Management.'
          );
          return;
        }
        onErrorMessageRef.current?.(
          `Captcha indisponible (${errorCode ?? 'erreur inconnue'}). Vérifiez votre réseau ou un bloqueur de contenu.`
        );
      }
    });

    setWidgetState('ready');
    return true;
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) {
      setWidgetState('error');
      return;
    }
    if (!scriptReady) {
      setWidgetState('loading');
      return;
    }

    let widgetMounted = false;
    const cleanupWidget = () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };

    const tryMount = () => {
      if (widgetMounted) return true;
      if (mountWidget()) {
        widgetMounted = true;
        return true;
      }
      return false;
    };

    setWidgetState('loading');
    if (tryMount()) {
      return cleanupWidget;
    }

    const retryDelaysMs = [50, 150, 400, 800];
    const timers = retryDelaysMs.map((delayMs) => window.setTimeout(() => tryMount(), delayMs));
    const failTimer = window.setTimeout(() => {
      if (!widgetMounted) {
        setWidgetState('error');
        onErrorMessageRef.current?.(
          'Le captcha n’a pas pu s’afficher. Rechargez la page ou désactivez temporairement votre bloqueur de publicités.'
        );
      }
    }, 2500);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(failTimer);
      cleanupWidget();
    };
  }, [mountWidget, scriptReady, siteKey]);

  const isTestSiteKey = siteKey === TURNSTILE_TEST_SITE_KEY;

  return (
    <div className={className ?? 'rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5'}>
      <Script
        id={TURNSTILE_SCRIPT_ID}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => {
          setWidgetState('error');
          onErrorMessageRef.current?.(
            'Impossible de charger Cloudflare Turnstile. Vérifiez votre connexion réseau ou votre bloqueur de contenu.'
          );
        }}
      />

      {siteKey ? (
        <>
          <p className="mb-3 text-sm text-slate-600">
            Veuillez valider le captcha avant l&apos;envoi du formulaire.
          </p>
          {isTestSiteKey ? (
            <p className="mb-2 text-sm text-amber-800">
              Mode démo Turnstile actif (aucune clé configurée). Ajoutez{' '}
              <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> pour le
              captcha réel en production.
            </p>
          ) : null}
          {widgetState === 'loading' ? (
            <p className="mb-2 text-sm text-slate-500">Chargement du captcha…</p>
          ) : null}
          <div ref={widgetContainerRef} className="min-h-[4.5rem]" />
          {widgetState === 'error' ? (
            <p className="mt-2 text-sm text-red-600">
              Le captcha n&apos;a pas pu s&apos;afficher. Rechargez la page ou contactez-nous par un autre
              canal.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-red-600">
          Captcha indisponible : ajoutez `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (ou
          `NEXT_PUBLIC_TURNSTILE_SITE_KEY_DEV` en preview/dev) dans vos variables d&apos;environnement.
        </p>
      )}
    </div>
  );
}
