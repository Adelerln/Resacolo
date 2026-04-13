'use client';

import { useState } from 'react';
import OrganizerOptionChecklist, {
  type OrganizerOptionChecklistProps
} from '@/components/organisme/OrganizerOptionChecklist';

type TabKey = 'saisons' | 'activites' | 'durees' | 'sejours';

const TABS: { id: TabKey; label: string }[] = [
  { id: 'saisons', label: 'Saisons' },
  { id: 'activites', label: 'Activités' },
  { id: 'durees', label: 'Durées' },
  { id: 'sejours', label: 'Séjours' }
];

type OrganizerCatalogTabsProps = {
  seasonChecklist: OrganizerOptionChecklistProps;
  activityChecklist: OrganizerOptionChecklistProps;
  stayTypeChecklist: OrganizerOptionChecklistProps;
  durationMinDefault: string;
  durationMaxDefault: string;
};

export default function OrganizerCatalogTabs({
  seasonChecklist,
  activityChecklist,
  stayTypeChecklist,
  durationMinDefault,
  durationMaxDefault
}: OrganizerCatalogTabsProps) {
  const [openPanel, setOpenPanel] = useState<TabKey | null>(null);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-3" aria-label="Sections du catalogue">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenPanel(item.id)}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={openPanel ? 'fixed inset-0 z-50' : 'hidden'}>
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => setOpenPanel(null)}
          className="absolute inset-0 bg-slate-950/30"
        />

        <div className="relative flex min-h-full items-center justify-center p-4">
          <div className="relative w-full max-w-3xl rounded-[28px] bg-white p-5 shadow-[0_30px_90px_-30px_rgba(15,23,42,0.45)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {TABS.find((item) => item.id === openPanel)?.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenPanel(null)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <div className={openPanel === 'saisons' ? '' : 'hidden'}>
                <OrganizerOptionChecklist {...seasonChecklist} showHeading={false} />
              </div>
              <div className={openPanel === 'activites' ? '' : 'hidden'}>
                <OrganizerOptionChecklist {...activityChecklist} showHeading={false} />
              </div>
              <div className={openPanel === 'durees' ? '' : 'hidden'}>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Indique la durée minimale et maximale, en jours, des séjours que tu proposes.
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Durée minimale (jours)
                      <input
                        name="stay_duration_min_days"
                        type="number"
                        min={1}
                        placeholder="ex. 5"
                        defaultValue={durationMinDefault}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Durée maximale (jours)
                      <input
                        name="stay_duration_max_days"
                        type="number"
                        min={1}
                        placeholder="ex. 14"
                        defaultValue={durationMaxDefault}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 transition-colors"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className={openPanel === 'sejours' ? '' : 'hidden'}>
                <OrganizerOptionChecklist {...stayTypeChecklist} showHeading={false} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
