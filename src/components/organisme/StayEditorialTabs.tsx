'use client';

import { useState } from 'react';
import { formatAccommodationType } from '@/lib/accommodation-types';

type TabKey =
  | 'description'
  | 'activities_text'
  | 'program_text'
  | 'supervision_text'
  | 'required_documents_text'
  | 'transport'
  | 'accommodation';

type TextTabKey = Exclude<TabKey, 'accommodation'>;

type AccommodationOption = {
  id: string;
  name: string;
  accommodationType?: string | null;
  description?: string | null;
  locationLabel?: string | null;
};

type StayEditorialTabsProps = {
  description: string;
  activitiesText: string;
  programText: string;
  supervisionText: string;
  requiredDocumentsText: string;
  transportMode: string;
  transportText: string;
  transportModeLocked?: boolean;
  linkedAccommodation?: AccommodationOption | null;
  accommodations?: AccommodationOption[];
  syncAccommodationAction?: (formData: FormData) => void;
  unlinkAccommodationAction?: () => void;
};

const TABS: Array<{ key: TabKey; label: string; rows: number }> = [
  { key: 'description', label: 'Description', rows: 5 },
  { key: 'activities_text', label: 'Activités', rows: 5 },
  { key: 'program_text', label: 'Programme', rows: 6 },
  { key: 'accommodation', label: 'Hébergement', rows: 0 },
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
  transportText,
  transportModeLocked = false,
  linkedAccommodation = null,
  accommodations = [],
  syncAccommodationAction,
  unlinkAccommodationAction
}: StayEditorialTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('description');

  const values: Record<TextTabKey, string> = {
    description,
    activities_text: activitiesText,
    program_text: programText,
    supervision_text: supervisionText,
    required_documents_text: requiredDocumentsText,
    transport: transportText
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
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
                    disabled={transportModeLocked}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <option value="Aller/Retour similaire">Aller/Retour similaire</option>
                    <option value="Aller/Retour différencié">Aller/Retour différencié</option>
                    <option value="Sans transport">Sans transport</option>
                  </select>
                </label>
                {transportModeLocked && (
                  <p className="text-xs text-slate-500">
                    Le type de transport ne peut plus être modifié tant que des villes de transport
                    existent sur une ou plusieurs sessions.
                  </p>
                )}
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
            ) : tab.key === 'accommodation' ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Un seul hébergement peut être rattaché à ce séjour à la fois.
                </p>
                {linkedAccommodation ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-100 px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900">{linkedAccommodation.name}</div>
                      {linkedAccommodation.locationLabel ? (
                        <div className="mt-1 font-medium text-slate-700">{linkedAccommodation.locationLabel}</div>
                      ) : null}
                      <div className="mt-1 text-slate-600">
                        {formatAccommodationType(linkedAccommodation.accommodationType)}
                      </div>
                      {linkedAccommodation.description && (
                        <div className="mt-2 text-slate-500">{linkedAccommodation.description}</div>
                      )}
                    </div>
                    {unlinkAccommodationAction && (
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          formAction={unlinkAccommodationAction}
                          className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
                        >
                          Supprimer la liaison
                        </button>
                      </div>
                    )}
                  </div>
                ) : accommodations.length > 0 ? (
                  <div className="space-y-3">
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-100">
                      <div className="overflow-x-auto">
                        <table className="min-w-[560px] w-full text-left text-sm">
                          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                              <th className="px-3 py-2"></th>
                              <th className="px-3 py-2">Nom</th>
                              <th className="px-3 py-2">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accommodations.map((accommodation) => (
                              <tr key={accommodation.id} className="border-t border-slate-100">
                                <td className="px-3 py-2 align-top">
                                  <input
                                    type="radio"
                                    name="accommodation_id"
                                    value={accommodation.id}
                                    className="mt-1 cursor-pointer"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <div className="font-medium text-slate-900">{accommodation.name}</div>
                                  {accommodation.locationLabel ? (
                                    <div className="mt-1 text-xs font-semibold text-slate-700">
                                      {accommodation.locationLabel}
                                    </div>
                                  ) : null}
                                  {accommodation.description && (
                                    <div className="mt-1 text-xs text-slate-500">
                                      {accommodation.description}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top text-slate-600">
                                  {formatAccommodationType(accommodation.accommodationType)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {syncAccommodationAction && (
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          formAction={syncAccommodationAction}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Enregistrer la liaison
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Aucun hébergement créé pour cet organisme.
                  </p>
                )}
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
