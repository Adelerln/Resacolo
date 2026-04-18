'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

type AccommodationOption = { id: string; label: string };

type ImportStayPrefillFormProps = {
  organizerId: string;
  accommodationOptions: AccommodationOption[];
  actionPath?: string;
};

type ImportProgressState = {
  step: string;
  label: string;
  percent: number;
  completed: boolean;
  error: string | null;
};

/**
 * Lancement AJAX vers `/api/import-stay` avec suivi visuel local pendant l’attente
 * (fetch + Playwright peuvent prendre 1–2 minutes).
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(null);

  useEffect(() => {
    if (!createdDraftId || importProgress?.completed) {
      return;
    }

    let cancelled = false;

    const pollProgress = async () => {
      try {
        const response = await fetch(
          `/api/stay-drafts/${createdDraftId}?organizerId=${encodeURIComponent(organizerId)}`,
          {
            headers: {
              Accept: 'application/json'
            },
            cache: 'no-store'
          }
        );

        const payload = (await response.json().catch(() => null)) as
          | {
              importProgress?: {
                step?: string;
                label?: string;
                percent?: number;
                completed?: boolean;
                error?: string | null;
              };
            }
          | null;

        if (!response.ok || !payload?.importProgress || cancelled) {
          return;
        }

        setImportProgress({
          step: payload.importProgress.step ?? 'created',
          label: payload.importProgress.label ?? 'Import en cours',
          percent:
            typeof payload.importProgress.percent === 'number'
              ? payload.importProgress.percent
              : 5,
          completed: Boolean(payload.importProgress.completed),
          error: payload.importProgress.error ?? null
        });
      } catch {
        // Garder le dernier état visible sans bruit si un poll échoue ponctuellement.
      }
    };

    void pollProgress();
    const intervalId = window.setInterval(() => {
      void pollProgress();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [createdDraftId, importProgress?.completed, organizerId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const urlInput = form.elements.namedItem('sourceUrl') as HTMLInputElement | null;
    if (urlInput?.value) {
      urlInput.value = urlInput.value.trim();
    }
    setErrorMessage(null);
    setCreatedDraftId(null);
    setImportProgress(null);
    setPending(true);

    try {
      const response = await fetch(actionPath, {
        method: 'POST',
        headers: {
          Accept: 'application/json'
        },
        body: new FormData(form)
      });

      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; draftId?: string; error?: string }
        | null;

      if (!response.ok || !payload?.success || !payload?.draftId) {
        setErrorMessage(payload?.error ?? "Impossible de lancer l'import.");
        return;
      }

      setCreatedDraftId(payload.draftId);
      window.dispatchEvent(
        new CustomEvent('resacolo:stay-draft-created', {
          detail: { draftId: payload.draftId }
        })
      );
      setImportProgress({
        step: 'created',
        label: 'Brouillon créé',
        percent: 5,
        completed: false,
        error: null
      });
      form.reset();
    } catch {
      setErrorMessage("Impossible de lancer l'import.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form action={actionPath} method="post" className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-end">
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
            />
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
        <div>
          <span className="flex items-start gap-2 text-sm font-normal text-slate-600">
            <input
              name="includePricing"
              type="checkbox"
              value="true"
              defaultChecked
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            <span>
              Importer aussi les prix et les options de transport.
              Si cette case est décochée, seules les sessions sont importées, sans prix ni villes
              de transport.
            </span>
          </span>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Si la case est cochée, alors l&apos;import est beaucoup plus long.
          </span>
        </div>
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
        {createdDraftId && importProgress ? (
          <div
            className={`mt-2 rounded-lg border px-3 py-3 text-sm ${
              importProgress.error
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : importProgress.completed
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-orange-200 bg-orange-50 text-orange-800'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">
                {importProgress.completed && !importProgress.error ? 'Import terminé' : 'Import lancé'}.
                {' '}Le brouillon <span className="font-semibold">{createdDraftId}</span>{' '}
                {importProgress.completed && !importProgress.error
                  ? 'est prêt.'
                  : 'se remplit en arrière-plan.'}
              </p>
              <span className="shrink-0 font-semibold">{importProgress.percent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  importProgress.error
                    ? 'bg-rose-500'
                    : importProgress.completed
                      ? 'bg-emerald-500'
                      : 'bg-orange-500'
                }`}
                style={{ width: `${Math.max(4, Math.min(100, importProgress.percent))}%` }}
              />
            </div>
            <p className="mt-2 text-xs">
              {importProgress.error ? importProgress.error : importProgress.label}
            </p>
            {importProgress.completed && !importProgress.error ? (
              <p className="mt-2 text-xs font-medium">
                <Link
                  href={`/organisme/sejours/drafts/${createdDraftId}?organizerId=${encodeURIComponent(organizerId)}`}
                  className="underline"
                >
                  Ouvrir la review
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
        {errorMessage ? (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </form>
  );
}
