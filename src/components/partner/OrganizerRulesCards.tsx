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
};

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

function filterInitialIds(options: OrganizerRuleOption[], initialValues: string[]) {
  const selected = new Set(initialValues.map((value) => normalizeId(value)));
  return options.filter((option) => selected.has(normalizeId(option.id)));
}

function toggleIdValue(currentValues: string[], id: string) {
  const key = normalizeId(id);
  const hasValue = currentValues.some((item) => normalizeId(item) === key);
  if (hasValue) {
    return currentValues.filter((item) => normalizeId(item) !== key);
  }
  return [...currentValues, key];
}

function ToggleButton({
  label,
  isSelected,
  onClick,
  selectedClass,
  unselectedClass
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  selectedClass: string;
  unselectedClass: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1 ${
        isSelected ? selectedClass : unselectedClass
      }`}
    >
      {label}
    </button>
  );
}

export default function OrganizerRulesCards({
  organizerOptions,
  initialAllowed,
  initialExcluded
}: OrganizerRulesCardsProps) {
  const organizers = useMemo(() => normalizeAndSortOrganizers(organizerOptions), [organizerOptions]);

  const [allowedIds, setAllowedIds] = useState<string[]>(
    filterInitialIds(organizers, initialAllowed).map((option) => option.id)
  );
  const [excludedIds, setExcludedIds] = useState<string[]>(
    filterInitialIds(organizers, initialExcluded)
      .map((option) => option.id)
      .filter((id) => !filterInitialIds(organizers, initialAllowed).some((allowed) => allowed.id === id))
  );

  const excludedVisibleOptions = organizers.filter(
    (option) => !allowedIds.some((allowedId) => normalizeId(allowedId) === normalizeId(option.id))
  );

  const toggleAllowed = (id: string) => {
    const key = normalizeId(id);
    setAllowedIds((current) => toggleIdValue(current, id));
    setExcludedIds((current) => current.filter((item) => normalizeId(item) !== key));
  };

  const toggleExcluded = (id: string) => {
    const key = normalizeId(id);
    setExcludedIds((current) => toggleIdValue(current, id));
    setAllowedIds((current) => current.filter((item) => normalizeId(item) !== key));
  };

  if (organizers.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun organisateur détecté dans le catalogue Resacolo pour le moment.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-emerald-900">Organisateurs autorisés</h3>
        <p className="mt-1 text-xs text-emerald-800">
          Si aucun n’est sélectionné, tous les organisateurs du catalogue restent éligibles (sauf exclusions).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {organizers.map((option) => {
            const isSelected = allowedIds.some((item) => normalizeId(item) === normalizeId(option.id));
            return (
              <ToggleButton
                key={`allowed-${option.id}`}
                label={option.name}
                isSelected={isSelected}
                onClick={() => toggleAllowed(option.id)}
                selectedClass="border-emerald-400 bg-emerald-200 text-emerald-950"
                unselectedClass="border-emerald-300 bg-emerald-50 text-emerald-900"
              />
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <h3 className="text-sm font-semibold text-rose-900">Organisateurs exclus</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {excludedVisibleOptions.map((option) => {
            const isSelected = excludedIds.some((item) => normalizeId(item) === normalizeId(option.id));
            return (
              <ToggleButton
                key={`excluded-${option.id}`}
                label={option.name}
                isSelected={isSelected}
                onClick={() => toggleExcluded(option.id)}
                selectedClass="border-rose-400 bg-rose-200 text-rose-950"
                unselectedClass="border-rose-300 bg-rose-50 text-rose-900"
              />
            );
          })}
        </div>
      </div>

      {allowedIds.map((value) => (
        <input key={`hidden-organizer-allowed-${value}`} type="hidden" name="organizers_allowed" value={value} />
      ))}
      {excludedIds.map((value) => (
        <input key={`hidden-organizer-excluded-${value}`} type="hidden" name="organizers_excluded" value={value} />
      ))}
    </div>
  );
}
