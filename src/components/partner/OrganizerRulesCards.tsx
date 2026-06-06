'use client';

import { useMemo, useState } from 'react';

export type OrganizerRuleOption = {
  id: string;
  name: string;
};

type OrganizerRulesCardsProps = {
  organizerOptions: OrganizerRuleOption[];
  initialAllowed: string[];
  initialExcluded: string[];
  onValuesChange?: () => void;
};

type OrganizerState = 'allowed' | 'excluded';

function normalizeId(value: string) {
  return value.trim();
}

function normalizeAndSortOrganizers(options: OrganizerRuleOption[]) {
  const byId = new Map<string, OrganizerRuleOption>();
  for (const option of options) {
    const id = normalizeId(option.id);
    if (!id) continue;
    byId.set(id, { id, name: option.name.trim() || 'Organisateur' });
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  );
}

function buildInitialOrganizerStates(
  organizers: OrganizerRuleOption[],
  initialAllowed: string[],
  initialExcluded: string[]
): Record<string, OrganizerState> {
  const allowedIds = new Set(initialAllowed.map(normalizeId));
  const excludedIds = new Set(initialExcluded.map(normalizeId));
  const states: Record<string, OrganizerState> = {};

  for (const organizer of organizers) {
    const id = normalizeId(organizer.id);
    if (allowedIds.has(id)) {
      states[organizer.id] = 'allowed';
    } else if (excludedIds.has(id)) {
      states[organizer.id] = 'excluded';
    } else if (initialAllowed.length > 0) {
      states[organizer.id] = 'excluded';
    } else if (initialExcluded.length > 0) {
      states[organizer.id] = 'allowed';
    } else {
      states[organizer.id] = 'excluded';
    }
  }

  return states;
}

function formatSummaryList(organizers: OrganizerRuleOption[]) {
  if (organizers.length === 0) return 'Aucun';
  return organizers.map((organizer) => organizer.name).join(', ');
}

export default function OrganizerRulesCards({
  organizerOptions,
  initialAllowed,
  initialExcluded,
  onValuesChange
}: OrganizerRulesCardsProps) {
  const organizers = useMemo(() => normalizeAndSortOrganizers(organizerOptions), [organizerOptions]);

  const [organizerStates, setOrganizerStates] = useState<Record<string, OrganizerState>>(() =>
    buildInitialOrganizerStates(organizers, initialAllowed, initialExcluded)
  );

  const allowedOrganizers = organizers.filter((organizer) => organizerStates[organizer.id] === 'allowed');
  const excludedOrganizers = organizers.filter((organizer) => organizerStates[organizer.id] === 'excluded');
  const usesAllowedWhitelist =
    allowedOrganizers.length > 0 && allowedOrganizers.length < organizers.length;

  const toggleOrganizer = (id: string) => {
    setOrganizerStates((current) => ({
      ...current,
      [id]: current[id] === 'allowed' ? 'excluded' : 'allowed'
    }));
    onValuesChange?.();
  };

  if (organizers.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun organisateur détecté dans le catalogue Resacolo pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {organizers.map((organizer) => {
            const isAllowed = organizerStates[organizer.id] === 'allowed';
            return (
              <button
                key={`organizer-${organizer.id}`}
                type="button"
                aria-pressed={isAllowed}
                onClick={() => toggleOrganizer(organizer.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1 ${
                  isAllowed
                    ? 'border-emerald-400 bg-emerald-200 text-emerald-950'
                    : 'border-rose-300 bg-rose-50 text-rose-900'
                }`}
              >
                {organizer.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1 text-sm font-normal text-slate-700">
        <p>Autorisés : {formatSummaryList(allowedOrganizers)}</p>
        <p>Exclus : {formatSummaryList(excludedOrganizers)}</p>
      </div>

      {usesAllowedWhitelist
        ? allowedOrganizers.map((organizer) => (
            <input
              key={`hidden-organizer-allowed-${organizer.id}`}
              type="hidden"
              name="organizers_allowed"
              value={organizer.id}
            />
          ))
        : null}
      {excludedOrganizers.length > 0
        ? excludedOrganizers.map((organizer) => (
            <input
              key={`hidden-organizer-excluded-${organizer.id}`}
              type="hidden"
              name="organizers_excluded"
              value={organizer.id}
            />
          ))
        : null}
    </div>
  );
}
