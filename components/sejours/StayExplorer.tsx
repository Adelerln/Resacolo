'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Stay } from '@/types/stay';
import { StayFilters, StayFilterState } from '@/components/sejours/StayFilters';
import { StayList } from '@/components/sejours/StayList';
import { FILTER_LABELS } from '@/lib/constants';
import type { StayAudience, StayCategory, StayDuration, StayFilters as StayFiltersMeta } from '@/types/stay';

type StayPeriod = StayFiltersMeta['periods'][number];
type StayTransport = StayFiltersMeta['transport'][number];

const CATEGORY_VALUES = Object.keys(FILTER_LABELS.categories) as StayCategory[];
const AUDIENCE_VALUES = Object.keys(FILTER_LABELS.audiences) as StayAudience[];
const DURATION_VALUES = Object.keys(FILTER_LABELS.durations) as StayDuration[];
const PERIOD_VALUES = Object.keys(FILTER_LABELS.periods) as StayPeriod[];
const TRANSPORT_VALUES = Object.keys(FILTER_LABELS.transport) as StayTransport[];

function parseSearchParams(params: URLSearchParams): StayFilterState {
  const getList = (key: string) => params.getAll(key).flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean));
  const getTypedList = <Value extends string>(key: string, allowed: readonly Value[]): Value[] =>
    getList(key).filter((item): item is Value => allowed.includes(item as Value));

  const q = params.get('q') ?? undefined;
  const priceMaxRaw = params.get('priceMax');
  const priceMax = priceMaxRaw ? Number.parseInt(priceMaxRaw, 10) : undefined;

  return {
    q,
    categories: getTypedList('categories', CATEGORY_VALUES),
    audiences: getTypedList('audiences', AUDIENCE_VALUES),
    durations: getTypedList('durations', DURATION_VALUES),
    periods: getTypedList('periods', PERIOD_VALUES),
    transport: getTypedList('transport', TRANSPORT_VALUES),
    organizer: getList('organizer'),
    priceMax: Number.isFinite(priceMax) ? priceMax : undefined
  };
}

function buildSearchParams(state: StayFilterState) {
  const params = new URLSearchParams();

  if (state.q) params.set('q', state.q);
  if (state.priceMax) params.set('priceMax', state.priceMax.toString());

  const setList = (key: keyof StayFilterState) => {
    const values = state[key];
    if (Array.isArray(values) && values.length) {
      params.set(key, values.join(','));
    }
  };

  setList('categories');
  setList('audiences');
  setList('durations');
  setList('periods');
  setList('transport');
  setList('organizer');

  return params;
}

function applyFilters(stays: Stay[], filters: StayFilterState) {
  return stays.filter((stay) => {
    if (filters.q) {
      const haystack = `${stay.title} ${stay.summary} ${stay.description} ${stay.location}`.toLowerCase();
      if (!haystack.includes(filters.q.toLowerCase())) {
        return false;
      }
    }

    if (filters.categories.length && !filters.categories.some((category) => stay.filters.categories.includes(category))) {
      return false;
    }

    if (filters.audiences.length && !filters.audiences.some((audience) => stay.filters.audiences.includes(audience))) {
      return false;
    }

    if (filters.durations.length && !filters.durations.some((duration) => stay.filters.durations.includes(duration))) {
      return false;
    }

    if (filters.periods.length && !filters.periods.some((period) => stay.filters.periods.includes(period))) {
      return false;
    }

    if (filters.transport.length && !filters.transport.some((transport) => stay.filters.transport.includes(transport))) {
      return false;
    }

    if (filters.organizer.length && !filters.organizer.some((organizer) => stay.organizer.name === organizer)) {
      return false;
    }

    if (filters.priceMax && stay.priceFrom && stay.priceFrom > filters.priceMax) {
      return false;
    }

    return true;
  });
}

interface StayExplorerProps {
  stays: Stay[];
}

const emptyFilters: StayFilterState = {
  q: undefined,
  categories: [],
  audiences: [],
  durations: [],
  periods: [],
  transport: [],
  organizer: [],
  priceMax: undefined
};

export function StayExplorer({ stays }: StayExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialFilters = useMemo(() => ({ ...emptyFilters, ...parseSearchParams(searchParams) }), [searchParams]);

  const [filters, setFilters] = useState<StayFilterState>(initialFilters);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    const params = buildSearchParams(filters);
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.replace(url, { scroll: false });
  }, [filters, pathname, router]);

  const filtered = useMemo(() => applyFilters(stays, filters), [stays, filters]);

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <StayFilters
        value={filters}
        onChange={setFilters}
        onReset={() => setFilters(emptyFilters)}
      />
      <div className="space-y-4">
        <header className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
          <p>
            {filtered.length} séjour{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
          </p>
          <p>
            Dernière mise à jour {filtered.length ? new Date(Math.max(...filtered.map((stay) => new Date(stay.updatedAt).getTime()))).toLocaleDateString('fr-FR') : '—'}
          </p>
        </header>
        <StayList stays={filtered} />
      </div>
    </div>
  );
}
