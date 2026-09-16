'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  createCookieConsentPreferences,
  hasAnalyticsConsent,
  readCookieConsentPreferences,
  writeCookieConsentPreferences,
  type CookieConsentPreferences
} from '@/lib/cookie-consent';

type BannerMode = 'hidden' | 'prompt' | 'settings';

export function CookieConsentBanner() {
  const [mode, setMode] = useState<BannerMode>('hidden');
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const existing = readCookieConsentPreferences();
    if (existing) {
      setAnalyticsEnabled(hasAnalyticsConsent(existing));
      setMode('hidden');
      return;
    }
    setMode('prompt');
  }, []);

  useEffect(() => {
    const openSettings = () => {
      const existing = readCookieConsentPreferences();
      setAnalyticsEnabled(hasAnalyticsConsent(existing));
      setMode('settings');
    };
    window.addEventListener('resacolo:open-cookie-settings', openSettings);
    return () => window.removeEventListener('resacolo:open-cookie-settings', openSettings);
  }, []);

  function persist(preferences: CookieConsentPreferences) {
    writeCookieConsentPreferences(preferences);
    setAnalyticsEnabled(preferences.analytics);
    setMode('hidden');
  }

  function acceptAll() {
    persist(createCookieConsentPreferences({ analytics: true }));
  }

  function refuseOptional() {
    persist(createCookieConsentPreferences({ analytics: false }));
  }

  function saveSettings() {
    persist(createCookieConsentPreferences({ analytics: analyticsEnabled }));
  }

  if (mode === 'hidden') return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] sm:p-5">
        <p
          id="cookie-consent-title"
          className="font-display text-lg font-bold text-slate-900 sm:text-xl"
        >
          Cookies
        </p>
        <p id="cookie-consent-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
          Resacolo utilise des cookies nécessaires au fonctionnement du site (connexion, panier,
          sécurité). Avec votre accord, nous pouvons aussi déposer des cookies de mesure
          d&apos;audience / performance pour améliorer le service. Consultez notre{' '}
          <Link href="/confidentialite" className="font-semibold text-sky-700 underline-offset-2 hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>

        {mode === 'settings' ? (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <span className="font-semibold text-slate-900">Nécessaires</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Toujours actifs — session, panier, préférences techniques.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#f48200] focus:ring-[#f48200]"
              />
              <span>
                <span className="font-semibold text-slate-900">Mesure d&apos;audience / performance</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Statistiques de navigation et indicateurs de performance (Web Vitals).
                </span>
              </span>
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {mode === 'prompt' ? (
            <>
              <button
                type="button"
                onClick={() => setMode('settings')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Personnaliser
              </button>
              <button
                type="button"
                onClick={refuseOptional}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Refuser
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-xl bg-[#f48200] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e07500]"
              >
                Tout accepter
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={refuseOptional}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Tout refuser
              </button>
              <button
                type="button"
                onClick={saveSettings}
                className="rounded-xl bg-[#f48200] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e07500]"
              >
                Enregistrer mes choix
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function openCookieConsentSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('resacolo:open-cookie-settings'));
}
