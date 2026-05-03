'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import DraftReferenceCopyField from '@/components/organisme/DraftReferenceCopyField';
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
          Brouillon à enrichir
          <input
            name="draftId"
            type="text"
            placeholder="Collez la référence du brouillon"
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
            className="organizer-input"
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
            className="organizer-btn-secondary min-h-[40px] w-full border-slate-300 bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-80"
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
          <p className="text-lg font-semibold">Enrichissement par Intelligence Artificielle terminé</p>
          <DraftReferenceCopyField
            value={aiDraftId}
            labelClassName="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700"
            codeClassName="text-emerald-900"
            buttonClassName="border-emerald-300 text-emerald-900 hover:bg-emerald-100"
          />
          <Link
            href={withOrganizerQuery(`/organisme/sejours/drafts/${aiDraftId}`, organizerId)}
            className="organizer-btn-primary mt-3"
          >
            Voir le résultat
          </Link>
        </div>
      ) : null}
    </>
  );
}
