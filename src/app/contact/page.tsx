'use client';

import Image from 'next/image';
import Script from 'next/script';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CONTACT_COLORS, CONTACT_HERO_VISUAL } from './contact-data';

type OrganizerRecipient = {
  id: string;
  name: string;
};

const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

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

function parseApiErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return null;
}

export default function ContactPage() {
  const configuredSiteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
  const configuredDevSiteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_DEV ?? '').trim();
  const vercelEnv = (process.env.NEXT_PUBLIC_VERCEL_ENV ?? '').trim().toLowerCase();
  const isPreviewOrDev =
    process.env.NODE_ENV !== 'production' || vercelEnv === 'preview' || vercelEnv === 'development';

  const [recipient, setRecipient] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [organizers, setOrganizers] = useState<OrganizerRecipient[]>([]);
  const [isLoadingOrganizers, setIsLoadingOrganizers] = useState(true);
  const [organizersLoadError, setOrganizersLoadError] = useState<string | null>(null);

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isVercelPreviewHost = window.location.hostname.endsWith('.vercel.app');
    const usePreviewConfig = isPreviewOrDev || isVercelPreviewHost;
    if (usePreviewConfig && isLocalhost) {
      setSiteKey(TURNSTILE_TEST_SITE_KEY);
      return;
    }
    if (usePreviewConfig) {
      setSiteKey(configuredDevSiteKey || configuredSiteKey);
      return;
    }
    setSiteKey(configuredSiteKey);
  }, [configuredDevSiteKey, configuredSiteKey, isPreviewOrDev]);

  const renderTurnstile = useCallback(() => {
    if (!siteKey || !widgetContainerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(widgetContainerRef.current, {
      sitekey: siteKey,
      theme: 'light',
      callback: (token: string) => {
        setTurnstileToken(token);
        setErrorMessage(null);
      },
      'expired-callback': () => {
        setTurnstileToken('');
      },
      'error-callback': (errorCode?: string) => {
        setTurnstileToken('');
        if (errorCode === '110200') {
          setErrorMessage(
            'Captcha indisponible (110200) : domaine non autorisé pour cette clé Turnstile. Ajoutez ce domaine dans Cloudflare > Turnstile > Hostname Management.'
          );
          return;
        }
        setErrorMessage(
          `Captcha indisponible (${errorCode ?? 'erreur inconnue'}). Vérifiez votre réseau ou un bloqueur de contenu.`
        );
      }
    });
  }, [siteKey]);

  useEffect(() => {
    renderTurnstile();
    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [renderTurnstile]);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken('');
    if (widgetIdRef.current && window.turnstile?.reset) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadOrganizers = async () => {
      try {
        const response = await fetch('/api/organizers/options', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error('Impossible de charger les organisateurs.');
        }

        const payload = (await response.json()) as {
          organizers?: OrganizerRecipient[];
        };

        if (!isMounted) return;
        setOrganizers(
          Array.isArray(payload.organizers)
            ? payload.organizers.filter(
                (organizer): organizer is OrganizerRecipient =>
                  Boolean(organizer?.id) && typeof organizer.name === 'string'
              )
            : []
        );
      } catch {
        if (!isMounted) return;
        setOrganizersLoadError('La liste des organisateurs est momentanément indisponible.');
      } finally {
        if (isMounted) {
          setIsLoadingOrganizers(false);
        }
      }
    };

    loadOrganizers();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!siteKey) {
      setStatus('error');
      setErrorMessage('Captcha indisponible : la clé publique Turnstile est manquante.');
      return;
    }

    if (!turnstileToken) {
      setStatus('error');
      setErrorMessage('Merci de valider le captcha avant l’envoi.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient,
          firstName,
          lastName,
          email,
          phone,
          message,
          turnstileToken
        })
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus('error');
        setErrorMessage(parseApiErrorMessage(payload) ?? "L'envoi a échoué. Veuillez réessayer.");
        resetTurnstile();
        return;
      }

      setStatus('success');
      setRecipient('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setMessage('');
      resetTurnstile();
    } catch {
      setStatus('error');
      setErrorMessage('L\'envoi a échoué. Veuillez réessayer.');
      resetTurnstile();
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderTurnstile}
        onError={() => {
          setErrorMessage(
            'Impossible de charger Cloudflare Turnstile. Vérifiez votre connexion réseau ou votre bloqueur de contenu.'
          );
        }}
      />

      <section className="relative overflow-hidden border-b border-slate-100 bg-[#F7F7F7] px-4 py-12 sm:px-6 lg:py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Assistance</p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-[#505050] sm:text-5xl lg:text-6xl">
              Contactez-<span style={{ color: CONTACT_COLORS.orange }}>nous</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#636363] sm:text-lg">
              Pour toute question ou précision sur une colonie de vacances ou un séjour, vous pouvez solliciter
              directement son organisateur.
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-[28rem] lg:max-w-[30rem]">
            <Image
              src={CONTACT_HERO_VISUAL.src}
              alt={CONTACT_HERO_VISUAL.alt}
              width={CONTACT_HERO_VISUAL.width}
              height={CONTACT_HERO_VISUAL.height}
              unoptimized
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-3xl rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)] sm:p-10">
          <h2 className="text-center font-display text-4xl font-bold leading-tight text-[#505050] sm:text-[3.2rem]">
            <span style={{ color: CONTACT_COLORS.blue }}>Formulaire </span>de contact
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-[#636363] sm:text-base">
            Vous souhaitez contacter un organisateur ou joindre notre assistance technique.
            <br />
            Complétez les champs ci-dessous et envoyez votre demande.
            <br />
            Nous vous répondrons dans les plus brefs délais.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-8">
            <div>
              <p className="contact-step-title">1. Choisissez un destinataire *</p>
              <div className="relative mt-2">
                <label htmlFor="contact-recipient" className="sr-only">
                  Destinataire
                </label>
                <select
                  id="contact-recipient"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="contact-input appearance-none pr-12"
                >
                  <option value="">Sélectionner un destinataire</option>
                  {organizers.map((organizer) => (
                    <option key={organizer.id} value={`organizer:${organizer.id}`}>
                      {organizer.name}
                    </option>
                  ))}
                  <option value="assistance">ASSISTANCE TECHNIQUE RESACOLO</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              </div>
              {isLoadingOrganizers && <p className="mt-2 text-xs text-slate-500">Chargement des organisateurs...</p>}
              {!isLoadingOrganizers && organizers.length === 0 && !organizersLoadError && (
                <p className="mt-2 text-xs text-slate-500">Aucun organisateur disponible pour le moment.</p>
              )}
              {organizersLoadError && <p className="mt-2 text-xs text-amber-700">{organizersLoadError}</p>}
            </div>

            <div>
              <p className="contact-step-title">2. Renseignez vos informations *</p>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-first-name" className="sr-only">
                    Prénom
                  </label>
                  <input
                    id="contact-first-name"
                    type="text"
                    required
                    placeholder="Prénom*"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="contact-input"
                  />
                </div>
                <div>
                  <label htmlFor="contact-last-name" className="sr-only">
                    Nom
                  </label>
                  <input
                    id="contact-last-name"
                    type="text"
                    required
                    placeholder="Nom*"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="contact-input"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="sr-only">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    placeholder="Email*"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="contact-input"
                  />
                </div>
                <div>
                  <label htmlFor="contact-phone" className="sr-only">
                    Téléphone
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    placeholder="Téléphone (facultatif)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="contact-input"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="contact-step-title">3. Rédigez votre message *</p>

              <div className="mt-2">
                <label htmlFor="contact-message" className="sr-only">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={6}
                  placeholder="Précisez votre demande : nom du séjour, saison, date de départ..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="contact-input min-h-[9.5rem] resize-y"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              {siteKey ? (
                <>
                  <p className="mb-3 text-sm text-slate-600">Veuillez valider le captcha avant l&apos;envoi du formulaire.</p>
                  <div ref={widgetContainerRef} />
                </>
              ) : (
                <p className="text-sm text-red-600">
                  Captcha indisponible : ajoutez `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (ou `NEXT_PUBLIC_TURNSTILE_SITE_KEY_DEV`
                  en preview/dev) dans vos variables d&apos;environnement.
                </p>
              )}
            </div>

            {errorMessage && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>}
            {status === 'success' && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Merci ! Votre message a bien été envoyé.</p>
            )}

            <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">* obligatoire</p>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="cta-orange-sweep w-full rounded-xl px-8 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-md transition disabled:opacity-70 sm:w-auto"
                style={{ backgroundColor: CONTACT_COLORS.orange }}
              >
                {status === 'loading' ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </form>
        </div>
      </section>

    </div>
  );
}
