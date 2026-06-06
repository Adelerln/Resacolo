'use client';

import { useMemo, useState } from 'react';
import { formatOrganizerStayTypeLabel } from '@/lib/organizer-profile-options';

type StayTypeRulesCardsProps = {
  stayTypeOptions: string[];
  seasonOptions: string[];
  initialAllowed: string[];
  initialExcluded: string[];
  initialSeasons: string[];
  showStayTypes?: boolean;
  showSeasons?: boolean;
  onValuesChange?: () => void;
};

type StayTypeState = 'allowed' | 'excluded';

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function withDisplayCaps(value: string) {
  return formatOrganizerStayTypeLabel(value);
}

function normalizeAndSort(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  );
}

function filterInitialSelection(options: string[], initialValues: string[]) {
  const selected = new Set(initialValues.map((value) => normalizeValue(value)));
  return options.filter((option) => selected.has(normalizeValue(option)));
}

function toggleSetValue(currentValues: string[], option: string) {
  const key = normalizeValue(option);
  const hasValue = currentValues.some((item) => normalizeValue(item) === key);
  if (hasValue) {
    return currentValues.filter((item) => normalizeValue(item) !== key);
  }
  return [...currentValues, option];
}

function buildInitialStayTypeStates(
  options: string[],
  initialAllowed: string[]
): Record<string, StayTypeState> {
  const allowedKeys = new Set(initialAllowed.map(normalizeValue));

  const states: Record<string, StayTypeState> = {};
  for (const option of options) {
    states[option] = allowedKeys.has(normalizeValue(option)) ? 'allowed' : 'excluded';
  }
  return states;
}

function ToggleButton({
  option,
  isSelected,
  onClick,
  selectedClass,
  unselectedClass
}: {
  option: string;
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
      {withDisplayCaps(option)}
    </button>
  );
}

function formatSeasonLabel(value: string) {
  const accentMap: Record<string, string> = {
    automne: 'Automne',
    ete: 'Été',
    'fin d\'annee': "Fin d'année",
    'fin d’annee': "Fin d'année",
    hiver: 'Hiver',
    printemps: 'Printemps'
  };
  const key = normalizeValue(value);
  if (accentMap[key]) return accentMap[key];
  return value.charAt(0).toLocaleUpperCase('fr-FR') + value.slice(1);
}

function formatSummaryList(options: string[], formatLabel: (value: string) => string = withDisplayCaps) {
  if (options.length === 0) return 'Aucun';
  return options.map(formatLabel).join(', ');
}

