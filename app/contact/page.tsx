'use client';

import { FormEvent, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

interface ContactFormState {
  name: string;
  email: string;
  message: string;
}

const initialState: ContactFormState = {
  name: '',
  email: '',
  message: ''
};

export default function ContactPage() {
  const supabase = getSupabaseClient();
  const [form, setForm] = useState<ContactFormState>(initialState);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.currentTarget;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setErrorMessage(null);

    try {
      const { error } = await supabase.from('Messages').insert({
        name: form.name,
        email: form.email,
        message: form.message
      });

      if (error) {
        throw error;
      }

      setStatus('success');
      setForm(initialState);
    } catch (error) {
      console.error('Erreur lors de l’envoi du message', error);
      setStatus('error');
      setErrorMessage('Impossible d’enregistrer votre message : ' + (error as Error).message);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-8 px-6 py-16">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">Contact</h1>
        <p className="text-lg text-slate-600">
          Une question, un besoin d’accompagnement ou l’envie de rejoindre Résocolo ? Laissez-nous un message.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Nom et prénom
          <input
            type="text"
            name="name"
            required
            value={form.name}
            onInput={handleChange}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Votre nom"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            name="email"
            required
            value={form.email}
            onInput={handleChange}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="vous@example.com"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Message
          <textarea
            name="message"
            rows={5}
            required
            value={form.message}
            onInput={handleChange}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Comment pouvons-nous vous aider ?"
          />
        </label>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="inline-flex justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? 'Envoi en cours…' : 'Envoyer'}
        </button>
        {status === 'success' && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Merci ! Votre message est bien enregistré.
          </p>
        )}
        {status === 'error' && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
        )}
        <p className="text-xs text-slate-500">
          Les messages sont stockés dans Supabase (table `contact_messages`). Assurez-vous d’avoir défini les bonnes
          policies avant de passer en production.
        </p>
      </form>
    </section>
  );
}
