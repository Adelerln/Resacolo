'use client';

import { FormEvent, useState } from 'react';
import { Mail } from 'lucide-react';

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

function parseApiErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return null;
}

export function OrganizerJoinForm() {
  const [organizationName, setOrganizationName] = useState('');
  const [atoutFrance, setAtoutFrance] = useState('');
  const [sdjes, setSdjes] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/organizer-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName,
          atoutFrance,
          sdjes,
          websiteUrl,
          lastName,
          firstName,
          email,
          phone,
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
      setOrganizationName('');
      setAtoutFrance('');
      setSdjes('');
      setWebsiteUrl('');
      setLastName('');
      setFirstName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch {
      setStatus('error');
      setErrorMessage('Impossible d’envoyer la demande pour le moment.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Nom de l&apos;organisme *
          </label>
          <input
            required
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Numéro Atout France (IM + 9 chiffres) *
          </label>
          <input
            required
            value={atoutFrance}
            onChange={(event) => setAtoutFrance(event.target.value)}
            placeholder="Ex. : IM012345678"
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Numéro SDJES (format XXXORGXXXX) *
          </label>
          <input
            required
            value={sdjes}
            onChange={(event) => setSdjes(event.target.value.toUpperCase())}
            placeholder="Ex. : 123ORG4567"
            pattern="^[0-9]{3}ORG[0-9]{4}$"
            title="Format attendu : 123ORG4567"
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 uppercase shadow-sm outline-none focus:border-brand-600"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Site web (facultatif)</label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="https://"
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Nom *</label>
          <input
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Prénom *</label>
          <input
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Email *</label>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Téléphone (facultatif)</label>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Présentez brièvement vos séjours et vos attentes *
        </label>
        <textarea
          required
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white p-4 shadow-sm outline-none focus:border-brand-600"
          placeholder="Types de séjours, publics accueillis, périodes, volumes approximatifs, etc."
        />
      </div>

      {errorMessage ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</p>
      ) : null}
      {status === 'success' ? (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          Merci, votre demande a bien été envoyée. Nous vous recontacterons rapidement.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">* champs obligatoires</p>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="cta-orange-sweep inline-flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Mail className="h-4 w-4" />
          {status === 'loading' ? 'Envoi…' : 'Envoyer la demande'}
        </button>
      </div>
    </form>
  );
}
