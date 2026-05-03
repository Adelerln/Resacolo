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
  transportCitiesDebug?: string;
  showOnlyWhenDraftReady?: boolean;
};

export default function StayDraftEnrichLauncher({
  organizerId,
  initialDraftId = '',
  aiDraftId = '',
  aiSuccess = false,
  transportCitiesDebug = '',
  showOnlyWhenDraftReady = false
}: StayDraftEnrichLauncherProps) {
  const [createdDraftId, setCreatedDraftId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const draftId = (createdDraftId || initialDraftId || aiDraftId || '').trim();
  const isDraftReady = draftId.length > 0;
  const shouldRender = !showOnlyWhenDraftReady || isDraftReady || (aiSuccess && aiDraftId.trim().length > 0);

  useEffect(() => {
    const onDraftCreated = (event: Event) => {
      const customEvent = event as CustomEvent<{ draftId?: string }>;
      const nextDraftId = customEvent.detail?.draftId?.trim();
      if (nextDraftId) {
        setCreatedDraftId(nextDraftId);
      }
    };

    window.addEventListener('resacolo:stay-draft-created', onDraftCreated as EventListener);
    return () =>
      window.removeEventListener('resacolo:stay-draft-created', onDraftCreated as EventListener);
  }, []);

  useEffect(() => {
    if (!aiSuccess || !aiDraftId.trim() || !transportCitiesDebug.trim()) return;

    try {
      const parsed = JSON.parse(transportCitiesDebug) as unknown;
      const transportCities = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];

      console.info('[stay-drafts/enrich] villes de transport détectées', {
        draftId: aiDraftId,
        transportCities,
        transportCityCount: transportCities.length
      });
    } catch {
      console.info('[stay-drafts/enrich] villes de transport détectées', {
        draftId: aiDraftId,
        transportCitiesDebug
      });
    }
  }, [aiDraftId, aiSuccess, transportCitiesDebug]);

  if (!shouldRender) return null;

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <form
        action="/api/stay-drafts/enrich"
        method="post"
        className="mt-2"
        onSubmit={() => {
          setIsSubmitting(true);
        }}
      >
        <input name="draftId" type="hidden" value={draftId} />
        <input type="hidden" name="organizerId" value={organizerId} />
        <input type="hidden" name="force" value="true" />
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="organizer-btn-secondary min-h-[42px] w-full border-slate-300 bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-80 sm:w-auto"
        >
          {isSubmitting ? 'Finalisation...' : 'Terminer le remplissage'}
        </button>
      </form>

      {aiSuccess && aiDraftId ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
          <p className="text-lg font-semibold">Enrichissement par Intelligence Artificielle terminé</p>
          <DraftReferenceCopyField
            value={aiDraftId}
            labelClassName="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700"
            codeClassName="text-emerald-900"
            buttonClassName="border-emerald-300 text-emerald-900 hover:bg-emerald-100"
            showCopyButton={false}
          />
          <Link
            href={withOrganizerQuery(`/organisme/sejours/drafts/${aiDraftId}`, organizerId)}
            className="organizer-btn-primary mt-3"
          >
            Voir le résultat
          </Link>
        </div>
      ) : null}
    </div>
  );
}
