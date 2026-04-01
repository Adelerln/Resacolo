'use client';

import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import RemainingPlacesEditor from '@/components/organisme/RemainingPlacesEditor';
import { sessionStatusLabel, stayStatusLabel } from '@/lib/ui/labels';
import { withOrganizerQuery } from '@/lib/organizers';

type StaySessionListItem = {
  id: string;
  startDate: string;
  endDate: string;
  capacityTotal: number;
  capacityReserved: number;
  status: string | null;
};

type StayListItem = {
  id: string;
  title: string;
  status: string | null;
  seasonName: string;
  sessions: StaySessionListItem[];
};

type OrganizerStaysTableProps = {
  stays: StayListItem[];
  organizerId?: string | null;
  updateSessionRemainingPlacesAction: (formData: FormData) => void;
  defaultOpenStayIds?: string[];
};

function formatReservedPlacesLabel(count: number, total: number) {
  const reservedWord = count > 1 ? 'places réservées' : 'place réservée';
  return `${count} ${reservedWord} /${total}`;
}

function formatRemainingPlacesLabel(count: number) {
  const remainingWord = count > 1 ? 'places restantes' : 'place restante';
  return `${count} ${remainingWord}`;
}

function formatDateRange(startDate: string, endDate: string) {
  return `${new Date(startDate).toLocaleDateString('fr-FR')} - ${new Date(endDate).toLocaleDateString('fr-FR')}`;
}

export default function OrganizerStaysTable({
  stays,
  organizerId,
  updateSessionRemainingPlacesAction,
  defaultOpenStayIds = []
}: OrganizerStaysTableProps) {
  const [openStayIds, setOpenStayIds] = useState<string[]>(defaultOpenStayIds);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  useEffect(() => {
    setOpenStayIds(defaultOpenStayIds);
  }, [defaultOpenStayIds]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3"></th>
              <th className="px-4 py-3">Séjour</th>
              <th className="px-4 py-3">Saison</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Qualité</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {stays.map((stay) => {
              const isOpen = openStayIds.includes(stay.id);

              return (
                <Fragment key={stay.id}>
                  <tr key={stay.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenStayIds((current) =>
                            current.includes(stay.id)
                              ? current.filter((id) => id !== stay.id)
                              : [...current, stay.id]
                          );
                          setEditingSessionId(null);
                        }}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                        aria-label={isOpen ? 'Masquer les sessions' : 'Afficher les sessions'}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{stay.title}</td>
                    <td className="px-4 py-3 text-slate-600">{stay.seasonName}</td>
                    <td className="px-4 py-3 text-slate-600">{stayStatusLabel(stay.status)}</td>
                    <td className="px-4 py-3 text-slate-600">-</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={withOrganizerQuery(`/organisme/sejours/${stay.id}`, organizerId)}
                          className="text-emerald-600"
                        >
                          Ouvrir
                        </Link>
                        <Link
                          href={withOrganizerQuery(`/organisme/sejours/${stay.id}`, organizerId)}
                          className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700"
                        >
                          Éditer
                        </Link>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${stay.id}-sessions`} className="border-t border-slate-100 bg-slate-50/70">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="rounded-xl border border-slate-200 bg-white">
                          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-900">
                            Sessions ouvertes
                          </div>
                          {stay.sessions.length > 0 ? (
                            <ul className="divide-y divide-slate-100">
                              {stay.sessions.map((sessionItem) => {
                                const remainingPlaces = Math.max(
                                  0,
                                  sessionItem.capacityTotal - sessionItem.capacityReserved
                                );
                                const displayStatus =
                                  sessionItem.status === 'COMPLETED' || sessionItem.status === 'ARCHIVED'
                                    ? sessionItem.status
                                    : remainingPlaces === 0
                                      ? 'FULL'
                                      : 'OPEN';
                                const isEditing = editingSessionId === sessionItem.id;

                                return (
                                  <li
                                    key={sessionItem.id}
                                    className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                                  >
                                    <div>
                                      <div className="font-medium text-slate-900">
                                        {formatDateRange(sessionItem.startDate, sessionItem.endDate)}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        {formatReservedPlacesLabel(
                                          sessionItem.capacityReserved,
                                          sessionItem.capacityTotal
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                                      <span
                                        className={
                                          displayStatus === 'FULL'
                                            ? 'rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700'
                                            : 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700'
                                        }
                                      >
                                        {sessionStatusLabel(displayStatus)}
                                      </span>
                                      {isEditing ? (
                                        <RemainingPlacesEditor
                                          action={updateSessionRemainingPlacesAction}
                                          initialValue={remainingPlaces}
                                          hiddenFields={{
                                            session_id: sessionItem.id,
                                            stay_id: stay.id
                                          }}
                                          inputClassName="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                          labelClassName="text-xs font-medium text-slate-600"
                                          buttonLabel="Enregistrer"
                                        />
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setEditingSessionId(sessionItem.id)}
                                          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
                                        >
                                          <span>{formatRemainingPlacesLabel(remainingPlaces)}</span>
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="px-4 py-4 text-sm text-slate-500">
                              Aucune session ouverte pour ce séjour.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
