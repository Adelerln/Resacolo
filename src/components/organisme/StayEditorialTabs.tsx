'use client';

import { useState } from 'react';

type TabKey =
  | 'description'
  | 'activities_text'
  | 'program_text'
  | 'supervision_text'
  | 'required_documents_text'
  | 'transport';

type StayEditorialTabsProps = {
  description: string;
  activitiesText: string;
  programText: string;
  supervisionText: string;
  requiredDocumentsText: string;
  transportMode: string;
  transportText: string;
};

const TABS: Array<{ key: TabKey; label: string; rows: number }> = [
  { key: 'description', label: 'Description', rows: 5 },
  { key: 'activities_text', label: 'Activités', rows: 5 },
  { key: 'program_text', label: 'Programme', rows: 6 },
  { key: 'supervision_text', label: 'Encadrement', rows: 5 },
  { key: 'required_documents_text', label: 'Documents obligatoires', rows: 5 },
  { key: 'transport', label: 'Transport', rows: 5 }
];

export default function StayEditorialTabs({
  description,
  activitiesText,
  programText,
  supervisionText,
  requiredDocumentsText,
  transportMode,
  transportText
}: StayEditorialTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('description');

  const values: Record<TabKey, string> = {
    description,
    activities_text: activitiesText,
    program_text: programText,
    supervision_text: supervisionText,
    required_documents_text: requiredDocumentsText,
    transport: transportText
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Contenu du séjour</h2>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={
                isActive
                  ? 'rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white'
                  : 'rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {TABS.map((tab) => (
          <div key={tab.key} className={tab.key === activeTab ? 'block' : 'hidden'}>
            {tab.key === 'transport' ? (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Mode de transport
                  <select
                    name="transport_mode"
                    defaultValue={transportMode}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <option value="Aller/Retour similaire">Aller/Retour similaire</option>
                    <option value="Aller/Retour différencié">Aller/Retour différencié</option>
                    <option value="Sans transport">Sans transport</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Texte transport
                  <textarea
                    name="transport_text"
                    defaultValue={transportText}
                    rows={tab.rows}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
            ) : (
              <label className="block text-sm font-medium text-slate-700">
                {tab.label}
                <textarea
                  name={tab.key}
                  defaultValue={values[tab.key]}
                  rows={tab.rows}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
