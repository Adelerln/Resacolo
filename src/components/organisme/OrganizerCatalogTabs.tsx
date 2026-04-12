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
  const [tab, setTab] = useState<TabKey>('saisons');

  return (
    <div className="mt-5">
      <div
        className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-slate-200 bg-white pb-3 pt-0.5"
        role="tablist"
        aria-label="Sections du catalogue"
      >
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                selected
                  ? 'bg-[#6DC7FE] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        className="relative mt-5 min-h-[46rem] overflow-y-auto sm:min-h-[50rem]"
        role="tabpanel"
      >
        {/* Tout reste monté pour que le formulaire envoie toutes les cases et les durées, quel que soit l’onglet. */}
        <div className={tab === 'saisons' ? '' : 'hidden'}>
          <OrganizerOptionChecklist {...seasonChecklist} showHeading={false} />
        </div>
        <div className={tab === 'activites' ? '' : 'hidden'}>
          <OrganizerOptionChecklist {...activityChecklist} showHeading={false} />
        </div>
        <div className={tab === 'durees' ? '' : 'hidden'}>
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Indique la durée minimale et maximale (en jours) des séjours que tu proposes. Ces
              valeurs apparaissent sur ta page publique.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Durée minimale des séjours (jours)
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
                Durée maximale des séjours (jours)
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
        <div className={tab === 'sejours' ? '' : 'hidden'}>
          <OrganizerOptionChecklist {...stayTypeChecklist} showHeading={false} />
        </div>
      </div>
    </div>
  );
}
