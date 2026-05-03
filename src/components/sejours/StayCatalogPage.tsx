'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Compass, Filter, Search, ShoppingCart, X } from 'lucide-react';
import { FavoriteToggleButton } from '@/components/favorites/FavoriteToggleButton';
import { OrganizerStayPreviewCard } from '@/components/organisateurs/OrganizerStayPreviewCard';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';
import { resolveStaySeasonPicto } from '@/lib/organizer-profile-options';
import { mapToCanonicalStayRegion } from '@/lib/stay-regions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import {
  EMPTY_STAY_CATALOG_FILTERS,
  DEFAULT_STAY_CATALOG_SORT,
  STAY_CATALOG_SORT_OPTIONS,
  applyStayCatalogFilters,
  applyStayCatalogSort,
  buildStayCatalogFilterOptions,
  countActiveStayCatalogFilters,
  parseStayCatalogFiltersFromSearchParams,
  parseStayCatalogSortFromSearchParams,
  serializeStayCatalogFiltersToSearchParams,
  stayCatalogFilterStateKey,
  type StayCatalogFilterOption,
  type StayCatalogFilterState,
  type StayCatalogSortValue
} from '@/lib/stay-catalog-filters';
import type { Stay } from '@/types/stay';

type SearchParamInput = Record<string, string | string[] | undefined> | undefined;
type MultiFilterKey =
  | 'seasonIds'
  | 'categories'
  | 'ageBands'
  | 'destinationTypes'
  | 'destinations'
  | 'organizerIds';

const ACCORDION_DEFAULT_OPEN = [
  'priceRange',
  'ageRange',
  'seasonIds',
  'categories',
  'destinationTypes',
  'destinations',
  'organizerIds'
];

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatEuros(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')}€`;
}

function formatAge(value: number) {
  return `${Math.round(value)} ans`;
}

function RangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  format
}: {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChange: (next: { min: number; max: number }) => void;
  format: (value: number) => string;
}) {
  const safeMin = clampNumber(valueMin, min, max);
  const safeMax = clampNumber(valueMax, min, max);
  const left = ((Math.min(safeMin, safeMax) - min) / Math.max(1, max - min)) * 100;
  const right = ((Math.max(safeMin, safeMax) - min) / Math.max(1, max - min)) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-slate-600">
        <span>{format(Math.min(safeMin, safeMax))}</span>
        <span>{format(Math.max(safeMin, safeMax))}</span>
      </div>
      <div className="relative h-8 overflow-visible px-2">
        <div className="absolute left-2 right-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent-500"
          style={{
            left: `calc(${left}% + 0.5rem)`,
            right: `calc(${100 - right}% + 0.5rem)`
          }}
        />

        <input
          type="range"
          min={min}
          max={max}
          value={Math.min(safeMin, safeMax)}
          onChange={(event) => {
            const nextMin = Number(event.target.value);
            onChange({ min: nextMin, max: Math.max(nextMin, safeMax) });
          }}
          className="pointer-events-none absolute left-0 top-0 z-20 h-8 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:ring-2 [&::-moz-range-thumb]:ring-accent-500 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-accent-500"
          aria-label="Valeur minimale"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={Math.max(safeMin, safeMax)}
          onChange={(event) => {
            const nextMax = Number(event.target.value);
            onChange({ min: Math.min(safeMin, nextMax), max: nextMax });
          }}
          className="pointer-events-none absolute left-0 top-0 z-30 h-8 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:ring-2 [&::-moz-range-thumb]:ring-accent-500 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-accent-500"
          aria-label="Valeur maximale"
        />
      </div>
    </div>
  );
}

function toUrlSearchParams(input: SearchParamInput) {
  const params = new URLSearchParams();
  if (!input) return params;

  Object.entries(input).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
      return;
    }

    if (typeof value === 'string') {
      params.append(key, value);
    }
  });

  return params;
}

