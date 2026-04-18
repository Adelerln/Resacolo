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

  return (
    <>
      <form
        action="/api/stay-drafts/enrich"
        method="post"
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
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
        <button
          type="submit"
          className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
        >
          Enrichir avec IA
        </button>
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
