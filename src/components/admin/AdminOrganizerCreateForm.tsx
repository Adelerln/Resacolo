'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  PASSWORD_POLICY_HTML_PATTERN,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_MIN_LENGTH
} from '@/lib/auth/password-policy';

type FieldValues = {
  name: string;
  contact_email: string;
  founded_year: string;
  age_min: string;
  age_max: string;
  hero_intro_text: string;
  description: string;
  first_name: string;
  last_name: string;
  user_email: string;
  temp_password: string;
};

const EMPTY_FIELDS: FieldValues = {
  name: '',
  contact_email: '',
  founded_year: '',
  age_min: '',
  age_max: '',
  hero_intro_text: '',
  description: '',
  first_name: '',
  last_name: '',
  user_email: '',
  temp_password: ''
};

export default function AdminOrganizerCreateForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [fields, setFields] = useState<FieldValues>(EMPTY_FIELDS);
  const [error, setError] = useState(initialError ?? '');
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof FieldValues>(key: K, value: FieldValues[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const response = await fetch('/api/admin/organizers', {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' }
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; redirectTo?: string; ok?: boolean }
        | null;

      if (!response.ok) {
        setError(payload?.error || 'Impossible de créer l’organisateur.');
        return;
      }

      if (payload?.redirectTo) {
        router.push(payload.redirectTo);
        return;
      }

      router.push('/admin/organizers');
    } catch {
      setError('Impossible de créer l’organisateur. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <form
        method="post"
        encType="multipart/form-data"
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <div className="space-y-4">
          <h2 className="admin-section-title text-base">Organisme</h2>
          <label className="block text-sm font-medium text-slate-700">
            Nom de l’organisateur
            <input
              name="name"
              value={fields.name}
              onChange={(event) => updateField('name', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email de contact
            <input
              name="contact_email"
              type="email"
              value={fields.contact_email}
              onChange={(event) => updateField('contact_email', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Année de création
            <input
              name="founded_year"
              type="number"
              min="1900"
              max="2100"
              value={fields.founded_year}
              onChange={(event) => updateField('founded_year', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Âge min
              <input
                name="age_min"
                type="number"
                min="0"
                value={fields.age_min}
                onChange={(event) => updateField('age_min', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Âge max
              <input
                name="age_max"
                type="number"
                min="0"
                value={fields.age_max}
                onChange={(event) => updateField('age_max', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Texte sous le titre
            <textarea
              name="hero_intro_text"
              rows={3}
              value={fields.hero_intro_text}
              onChange={(event) => updateField('hero_intro_text', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Texte de présentation
            <textarea
              name="description"
              rows={4}
              value={fields.description}
              onChange={(event) => updateField('description', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Logo (PNG/JPG)
            <input
              name="logo"
              type="file"
              accept="image/*"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Projet éducatif (PDF)
            <input
              name="education_project"
              type="file"
              accept="application/pdf"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        <div className="space-y-4">
          <h2 className="admin-section-title text-base">Compte principal</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Prénom
              <input
                name="first_name"
                value={fields.first_name}
                onChange={(event) => updateField('first_name', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Nom
              <input
                name="last_name"
                value={fields.last_name}
                onChange={(event) => updateField('last_name', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                required
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Email du premier utilisateur
            <input
              name="user_email"
              type="email"
              value={fields.user_email}
              onChange={(event) => updateField('user_email', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mot de passe temporaire
            <input
              name="temp_password"
              type="password"
              value={fields.temp_password}
              onChange={(event) => updateField('temp_password', event.target.value)}
              minLength={PASSWORD_POLICY_MIN_LENGTH}
              pattern={PASSWORD_POLICY_HTML_PATTERN}
              title={PASSWORD_POLICY_MESSAGE}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              required
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">{PASSWORD_POLICY_MESSAGE}</span>
          </label>
        </div>

        <div className="flex items-center justify-start gap-3 sm:justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}