function useDebouncedValue<TValue>(value: TValue, delayMs = 240) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function toggleListValue<TValue extends string>(list: TValue[], value: TValue) {
  if (list.includes(value)) {
    return list.filter((item) => item !== value);
  }
  return [...list, value];
}

function StayCard({ stay }: { stay: Stay }) {
  const season = resolveStaySeasonPicto(stay.seasonName || stay.period[0] || null);

  return (
    <div className="flex justify-center">
      <OrganizerStayPreviewCard
        title={stay.title}
        summary={stay.summary}
        description={stay.description}
        locationLabel={stay.displayLocation || stay.location || stay.region || 'Lieu à préciser'}
        ageRangeLabel={stay.ageRange || 'Tous âges'}
        seasonIconSrc={season.iconPath}
        seasonBadge={season.badgeText}
        durationLabel={stay.duration || 'Durée à venir'}
        priceFromEuros={stay.priceFrom}
        coverUrl={stay.coverImage || getMockImageUrl(mockImages.sejours.fallbackCover, 1200, 80)}
        href={`/sejours/${stay.canonicalSlug}`}
        organizerLogoUrl={stay.organizer.logoUrl ?? null}
        organizerName={stay.organizer.name}
        overlayAction={<FavoriteToggleButton stayId={stay.id} variant="overlay" />}
        disableBlueHoverEffect
        compact
        liftOnHover
      />
    </div>
  );
}

