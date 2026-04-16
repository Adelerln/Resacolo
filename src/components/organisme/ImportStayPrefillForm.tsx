'use client';

import { useState, type FormEvent } from 'react';

type AccommodationOption = { id: string; label: string };

type ImportStayPrefillFormProps = {
  organizerId: string;
  accommodationOptions: AccommodationOption[];
  actionPath?: string;
};

/**
 * Formulaire classique POST vers `/api/import-stay` avec retour visuel pendant l’attente
 * (fetch + Playwright peuvent prendre 1–2 minutes : sans ça, l’utilisateur croit que rien ne se passe).
 *
 * Ne jamais mettre `disabled` sur les champs nommés : les champs désactivés ne sont pas envoyés
 * au serveur, donc `sourceUrl` serait vide après setState(pending).
 */
export default function ImportStayPrefillForm({
  organizerId,
  accommodationOptions,
  actionPath = '/api/import-stay'
}: ImportStayPrefillFormProps) {
  const [pending, setPending] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const urlInput = form.elements.namedItem('sourceUrl') as HTMLInputElement | null;
    if (urlInput?.value) {
      urlInput.value = urlInput.value.trim();
    }
    setPending(true);
    /* La navigation suit ; si la requête est longue, le bouton reste sur « Import en cours… » */
  };

  return (
    <form action={actionPath} method="post" className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_320px] sm:items-end">
        <label className="block text-sm font-medium text-slate-700">
          URL de la fiche séjour
          <input
            name="sourceUrl"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://exemple.com/fiche-sejour"
            className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 ${pending ? 'cursor-wait bg-slate-50' : ''}`}
            required
            readOnly={pending}
            aria-describedby="import-stay-url-hint"
          />
          <span id="import-stay-url-hint" className="mt-1 block text-xs font-normal text-slate-500">
            Collez l’URL complète (https…). La validation se fait côté serveur ; l’import peut prendre une à
            plusieurs minutes (images et tarifs dynamiques).
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Hébergement à rattacher
          <select
            name="selectedAccommodationId"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            defaultValue=""
          >
            <option value="">Créer un nouvel hébergement depuis l&apos;import</option>
            {accommodationOptions.map((accommodation) => (
              <option key={accommodation.id} value={accommodation.id}>
                {accommodation.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input type="hidden" name="organizerId" value={organizerId} />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-90"
        >
          {pending ? 'Import en cours… (patientez)' : 'Pré-remplir'}
        </button>
        {pending ? (
          <p className="mt-2 text-xs text-slate-600">
            Ne fermez pas cet onglet : le serveur télécharge la page et peut lancer un navigateur pour les
            images et les tarifs.
          </p>
        ) : null}
      </div>
    </form>
  );
}
