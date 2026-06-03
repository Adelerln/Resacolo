'use client';

import { useMemo, useState } from 'react';

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

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function withDisplayCaps(value: string) {
  const accentMap: Record<string, string> = {
    age: 'Âge',
    activite: 'Activité',
    activites: 'Activités',
    aout: 'Août',
    cote: 'Côte',
    ete: 'Été',
    ile: 'Île',
    iles: 'Îles',
    noel: 'Noël',
    sejour: 'Séjour',
    sejours: 'Séjours'
  };
  return value.replace(/\p{L}+/gu, (word) => {
    const normalized = word.toLowerCase();
    if (accentMap[normalized]) return accentMap[normalized];
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
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
      (option) => !filterInitialSelection(stayTypes, initialAllowed).some((allowed) => normalizeValue(allowed) === normalizeValue(option))
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
                    const isSelected = allowedTypes.some((item) => normalizeValue(item) === normalizeValue(option));
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
                      const isSelected = allowedSeasons.some((item) => normalizeValue(item) === normalizeValue(option));
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
                  const isSelected = excludedTypes.some((item) => normalizeValue(item) === normalizeValue(option));
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

      {!showStayTypes && showSeasons ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="text-sm font-semibold text-emerald-900">Saisons autorisées</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {seasons.map((option) => {
              const isSelected = allowedSeasons.some((item) => normalizeValue(item) === normalizeValue(option));
              return (
                <ToggleButton
                  key={`season-only-${option}`}
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
