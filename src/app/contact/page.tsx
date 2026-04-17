'use client';

import Script from 'next/script';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { User, Headset, ChevronDown } from 'lucide-react';

const BLUE = '#52B0EA';
const ORANGE = '#FA8500';

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
  const isNonProduction = process.env.NODE_ENV !== 'production';

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
    if (isNonProduction && isLocalhost) {
      setSiteKey(TURNSTILE_TEST_SITE_KEY);
      return;
    }
    setSiteKey(configuredSiteKey);
  }, [configuredSiteKey, isNonProduction]);

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

  const inputClass =
    'w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200';

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

      {/* Section 1: Header */}
      <section
        className="border-b border-slate-100 px-4 py-12 sm:px-6 md:py-20"
        style={{ backgroundColor: '#F8F8F8' }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
          <div className="flex-1 lg:max-w-[60%]">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Assistance
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Contactez-<span style={{ color: ORANGE }}>nous</span>
            </h1>
            <p className="mt-6 max-w-xl leading-relaxed text-slate-600">
              Pour toute question ou précision sur une colonie de vacances ou un séjour, vous pouvez
              solliciter directement son organisateur.
            </p>
          </div>
          <div className="flex flex-shrink-0 justify-center gap-6 sm:gap-8 lg:max-w-[40%]">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-md sm:h-32 sm:w-32">
              <User className="h-10 w-10 sm:h-12 sm:w-12" style={{ color: ORANGE }} />
              <span
                className="absolute -right-0.5 -top-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
                style={{ backgroundColor: ORANGE, color: 'white' }}
                aria-hidden
              >
                ?
              </span>
            </div>
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-md sm:h-32 sm:w-32">
              <Headset className="h-10 w-10 sm:h-12 sm:w-12" style={{ color: ORANGE }} />
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Contact Form */}
      <section className="px-4 py-12 sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-center font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              <span style={{ color: BLUE }}>Formulaire</span> de contact
            </h2>
            <p className="mt-4 text-center text-slate-600 text-sm leading-relaxed">
              Vous souhaitez contacter un organisateur ou joindre notre assistance technique.
              Complétez les champs ci-dessous et envoyez votre demande. Nous vous répondrons dans
              les plus brefs délais.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-8">
              {/* Step 1: Recipient */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  1. Choisissez un destinataire *
                </label>
                <div className="relative">
                  <select
                    required
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className={`${inputClass} appearance-none pr-10`}
                  >
                    <option value="">Sélectionner un destinataire</option>
                    {organizers.map((organizer) => (
                      <option key={organizer.id} value={`organizer:${organizer.id}`}>
                        {organizer.name}
                      </option>
                    ))}
                    <option value="assistance">ASSISTANCE TECHNIQUE RESACOLO</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                </div>
                {isLoadingOrganizers && (
                  <p className="mt-2 text-xs text-slate-500">Chargement des organisateurs...</p>
                )}
                {!isLoadingOrganizers && organizers.length === 0 && !organizersLoadError && (
                  <p className="mt-2 text-xs text-slate-500">
                    Aucun organisateur disponible pour le moment.
                  </p>
                )}
                {organizersLoadError && (
                  <p className="mt-2 text-xs text-amber-700">{organizersLoadError}</p>
                )}
              </div>

              {/* Step 2: Personal Info */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  2. Renseignez vos informations *
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    required
                    placeholder="Prénom*"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Nom*"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email*"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="tel"
                    placeholder="Téléphone (facultatif)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Step 3: Message */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  3. Rédigez votre message *
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Précisez votre demande : nom du séjour, saison, date de départ..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`${inputClass} min-h-[120px] resize-y`}
                />
              </div>

              {/* Captcha */}
              <div>
                <div className="max-w-md rounded-xl border border-slate-200 bg-white p-4">
                  {siteKey ? (
                    <>
                      <p className="mb-3 text-sm text-slate-600">
                        Veuillez valider le captcha avant l&apos;envoi du formulaire.
                      </p>
                      <div ref={widgetContainerRef} />
                    </>
                  ) : (
                    <p className="text-sm text-red-600">
                      Captcha indisponible : ajoutez `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dans vos variables
                      d&apos;environnement.
                    </p>
                  )}
                </div>
              </div>

              {errorMessage && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
              )}
              {status === 'success' && (
                <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                  Merci ! Votre message a bien été envoyé.
                </p>
              )}

              {/* Footer Action */}
              <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">* obligatoire</p>
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="cta-orange-sweep w-full rounded-xl px-8 py-4 font-semibold uppercase tracking-wide text-white shadow-md transition disabled:opacity-70 sm:w-auto"
                  style={{ backgroundColor: ORANGE }}
                >
                  {status === 'loading' ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
