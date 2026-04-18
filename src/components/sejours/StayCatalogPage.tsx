'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Compass, Filter, Search, ShoppingCart, X } from 'lucide-react';
import { FavoriteToggleButton } from '@/components/favorites/FavoriteToggleButton';
import { OrganizerStayPreviewCard } from '@/components/organisateurs/OrganizerStayPreviewCard';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';
import { resolveStaySeasonPicto } from '@/lib/organizer-profile-options';
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
type MultiFilterKey = Exclude<keyof StayCatalogFilterState, 'q'>;

const ACCORDION_DEFAULT_OPEN = ['seasonIds', 'categories', 'ageBands', 'destinations', 'organizerIds'];

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
        locationLabel={stay.location || stay.region || 'Lieu à préciser'}
        ageRangeLabel={stay.ageRange || 'Tous âges'}
        seasonIconSrc={season.iconPath}
        seasonBadge={season.badgeText}
        durationLabel={stay.duration || 'Durée à venir'}
        priceFromEuros={stay.priceFrom}
        coverUrl={stay.coverImage || getMockImageUrl(mockImages.sejours.fallbackCover, 1200, 80)}
        href={`/sejours/${stay.canonicalSlug}`}
        organizerLogoUrl={stay.organizer.logoUrl ?? null}
        organizerName={stay.organizer.name}
        overlayAction={<FavoriteToggleButton stayId={stay.id} />}
        disableBlueHoverEffect
      />
    </div>
  );
}

function FiltersPanel({
  value,
  options,
  onSearchChange,
  onToggle,
  onReset,
  className
}: {
  value: StayCatalogFilterState;
  options: ReturnType<typeof buildStayCatalogFilterOptions>;
  onSearchChange: (value: string) => void;
  onToggle: (key: MultiFilterKey, option: string) => void;
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
    {
      key: 'ageBands',
      label: 'ÂGE DU PARTICIPANT',
      options: options.ageBands as unknown as StayCatalogFilterOption[]
    },
    { key: 'destinations', label: 'DESTINATIONS', options: options.destinations },
    { key: 'organizerIds', label: 'ORGANISATEURS', options: options.organizers }
  ];

  return (
    <aside
      className={`rounded-[1.6rem] border border-slate-200/85 bg-white p-4 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.45)] sm:p-5 ${className ?? ''}`}
    >
      <h2 className="text-2xl font-semibold text-slate-900">
        Filtrez <span className="text-accent-500">les séjours</span>
      </h2>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
        <input
          type="search"
          value={value.q}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Titre, destination, activité, organisateur..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:bg-white"
        />
      </div>

      <Accordion type="multiple" defaultValue={ACCORDION_DEFAULT_OPEN} className="mt-4">
        {filterGroups.map((group) => {
          const selectedCount = value[group.key].length;
          const selectedValues = value[group.key] as string[];

          return (
            <AccordionItem key={group.key} value={group.key}>
              <AccordionTrigger className="py-3 text-[13px] tracking-[0.08em] text-slate-900">
                <span className="inline-flex items-center gap-2">
                  {group.label}
                  {selectedCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 text-[11px] font-bold text-brand-700">
                      {selectedCount}
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                {group.options.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucune option disponible.</p>
                ) : (
                  <ul className="space-y-2">
                    {group.options.map((option) => (
                      <li key={option.value}>
                        <label className="flex items-start gap-2.5 rounded-lg px-1 py-1 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
                            checked={selectedValues.includes(option.value)}
                            onChange={() => onToggle(group.key, option.value)}
                          />
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <span className="min-w-0 truncate">{option.label}</span>
                            <span className="shrink-0 text-xs text-slate-500">{option.count}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
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
  const [randomSeed, setRandomSeed] = useState<number | null>(null);

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
    setFilters((previous) =>
      stayCatalogFilterStateKey(previous) === runtimeFiltersKey ? previous : runtimeFilters
    );
  }, [runtimeFilters, runtimeFiltersKey]);

  useEffect(() => {
    setSort((previous) => (previous === runtimeSort ? previous : runtimeSort));
  }, [runtimeSort]);

  useEffect(() => {
    setRandomSeed(Math.floor(Math.random() * 2_147_483_647));
  }, []);

  useEffect(() => {
    setFilters((previous) => {
      const next: StayCatalogFilterState = {
        ...previous,
        seasonIds: previous.seasonIds.filter((value) =>
          filterOptions.seasons.some((option) => option.value === value)
        ),
        categories: previous.categories.filter((value) =>
          filterOptions.categories.some((option) => option.value === value)
        ),
        ageBands: previous.ageBands.filter((value) =>
          filterOptions.ageBands.some((option) => option.value === value)
        ),
        destinations: previous.destinations.filter((value) =>
          filterOptions.destinations.some((option) => option.value === value)
        ),
        organizerIds: previous.organizerIds.filter((value) =>
          filterOptions.organizers.some((option) => option.value === value)
        )
      };

      return stayCatalogFilterStateKey(previous) === stayCatalogFilterStateKey(next) ? previous : next;
    });
  }, [filterOptions]);

  const debouncedQuery = useDebouncedValue(filters.q);
  const urlFilters = useMemo(
    () => ({
      ...filters,
      q: debouncedQuery
    }),
    [debouncedQuery, filters]
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

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 md:py-24">
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
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
            Colonies de vacances et séjours jeunes adultes
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/85 md:text-lg">
            Consultez les offres et trouvez la colonie idéale en quelques clics.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8">
          <div className="hidden xl:block">
            <FiltersPanel
              value={filters}
              options={panelOptions}
              onSearchChange={(nextValue) => setFilters((previous) => ({ ...previous, q: nextValue }))}
              onToggle={updateMultiFilter}
              onReset={resetFilters}
            />
          </div>

          <div>
            <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
              className="border-none p-0 shadow-none"
              onSearchChange={(nextValue) => setFilters((previous) => ({ ...previous, q: nextValue }))}
              onToggle={updateMultiFilter}
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
