'use client';

import { useEffect, useState, type FormEvent } from 'react';
import DraftReferenceCopyField from '@/components/organisme/DraftReferenceCopyField';

type AccommodationOption = { id: string; label: string };

type ImportStayPrefillFormProps = {
  organizerId: string;
  accommodationOptions: AccommodationOption[];
  actionPath?: string;
  initialDraftId?: string;
  initialImportAction?: ImportAction;
};

type ImportProgressState = {
  step: string;
  label: string;
  percent: number;
  completed: boolean;
  error: string | null;
};
type ImportAction = 'created' | 'existing' | 'restarted';

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
  actionPath = '/api/import-stay',
  initialDraftId = '',
  initialImportAction
}: ImportStayPrefillFormProps) {
  const trimmedInitialDraftId = initialDraftId.trim();
  const hasServerHydratedImportState = Boolean(trimmedInitialDraftId && initialImportAction);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(
    hasServerHydratedImportState ? trimmedInitialDraftId : null
  );
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(
    hasServerHydratedImportState
      ? {
          step: 'created',
          label:
            initialImportAction === 'restarted' ? 'Brouillon existant relancé' : 'Brouillon créé',
          percent: initialImportAction === 'existing' ? 100 : 5,
          completed: initialImportAction === 'existing',
          error: null
        }
      : null
  );
  const [importAction, setImportAction] = useState<ImportAction>(initialImportAction ?? 'created');

  useEffect(() => {
    if (!hasServerHydratedImportState || !initialImportAction) {
      return;
    }

    setCreatedDraftId(trimmedInitialDraftId);
    setImportAction(initialImportAction);
    setImportProgress({
      step: 'created',
      label: initialImportAction === 'restarted' ? 'Brouillon existant relancé' : 'Brouillon créé',
      percent: initialImportAction === 'existing' ? 100 : 5,
      completed: initialImportAction === 'existing',
      error: null
    });
  }, [hasServerHydratedImportState, initialImportAction, trimmedInitialDraftId]);

  useEffect(() => {
    if (!createdDraftId || importProgress?.completed || importAction === 'existing') {
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
  }, [createdDraftId, importAction, importProgress?.completed, organizerId]);

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
    setImportAction('created');
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
        | { success?: boolean; draftId?: string; error?: string; importAction?: ImportAction }
        | null;

      if (!response.ok || !payload?.success || !payload?.draftId) {
        setErrorMessage(payload?.error ?? "Impossible de lancer l'import.");
        return;
      }

      setCreatedDraftId(payload.draftId);
      const nextImportAction: ImportAction = payload.importAction ?? 'created';
      setImportAction(nextImportAction);
      window.dispatchEvent(
        new CustomEvent('resacolo:stay-draft-created', {
          detail: { draftId: payload.draftId }
        })
      );
      setImportProgress({
        step: 'created',
        label: nextImportAction === 'restarted' ? 'Brouillon existant relancé' : 'Brouillon créé',
        percent: 5,
        completed: nextImportAction === 'existing',
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
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        1) Collez l&apos;adresse internet du séjour.
        <br />
        2) Vérifiez l&apos;hébergement.
        <br />
        3) Cliquez sur <strong>Pré-remplir</strong>.
      </p>

      <label className="block text-sm font-medium text-slate-700">
        Adresse internet du séjour
        <input
          name="sourceUrl"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="Exemple : https://www.site.com/fiche-sejour"
          className={`organizer-input ${pending ? 'cursor-wait bg-slate-50' : ''}`}
          required
          readOnly={pending}
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Hébergement du séjour (obligatoire)
        <select
          name="selectedAccommodationId"
          className="organizer-input"
          defaultValue=""
        >
          <option value="">Créer un nouvel hébergement automatiquement</option>
          {accommodationOptions.map((accommodation) => (
            <option key={accommodation.id} value={accommodation.id}>
              {accommodation.label}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
        <p className="text-sm font-medium text-slate-700">Import des prix et du transport</p>
        <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
          <input
            name="includePricing"
            type="checkbox"
            value="true"
            defaultChecked
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
          />
          <span>
            Inclure les prix et les villes de transport dans l&apos;import.
          </span>
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Si vous décochez, seules les sessions seront importées.
        </p>
      </div>

      <input type="hidden" name="organizerId" value={organizerId} />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="organizer-btn-primary min-h-[44px] disabled:cursor-wait disabled:opacity-90"
        >
          {pending ? 'Import en cours…' : 'Pré-remplir'}
        </button>
        {pending ? (
          <p className="mt-2 text-xs text-slate-600">
            Merci de patienter quelques instants.
          </p>
        ) : null}
      </div>

      <div>
        {createdDraftId && importAction === 'existing' ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Un brouillon existait déjà pour cette URL. Il a été réutilisé automatiquement.
          </p>
        ) : null}
        {createdDraftId && importAction === 'restarted' ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Un brouillon en échec existait déjà pour cette URL. L&apos;import a été relancé sur ce même brouillon.
          </p>
        ) : null}
        {createdDraftId && importProgress && importAction !== 'existing' ? (
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
                {importProgress.completed && !importProgress.error
                  ? 'Le brouillon est prêt.'
                  : 'Import lancé. Le brouillon se remplit en arrière-plan.'}
              </p>
              <span className="shrink-0 font-semibold">{importProgress.percent}%</span>
            </div>
            <DraftReferenceCopyField value={createdDraftId} />
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
