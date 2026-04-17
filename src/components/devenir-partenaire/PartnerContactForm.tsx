'use client';

import { FormEvent, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ORANGE = '#FA8500';
const BLUE = '#52B0EA';

const FORMULES = ['Formule Sérénité', 'Formule Identité'] as const;
type Formule = (typeof FORMULES)[number] | '';

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

function parseApiErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return null;
}

export function PartnerContactForm() {
  const [institution, setInstitution] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [formule, setFormule] = useState<Formule>('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setStatus('loading');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/partner-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution,
          name,
          email,
          formula: formule,
          message
        })
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(parseApiErrorMessage(payload) ?? 'Impossible d’envoyer la demande pour le moment.');
        return;
      }

      setStatus('success');
      setInstitution('');
      setName('');
      setEmail('');
      setFormule('');
      setMessage('');
    } catch {
      setStatus('error');
      setErrorMessage('Impossible d’envoyer la demande pour le moment.');
    }
  };

  return (
    <section id="demande-partenariat" className="section-container pb-20 pt-16 md:pt-20">
      <div className="rounded-[32px] bg-slate-50 p-6 sm:p-8 lg:p-10">
        <h2 className="text-center font-display text-3xl font-bold leading-tight text-slate-800 sm:text-5xl">
          Demande de <span style={{ color: BLUE }}>partenariat</span>
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center font-medium leading-relaxed text-slate-600">
          Vous êtes une collectivité ou un comité d&apos;entreprise et vous portez un intérêt particulier à RESACOLO ?
          Nous serions ravis d&apos;envisager un partenariat avec votre institution.
        </p>

        <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-5xl space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">1. Institution*</label>
              <input
                required
                type="text"
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 shadow-sm outline-none transition focus:border-brand-600"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">2. Nom*</label>
              <input
                required
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 shadow-sm outline-none transition focus:border-brand-600"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">3. Email*</label>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 shadow-sm outline-none transition focus:border-brand-600"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">4. Formule CSE*</label>
              <div className="relative">
                <select
                  required
                  value={formule}
                  onChange={(event) => setFormule(event.target.value as Formule)}
                  className="h-12 w-full appearance-none rounded-2xl border border-slate-300 bg-white px-4 pr-10 text-slate-500 shadow-sm outline-none transition focus:border-brand-600"
                >
                  <option value="">—Veuillez choisir une option—</option>
                  {FORMULES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">5. Message*</label>
            <textarea
              required
              rows={7}
              placeholder="Message*"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white p-4 shadow-sm outline-none transition focus:border-brand-600"
            />
          </div>

          {errorMessage && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</p>}
          {status === 'success' && (
            <p className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
              Merci, votre demande de partenariat a bien été envoyée.
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">* obligatoire</p>
            <button
              type="submit"
              disabled={status === 'loading'}
              className="cta-orange-sweep rounded-full px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-70"
              style={{ backgroundColor: ORANGE }}
            >
              {status === 'loading' ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
