'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { withOrganizerQuery } from '@/lib/organizers';

type StayDraftEnrichLauncherProps = {
  organizerId: string;
  initialDraftId?: string;
  aiDraftId?: string;
  aiSuccess?: boolean;
};

export default function StayDraftEnrichLauncher({
  organizerId,
  initialDraftId = '',
  aiDraftId = '',
  aiSuccess = false
}: StayDraftEnrichLauncherProps) {
  const [draftId, setDraftId] = useState(initialDraftId || aiDraftId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onDraftCreated = (event: Event) => {
      const customEvent = event as CustomEvent<{ draftId?: string }>;
      const nextDraftId = customEvent.detail?.draftId?.trim();
      if (nextDraftId) {
        setDraftId(nextDraftId);
      }
    };

    window.addEventListener('resacolo:stay-draft-created', onDraftCreated as EventListener);
    return () =>
      window.removeEventListener('resacolo:stay-draft-created', onDraftCreated as EventListener);
  }, []);

  useEffect(() => {
    if (!isSubmitting) return;
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current;
        const delta = Math.max(1, Math.round((100 - current) / 12));
        return Math.min(92, current + delta);
      });
    }, 180);
    return () => window.clearInterval(interval);
  }, [isSubmitting]);

  return (
    <>
      <form
        action="/api/stay-drafts/enrich"
        method="post"
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={() => {
          setProgress(10);
          setIsSubmitting(true);
        }}
      >
        <label className="block flex-1 text-sm font-medium text-slate-700">
          ID du draft
          <input
            name="draftId"
            type="text"
            placeholder="UUID du stay_draft"
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            required
          />
        </label>
        <input type="hidden" name="organizerId" value={organizerId} />
        <input type="hidden" name="force" value="true" />
        <div className="w-full sm:w-56">
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="h-10 w-full rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-80"
          >
            {isSubmitting ? 'Enrichissement...' : 'Enrichir avec IA'}
          </button>
          {isSubmitting ? (
            <div className="mt-2" aria-live="polite" aria-label="Progression de l'enrichissement IA">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </form>

      {aiSuccess && aiDraftId ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
          <p className="text-lg font-semibold">Enrichissement IA terminé</p>
          <p className="mt-1 text-sm">
            ID du draft : <span className="font-semibold">{aiDraftId}</span>
          </p>
          <Link
            href={withOrganizerQuery(`/organisme/sejours/drafts/${aiDraftId}`, organizerId)}
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Voir le résultat
          </Link>
        </div>
      ) : null}
    </>
  );
}
