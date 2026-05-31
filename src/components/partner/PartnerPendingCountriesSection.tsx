'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function PartnerPendingCountriesSection({
  pendingCountries
}: {
  pendingCountries: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(pendingCountries);
  const [busyCountry, setBusyCountry] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (pending.length === 0) return null;

  async function submitDecision(country: string, decision: 'allowed' | 'excluded') {
    setBusyCountry(country);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/partner/catalog-rules/country-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, decision })
      });
      const payload = (await response.json()) as { errors?: string[] };
      if (!response.ok) {
        throw new Error(payload.errors?.[0] ?? 'Enregistrement impossible.');
      }
      setPending((current) => current.filter((entry) => entry !== country));
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setBusyCountry(null);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5">
      <h2 className="text-sm font-semibold text-amber-950">Nouveaux pays de destination détectés</h2>
      <p className="mt-1 text-sm text-amber-900">
        Un ou plusieurs séjours mentionnent un pays qui n&apos;était pas encore référencé sur Resacolo.
        Indiquez s&apos;il doit être autorisé ou exclu pour vos ayants-droit (brouillon catalogue mis à jour).
      </p>
      {errorMessage ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {pending.map((country) => (
          <li
            key={country}
            className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="font-medium text-slate-900">{country}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyCountry === country}
                onClick={() => submitDecision(country, 'allowed')}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                Autoriser
              </button>
              <button
                type="button"
                disabled={busyCountry === country}
                onClick={() => submitDecision(country, 'excluded')}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
              >
                Exclure
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-amber-800">
        Vous pourrez affiner la liste complète dans{' '}
        <a href="/partenaire/catalogue" className="font-semibold underline">
          Catalogue
        </a>
        .
      </p>
    </section>
  );
}