function StayTypeSingleCard({
  stayTypes,
  initialAllowed,
  onValuesChange
}: {
  stayTypes: string[];
  initialAllowed: string[];
  onValuesChange?: () => void;
}) {
  const [stayTypeStates, setStayTypeStates] = useState<Record<string, StayTypeState>>(() =>
    buildInitialStayTypeStates(stayTypes, initialAllowed)
  );

  const allowedTypes = stayTypes.filter((option) => stayTypeStates[option] === 'allowed');
  const excludedTypes = stayTypes.filter((option) => stayTypeStates[option] === 'excluded');
  const allAllowed = stayTypes.length > 0 && excludedTypes.length === 0;

  const toggleStayType = (option: string) => {
    setStayTypeStates((current) => ({
      ...current,
      [option]: current[option] === 'allowed' ? 'excluded' : 'allowed'
    }));
    onValuesChange?.();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {stayTypes.map((option) => {
            const isAllowed = stayTypeStates[option] === 'allowed';
            return (
              <button
                key={`stay-type-${option}`}
                type="button"
                aria-pressed={isAllowed}
                onClick={() => toggleStayType(option)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1 ${
                  isAllowed
                    ? 'border-emerald-400 bg-emerald-200 text-emerald-950'
                    : 'border-rose-300 bg-rose-50 text-rose-900'
                }`}
              >
                {withDisplayCaps(option)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1 text-sm font-normal text-slate-700">
        <p>Autorisés : {formatSummaryList(allowedTypes)}</p>
        <p>Exclus : {formatSummaryList(excludedTypes)}</p>
      </div>

      {!allAllowed
        ? allowedTypes.map((value) => (
            <input key={`hidden-allowed-${value}`} type="hidden" name="stay_types_allowed" value={value} />
          ))
        : null}
      {!allAllowed
        ? excludedTypes.map((value) => (
            <input key={`hidden-excluded-${value}`} type="hidden" name="stay_types_excluded" value={value} />
          ))
        : null}
    </div>
  );
}

function SeasonSingleCard({
  seasons,
  initialAllowed,
  onValuesChange
}: {
  seasons: string[];
  initialAllowed: string[];
  onValuesChange?: () => void;
}) {
  const [seasonStates, setSeasonStates] = useState<Record<string, StayTypeState>>(() =>
    buildInitialStayTypeStates(seasons, initialAllowed)
  );

  const allowedSeasons = seasons.filter((option) => seasonStates[option] === 'allowed');
  const excludedSeasons = seasons.filter((option) => seasonStates[option] === 'excluded');
  const allAllowed = seasons.length > 0 && excludedSeasons.length === 0;

  const toggleSeason = (option: string) => {
    setSeasonStates((current) => ({
      ...current,
      [option]: current[option] === 'allowed' ? 'excluded' : 'allowed'
    }));
    onValuesChange?.();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {seasons.map((option) => {
            const isAllowed = seasonStates[option] === 'allowed';
            return (
              <button
                key={`season-${option}`}
                type="button"
                aria-pressed={isAllowed}
                onClick={() => toggleSeason(option)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1 ${
                  isAllowed
                    ? 'border-emerald-400 bg-emerald-200 text-emerald-950'
                    : 'border-rose-300 bg-rose-50 text-rose-900'
                }`}
              >
                {formatSeasonLabel(option)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1 text-sm font-normal text-slate-700">
        <p>Autorisées : {formatSummaryList(allowedSeasons, formatSeasonLabel)}</p>
        <p>Exclues : {formatSummaryList(excludedSeasons, formatSeasonLabel)}</p>
      </div>

      {!allAllowed
        ? allowedSeasons.map((value) => (
            <input key={`hidden-season-${value}`} type="hidden" name="seasons_allowed" value={value} />
          ))
        : null}
    </div>
  );
}

export default function StayTypeRulesCards({
  stayTypeOptions,
  seasonOptions,
  initialAllowed,
  initialExcluded,
  initialSeasons,
  showStayTypes = true,
  showSeasons = true,
  onValuesChange
}: StayTypeRulesCardsProps) {
  const stayTypes = useMemo(() => normalizeAndSort(stayTypeOptions), [stayTypeOptions]);
  const seasons = useMemo(() => normalizeAndSort(seasonOptions), [seasonOptions]);

  const [allowedTypes, setAllowedTypes] = useState<string[]>(
    filterInitialSelection(stayTypes, initialAllowed)
  );
  const [excludedTypes, setExcludedTypes] = useState<string[]>(
    filterInitialSelection(stayTypes, initialExcluded).filter(
      (option) =>
        !filterInitialSelection(stayTypes, initialAllowed).some(
          (allowed) => normalizeValue(allowed) === normalizeValue(option)
        )
    )
  );
  const [allowedSeasons, setAllowedSeasons] = useState<string[]>(
    filterInitialSelection(seasons, initialSeasons)
  );

  const excludedVisibleOptions = stayTypes.filter(
    (option) => !allowedTypes.some((allowed) => normalizeValue(allowed) === normalizeValue(option))
  );

  const toggleAllowedType = (option: string) => {
    const key = normalizeValue(option);
    setAllowedTypes((current) => toggleSetValue(current, option));
    setExcludedTypes((current) => current.filter((item) => normalizeValue(item) !== key));
    onValuesChange?.();
  };

  const toggleExcludedType = (option: string) => {
    const key = normalizeValue(option);
    setExcludedTypes((current) => toggleSetValue(current, option));
    setAllowedTypes((current) => current.filter((item) => normalizeValue(item) !== key));
    onValuesChange?.();
  };

  const toggleSeason = (option: string) => {
    setAllowedSeasons((current) => toggleSetValue(current, option));
    onValuesChange?.();
  };

  if (showStayTypes && !showSeasons) {
    return (
      <StayTypeSingleCard
        stayTypes={stayTypes}
        initialAllowed={initialAllowed}
        onValuesChange={onValuesChange}
      />
    );
  }

  if (!showStayTypes && showSeasons) {
    return (
      <SeasonSingleCard
        seasons={seasons}
        initialAllowed={initialSeasons}
        onValuesChange={onValuesChange}
      />
    );
  }

  return (
    <div className={`grid gap-4 ${showStayTypes && showSeasons ? 'lg:grid-cols-3' : ''}`}>
      {showStayTypes ? (
        <>
          <div className={`rounded-xl border border-emerald-200 bg-emerald-50 p-4 ${showSeasons ? 'lg:col-span-2' : ''}`}>
            <h3 className="text-sm font-semibold text-emerald-900">Autorisations</h3>
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Types autorisés</p>
                <div className="flex flex-wrap gap-2">
                  {stayTypes.map((option) => {
                    const isSelected = allowedTypes.some(
                      (item) => normalizeValue(item) === normalizeValue(option)
                    );
                    return (
                      <ToggleButton
                        key={`allowed-${option}`}
                        option={option}
                        isSelected={isSelected}
                        onClick={() => toggleAllowedType(option)}
                        selectedClass="border-emerald-400 bg-emerald-200 text-emerald-950"
                        unselectedClass="border-emerald-300 bg-emerald-50 text-emerald-900"
                      />
                    );
                  })}
                </div>
              </div>

              {showSeasons ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Saisons autorisées</p>
                  <div className="flex flex-wrap gap-2">
                    {seasons.map((option) => {
                      const isSelected = allowedSeasons.some(
                        (item) => normalizeValue(item) === normalizeValue(option)
                      );
                      return (
                        <ToggleButton
                          key={`season-${option}`}
                          option={option}
                          isSelected={isSelected}
                          onClick={() => toggleSeason(option)}
                          selectedClass="border-emerald-400 bg-emerald-200 text-emerald-950"
                          unselectedClass="border-emerald-300 bg-emerald-50 text-emerald-900"
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <h3 className="text-sm font-semibold text-rose-900">Exclusions</h3>
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-slate-700">Types exclus</p>
              <div className="flex flex-wrap gap-2">
                {excludedVisibleOptions.map((option) => {
                  const isSelected = excludedTypes.some(
                    (item) => normalizeValue(item) === normalizeValue(option)
                  );
                  return (
                    <ToggleButton
                      key={`excluded-${option}`}
                      option={option}
                      isSelected={isSelected}
                      onClick={() => toggleExcludedType(option)}
                      selectedClass="border-rose-400 bg-rose-200 text-rose-950"
                      unselectedClass="border-rose-300 bg-rose-50 text-rose-900"
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {allowedTypes.map((value) => (
        <input key={`hidden-allowed-${value}`} type="hidden" name="stay_types_allowed" value={value} />
      ))}
      {excludedTypes.map((value) => (
        <input key={`hidden-excluded-${value}`} type="hidden" name="stay_types_excluded" value={value} />
      ))}
      {allowedSeasons.map((value) => (
        <input key={`hidden-season-${value}`} type="hidden" name="seasons_allowed" value={value} />
      ))}
    </div>
  );
}