function FiltersPanel({
  value,
  options,
  bounds,
  onSearchChange,
  onToggle,
  onDestinationsChange,
  onAgeRangeChange,
  onPriceRangeChange,
  onReset,
  className
}: {
  value: StayCatalogFilterState;
  options: ReturnType<typeof buildStayCatalogFilterOptions>;
  bounds: {
    age: { min: number; max: number };
    price: { min: number; max: number };
  };
  onSearchChange: (value: string) => void;
  onToggle: (key: MultiFilterKey, option: string) => void;
  onDestinationsChange: (value: string | null) => void;
  onAgeRangeChange: (value: { min: number; max: number } | null) => void;
  onPriceRangeChange: (value: { min: number; max: number } | null) => void;
  onReset: () => void;
  className?: string;
}) {
  const filterGroups: Array<{
    key: MultiFilterKey;
    label: string;
    options: StayCatalogFilterOption[];
  }> = [
    { key: 'seasonIds', label: 'SAISON', options: options.seasons },
    { key: 'categories', label: 'TYPE DE SÉJOUR', options: options.categories },
    { key: 'destinationTypes', label: 'FORMAT DE DESTINATION', options: options.destinationTypes },
    { key: 'destinations', label: 'DESTINATIONS', options: options.destinations },
    { key: 'organizerIds', label: 'ORGANISATEURS', options: options.organizers }
  ];

  const renderFilterGroup = (groupKey: MultiFilterKey) => {
    const group = filterGroups.find((entry) => entry.key === groupKey);
    if (!group) return null;

    const selectedCount = value[group.key].length;
    const selectedValues = value[group.key] as string[];
    const selectedDestination = group.key === 'destinations' ? (selectedValues[0] ?? '') : '';

    const groupedDestinationOptions =
      group.key === 'destinations'
        ? group.options.reduce(
            (acc, option) => {
              const canonical = mapToCanonicalStayRegion(option.label);
              if (canonical && canonical !== 'Étranger') {
                acc.france.push(option);
              } else {
                acc.foreign.push(option);
              }
              return acc;
            },
            {
              france: [] as StayCatalogFilterOption[],
              foreign: [] as StayCatalogFilterOption[]
            }
          )
        : null;

    return (
      <AccordionItem key={group.key} value={group.key}>
        <AccordionTrigger className="py-2.5 text-[12px] tracking-[0.07em] text-slate-900">
          <span className="inline-flex items-center gap-2">
            {group.label}
            {selectedCount > 0 && (
              <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand-100 px-1 text-[10px] font-bold text-brand-700">
                {selectedCount}
              </span>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-1.5">
          {group.options.length === 0 ? (
            <p className="text-[11px] text-slate-500">Aucune option disponible.</p>
          ) : group.key === 'destinations' && groupedDestinationOptions ? (
            <div className="space-y-1.5">
              <select
                value={selectedDestination}
                onChange={(event) => onDestinationsChange(event.target.value ? event.target.value : null)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-brand-500"
                aria-label="Choisir une destination"
              >
                <option value="">Toutes destinations</option>
                {groupedDestinationOptions.france.length > 0 ? (
                  <optgroup label="France (régions)">
                    {groupedDestinationOptions.france.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {groupedDestinationOptions.foreign.length > 0 ? (
                  <optgroup label="Étranger (pays)">
                    {groupedDestinationOptions.foreign.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <p className="text-[11px] text-slate-500">Une seule destination sélectionnable à la fois.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {group.options.map((option) => (
                <li key={option.value}>
                  <label className="flex items-start gap-2 rounded-lg px-1 py-0.5 text-[13px] text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
                      checked={selectedValues.includes(option.value)}
                      onChange={() => onToggle(group.key, option.value)}
                    />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{option.label}</span>
                      <span className="shrink-0 text-[11px] text-slate-500">{option.count}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <aside
      className={`rounded-[1.25rem] border border-slate-200/85 bg-white p-3.5 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.45)] sm:p-4 ${className ?? ''}`}
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Filtrez <span className="text-accent-500">les séjours</span>
      </h2>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-600" />
        <input
          type="search"
          value={value.q}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Titre, destination, activité, organisateur..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-10 pr-3 text-[13px] text-slate-700 outline-none transition focus:border-brand-500 focus:bg-white"
        />
      </div>

      <Accordion type="multiple" defaultValue={ACCORDION_DEFAULT_OPEN} className="mt-3">
        {renderFilterGroup('seasonIds')}
        {renderFilterGroup('categories')}
        {renderFilterGroup('destinationTypes')}

        <AccordionItem value="ageRange">
          <AccordionTrigger className="py-2.5 text-[12px] tracking-[0.07em] text-slate-900">
            <span className="inline-flex items-center gap-2">
              ÂGE
              {(value.ageMin != null || value.ageMax != null) && (
                <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand-100 px-1 text-[10px] font-bold text-brand-700">
                  1
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-1.5">
            <RangeSlider
              min={bounds.age.min}
              max={bounds.age.max}
              valueMin={value.ageMin ?? bounds.age.min}
              valueMax={value.ageMax ?? bounds.age.max}
              format={formatAge}
              onChange={(next) => {
                const isDefault = next.min === bounds.age.min && next.max === bounds.age.max;
                onAgeRangeChange(isDefault ? null : next);
              }}
            />
          </AccordionContent>
        </AccordionItem>

        {renderFilterGroup('destinations')}

        <AccordionItem value="priceRange">
          <AccordionTrigger className="py-2.5 text-[12px] tracking-[0.07em] text-slate-900">
            <span className="inline-flex items-center gap-2">
              TARIF
              {(value.priceMin != null || value.priceMax != null) && (
                <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand-100 px-1 text-[10px] font-bold text-brand-700">
                  1
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-1.5">
            <RangeSlider
              min={bounds.price.min}
              max={bounds.price.max}
              valueMin={value.priceMin ?? bounds.price.min}
              valueMax={value.priceMax ?? bounds.price.max}
              format={formatEuros}
              onChange={(next) => {
                const isDefault = next.min === bounds.price.min && next.max === bounds.price.max;
                onPriceRangeChange(isDefault ? null : next);
              }}
            />
          </AccordionContent>
        </AccordionItem>

        {renderFilterGroup('organizerIds')}
      </Accordion>

      <button
        type="button"
        onClick={onReset}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
      >
        Réinitialisez vos choix
      </button>
    </aside>
  );
}

export function StayCatalogPage({
  stays = [],
  searchParams
}: {
  stays?: Stay[];
  searchParams?: SearchParamInput;
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const runtimeSearchParams = useSearchParams();

  const filterOptions = useMemo(() => buildStayCatalogFilterOptions(stays), [stays]);
  const initialSearchParams = useMemo(() => toUrlSearchParams(searchParams), [searchParams]);
  const initialFilters = useMemo(
    () => parseStayCatalogFiltersFromSearchParams(initialSearchParams, filterOptions),
    [initialSearchParams, filterOptions]
  );
  const initialSort = useMemo(
    () => parseStayCatalogSortFromSearchParams(initialSearchParams),
    [initialSearchParams]
  );
  const [filters, setFilters] = useState<StayCatalogFilterState>(initialFilters);
  const [sort, setSort] = useState<StayCatalogSortValue>(initialSort);
  const [randomSeed] = useState<number>(() => Math.floor(Math.random() * 2_147_483_647));

  const sliderBounds = useMemo(() => {
    const ageMins = stays.map((s) => s.ageMin).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const ageMaxs = stays.map((s) => s.ageMax).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const priceValues = stays
      .map((s) => s.priceFrom)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);

    const ageMin = ageMins.length ? Math.max(0, Math.min(...ageMins)) : 3;
    const ageMax = ageMaxs.length ? Math.max(...ageMaxs) : 25;
    const priceMin = priceValues.length ? Math.max(0, Math.min(...priceValues)) : 0;
    const priceMax = priceValues.length ? Math.max(...priceValues) : 5000;

    return {
      age: { min: Math.floor(ageMin), max: Math.ceil(Math.max(ageMin, ageMax)) },
      price: { min: Math.floor(priceMin), max: Math.ceil(Math.max(priceMin, priceMax)) }
    };
  }, [stays]);

  const runtimeFilters = useMemo(
    () => parseStayCatalogFiltersFromSearchParams(runtimeSearchParams, filterOptions),
    [runtimeSearchParams, filterOptions]
  );
  const runtimeSort = useMemo(
    () => parseStayCatalogSortFromSearchParams(runtimeSearchParams),
    [runtimeSearchParams]
  );
  const runtimeFiltersKey = useMemo(() => stayCatalogFilterStateKey(runtimeFilters), [runtimeFilters]);
  const runtimeQuery = runtimeSearchParams.toString();

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setFilters((previous) =>
        stayCatalogFilterStateKey(previous) === runtimeFiltersKey ? previous : runtimeFilters
      );
      setSort((previous) => (previous === runtimeSort ? previous : runtimeSort));
    });
    return () => {
      cancelled = true;
    };
  }, [runtimeFilters, runtimeFiltersKey, runtimeSort]);

  const debouncedQuery = useDebouncedValue(filters.q);
  const urlFilters = useMemo(
    () => {
      const ageMin = filters.ageMin;
      const ageMax = filters.ageMax;
      const priceMin = filters.priceMin;
      const priceMax = filters.priceMax;

      const ageIsDefault =
        ageMin != null &&
        ageMax != null &&
        ageMin === sliderBounds.age.min &&
        ageMax === sliderBounds.age.max;

      const priceIsDefault =
        priceMin != null &&
        priceMax != null &&
        priceMin === sliderBounds.price.min &&
        priceMax === sliderBounds.price.max;

      return {
        q: debouncedQuery,
        seasonIds: filters.seasonIds,
        categories: filters.categories,
        destinationTypes: filters.destinationTypes,
        destinations: filters.destinations,
        organizerIds: filters.organizerIds,
        ageBands: filters.ageBands,
        ageMin: ageIsDefault ? null : ageMin,
        ageMax: ageIsDefault ? null : ageMax,
        priceMin: priceIsDefault ? null : priceMin,
        priceMax: priceIsDefault ? null : priceMax
      };
    },
    [
      debouncedQuery,
      filters.categories,
      filters.destinationTypes,
      filters.destinations,
      filters.organizerIds,
      filters.seasonIds,
      filters.ageBands,
      filters.ageMin,
      filters.ageMax,
      filters.priceMin,
      filters.priceMax,
      sliderBounds.age.min,
      sliderBounds.age.max,
      sliderBounds.price.min,
      sliderBounds.price.max
    ]
  );
  const urlFiltersKey = useMemo(
    () => stayCatalogFilterStateKey(urlFilters),
    [urlFilters]
  );
  const activeFilterCount = useMemo(
    () => countActiveStayCatalogFilters(filters),
    [filters]
  );

  useEffect(() => {
    const params = serializeStayCatalogFiltersToSearchParams(urlFilters);
    if (sort !== DEFAULT_STAY_CATALOG_SORT) {
      params.set('sort', sort);
    }
    const nextQuery = params.toString();
    if (nextQuery === runtimeQuery) return;

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [sort, urlFilters, urlFiltersKey, pathname, router, runtimeQuery]);

  const filteredStays = useMemo(
    () => applyStayCatalogFilters(stays, filters),
    [stays, filters]
  );
  const panelOptions = useMemo(() => {
    function withSelectedFallbacks<TOption extends StayCatalogFilterOption>(
      computed: TOption[],
      fallback: TOption[],
      selectedValues: string[]
    ) {
      if (selectedValues.length === 0) return computed;

      const computedValues = new Set(computed.map((option) => option.value));
      const extras = selectedValues
        .filter((selectedValue) => !computedValues.has(selectedValue))
        .map((selectedValue) => fallback.find((option) => option.value === selectedValue))
        .filter((option): option is TOption => Boolean(option))
        .map((option) => ({ ...option, count: 0 } as TOption));

      if (extras.length === 0) return computed;
      return [...computed, ...extras];
    }

    const seasonBase = buildStayCatalogFilterOptions(
      applyStayCatalogFilters(stays, { ...filters, seasonIds: [] })
    ).seasons;
    const categoryBase = buildStayCatalogFilterOptions(
      applyStayCatalogFilters(stays, { ...filters, categories: [] })
    ).categories;
    const ageBandBase = buildStayCatalogFilterOptions(
      applyStayCatalogFilters(stays, { ...filters, ageBands: [] })
    ).ageBands;
    const destinationTypeBase = buildStayCatalogFilterOptions(
      applyStayCatalogFilters(stays, { ...filters, destinationTypes: [] })
    ).destinationTypes;
    const destinationBase = buildStayCatalogFilterOptions(
      applyStayCatalogFilters(stays, { ...filters, destinations: [] })
    ).destinations;
    const organizerBase = buildStayCatalogFilterOptions(
      applyStayCatalogFilters(stays, { ...filters, organizerIds: [] })
    ).organizers;

    return {
      ...filterOptions,
      seasons: withSelectedFallbacks(seasonBase, filterOptions.seasons, filters.seasonIds),
      categories: withSelectedFallbacks(categoryBase, filterOptions.categories, filters.categories),
      ageBands: withSelectedFallbacks(ageBandBase, filterOptions.ageBands, filters.ageBands),
      destinationTypes: withSelectedFallbacks(
        destinationTypeBase,
        filterOptions.destinationTypes,
        filters.destinationTypes
      ),
      destinations: withSelectedFallbacks(destinationBase, filterOptions.destinations, filters.destinations),
      organizers: withSelectedFallbacks(organizerBase, filterOptions.organizers, filters.organizerIds)
    };
  }, [filterOptions, filters, stays]);
  const sortedStays = useMemo(
    () => applyStayCatalogSort(filteredStays, sort, { randomSeed }),
    [filteredStays, randomSeed, sort]
  );

  const updateMultiFilter = (key: MultiFilterKey, optionValue: string) => {
    setFilters((previous) => ({
      ...previous,
      [key]: toggleListValue(previous[key], optionValue)
    }));
  };

  const setDestination = (next: string | null) => {
    setFilters((previous) => ({
      ...previous,
      destinations: next ? [next] : []
    }));
  };

  const setAgeRange = (next: { min: number; max: number } | null) => {
    setFilters((previous) => ({
      ...previous,
      ageMin: next ? next.min : null,
      ageMax: next ? next.max : null,
      ageBands: []
    }));
  };

  const setPriceRange = (next: { min: number; max: number } | null) => {
    setFilters((previous) => ({
      ...previous,
      priceMin: next ? next.min : null,
      priceMax: next ? next.max : null
    }));
  };

  const resetFilters = () => {
    setFilters(EMPTY_STAY_CATALOG_FILTERS);
  };

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={getMockImageUrl(mockImages.sejours.hero, 1800, 80)}
            alt="Aventure nature"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-slate-900/60" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
            <span className="relative inline-flex items-center gap-3">
              <span className="relative z-10 inline-flex items-center gap-2">
                <Compass className="h-5 w-5 text-white/95" aria-hidden />
                TOUS NOS SÉJOURS
              </span>
              <span
                aria-hidden
                className="absolute -inset-x-4 -inset-y-3 rounded-full border-2 border-dashed border-white/60"
              />
            </span>
          </p>
          <h1 className="mt-3 max-w-3xl text-2xl font-extrabold leading-tight text-white sm:text-3xl md:text-4xl">
            Colonies de vacances et séjours jeunes adultes
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/85 md:text-base">
            Consultez les offres et trouvez la colonie idéale en quelques clics.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-9">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 xl:hidden">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <Filter className="h-4 w-4 text-brand-600" />
            Filtres
            {activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 text-xs font-bold text-brand-700">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[304px_minmax(0,1fr)] xl:gap-7">
          <div className="hidden xl:block">
            <FiltersPanel
              value={filters}
              options={panelOptions}
              bounds={sliderBounds}
              onSearchChange={(nextValue) => setFilters((previous) => ({ ...previous, q: nextValue }))}
              onToggle={updateMultiFilter}
              onDestinationsChange={setDestination}
              onAgeRangeChange={setAgeRange}
              onPriceRangeChange={setPriceRange}
              onReset={resetFilters}
            />
          </div>

          <div>
            <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                {sortedStays.length} séjour{sortedStays.length > 1 ? 's' : ''} trouvé
                {sortedStays.length > 1 ? 's' : ''} sur {stays.length}
              </p>
              <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Trier par
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as StayCatalogSortValue)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none transition focus:border-brand-500"
                >
                  {STAY_CATALOG_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {sortedStays.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/40 p-10 text-center">
                <p className="text-base font-semibold text-slate-800">
                  Aucun séjour ne correspond à votre recherche.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Modifiez un ou plusieurs filtres pour élargir les résultats.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {sortedStays.map((stay) => (
                  <StayCard key={stay.id} stay={stay} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[120] xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45"
            onClick={() => setMobileFiltersOpen(false)}
            aria-label="Fermer le panneau de filtres"
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-[420px] overflow-y-auto bg-white p-4 shadow-xl sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-semibold text-slate-900">Filtres</p>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <FiltersPanel
              value={filters}
              options={panelOptions}
              bounds={sliderBounds}
              className="border-none p-0 shadow-none"
              onSearchChange={(nextValue) => setFilters((previous) => ({ ...previous, q: nextValue }))}
              onToggle={updateMultiFilter}
              onDestinationsChange={setDestination}
              onAgeRangeChange={setAgeRange}
              onPriceRangeChange={setPriceRange}
              onReset={resetFilters}
            />
            <button
              type="button"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
              onClick={() => setMobileFiltersOpen(false)}
            >
              Voir les résultats
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="fixed bottom-4 right-4 z-[110] flex h-12 w-12 items-center justify-center rounded-full bg-accent-500 text-white shadow-xl transition hover:bg-accent-600 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
        aria-label="Panier"
      >
        <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          0
        </span>
      </button>
    </div>
  );
}
