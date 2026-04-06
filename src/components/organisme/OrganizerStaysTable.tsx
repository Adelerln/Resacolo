'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
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
  locationText: string;
  availability: 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'FULL';
  sessions: StaySessionListItem[];
};

type OrganizerStaysTableProps = {
  stays: StayListItem[];
  organizerId?: string | null;
  updateSessionRemainingPlacesAction: (formData: FormData) => void;
  defaultOpenStayIds?: string[];
  defaultEditingSessionId?: string | null;
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

function availabilityLabel(availability: StayListItem['availability']) {
  switch (availability) {
    case 'AVAILABLE':
      return 'DISPONIBLE';
    case 'PARTIALLY_AVAILABLE':
      return 'PARTIELLEMENT DISPONIBLE';
    case 'FULL':
      return 'COMPLET';
  }
}

function availabilityClassName(availability: StayListItem['availability']) {
  switch (availability) {
    case 'AVAILABLE':
      return 'bg-emerald-100 text-emerald-700';
    case 'PARTIALLY_AVAILABLE':
      return 'bg-amber-100 text-amber-700';
    case 'FULL':
      return 'bg-rose-100 text-rose-700';
  }
}

export default function OrganizerStaysTable({
  stays,
  organizerId,
  updateSessionRemainingPlacesAction,
  defaultOpenStayIds = [],
  defaultEditingSessionId = null
}: OrganizerStaysTableProps) {
  const [openStayIds, setOpenStayIds] = useState<string[]>(defaultOpenStayIds);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [dirtySessionIds, setDirtySessionIds] = useState<Record<string, boolean>>({});
  const [completionFilter, setCompletionFilter] = useState<'all' | 'full' | 'available'>('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const submittersRef = useRef<Record<string, ((nextEditSessionId?: string) => void) | undefined>>({});

  useEffect(() => {
    setOpenStayIds(defaultOpenStayIds);
  }, [defaultOpenStayIds]);

  useEffect(() => {
    setEditingSessionId(defaultEditingSessionId);
  }, [defaultEditingSessionId]);

  const locationOptions = Array.from(
    new Set(
      stays
        .map((stay) => stay.locationText.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'fr'))
    )
  );

  const filteredStays = stays.filter((stay) => {
    if (completionFilter === 'full' && stay.availability !== 'FULL') return false;
    if (completionFilter === 'available' && stay.availability === 'FULL') return false;
    if (locationFilter !== 'all' && stay.locationText.trim() !== locationFilter) return false;
    return true;
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Disponibilité
            <select
              value={completionFilter}
              onChange={(event) =>
                setCompletionFilter(event.target.value as 'all' | 'full' | 'available')
              }
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">Tous les séjours</option>
              <option value="full">Séjours complets</option>
              <option value="available">Séjours non complets</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Lieu
            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">Tous les lieux</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3"></th>
              <th className="px-4 py-3">Séjour</th>
              <th className="px-4 py-3">Saison</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Disponibilité</th>
              <th className="px-4 py-3">Lieu</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredStays.map((stay) => {
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
                              : [stay.id]
                          );
                          setEditingSessionId(null);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                        aria-label={isOpen ? 'Masquer les sessions' : 'Afficher les sessions'}
                      >
                        <span
                          aria-hidden="true"
                          className={`relative block h-3 w-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        >
                          <span className="absolute left-[1px] top-[5px] h-0.5 w-[7px] rotate-45 rounded-full bg-current" />
                          <span className="absolute right-[1px] top-[5px] h-0.5 w-[7px] -rotate-45 rounded-full bg-current" />
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{stay.title}</td>
                    <td className="px-4 py-3 text-slate-600">{stay.seasonName}</td>
                    <td className="px-4 py-3 text-slate-600">{stayStatusLabel(stay.status)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${availabilityClassName(stay.availability)}`}
                      >
                        {availabilityLabel(stay.availability)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{stay.locationText || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={withOrganizerQuery(`/organisme/sejours/${stay.id}`, organizerId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-orange-200 px-3 py-1 text-xs font-semibold text-orange-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Éditer
                        </Link>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${stay.id}-sessions`} className="border-t border-slate-100 bg-slate-100/80">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50">
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
                                            stay_id: stay.id,
                                            next_edit_session_id: ''
                                          }}
                                          inputClassName="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                          labelClassName="text-xs font-medium text-slate-600"
                                          buttonLabel="Enregistrer"
                                          onDirtyChange={(isDirty) => {
                                            setDirtySessionIds((current) => {
                                              if (current[sessionItem.id] === isDirty) return current;
                                              return {
                                                ...current,
                                                [sessionItem.id]: isDirty
                                              };
                                            });
                                          }}
                                          registerSubmit={(submit) => {
                                            if (submit) {
                                              submittersRef.current[sessionItem.id] = submit;
                                              return;
                                            }
                                            delete submittersRef.current[sessionItem.id];
                                          }}
                                        />
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (
                                              editingSessionId &&
                                              editingSessionId !== sessionItem.id &&
                                              dirtySessionIds[editingSessionId] &&
                                              submittersRef.current[editingSessionId]
                                            ) {
                                              submittersRef.current[editingSessionId]?.(sessionItem.id);
                                              return;
                                            }

                                            setEditingSessionId(sessionItem.id);
                                          }}
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
            {filteredStays.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-sm text-slate-500">
                  Aucun séjour ne correspond aux filtres sélectionnés.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
