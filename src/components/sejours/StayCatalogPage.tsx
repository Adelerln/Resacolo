'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Compass, Clock3, Filter, MapPin, Search, ShoppingCart, Sun } from 'lucide-react';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { FILTER_LABELS } from '@/lib/constants';
import type { Stay } from '@/types/stay';

type StayCardData = {
  slug: string;
  title: string;
  subtitle: string;
  location: string;
  age: string;
  season: string;
  duration: string;
  description: string;
  priceFrom: number | null;
  image: string;
  organizerLogo: string | null;
};

type NormalizedStay = StayCardData & {
  categoryValues: string[];
  periodValues: string[];
  seasonLabels: string[];
  ageLabels: string[];
};

const filterGroups = [
  { id: 'season', label: 'SAISON', options: ['Printemps', 'Été', 'Toussaint', 'Hiver'] },
  { id: 'age', label: 'AGE DU PARTICIPANT', options: ['6-9 ans', '10-13 ans', '14-17 ans'] }
] as const;

type FilterState = {
  season: Set<string>;
  age: Set<string>;
};

function FiltersPanel({
  filters,
  onToggle
}: {
  filters: FilterState;
  onToggle: (groupId: keyof FilterState, option: string) => void;
}) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">
        Filtrez <span className="text-accent-500">les séjours</span>
      </h2>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
        <input
          type="text"
          placeholder="Chercher un séjour..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-brand-600"
        />
      </div>

      <Accordion type="multiple" className="mt-4">
        {filterGroups.map((group) => (
          <AccordionItem key={group.id} value={group.id}>
            <AccordionTrigger>{group.label}</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {group.options.map((option) => (
                  <li key={option}>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-brand-600"
                        checked={filters[group.id as keyof FilterState].has(option)}
                        onChange={() => onToggle(group.id as keyof FilterState, option)}
                      />
                      {option}
                    </label>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </aside>
  );
}

function StayCard({ stay }: { stay: StayCardData }) {
  const organizerLogo = stay.organizerLogo ?? '/image/logo-resacolo.png';
  const priceLabel =
    typeof stay.priceFrom === 'number' ? `À partir de ${stay.priceFrom} €` : 'Sur demande';

  return (
    <Link href={`/sejours/${stay.slug}`} className="block transition-opacity hover:opacity-95">
      <Card className="overflow-hidden rounded-3xl">
        <div className="relative h-56 w-full">
          <Image
            src={stay.image}
            alt={stay.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute right-3 top-3 h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-white shadow">
            <Image
              src={organizerLogo}
              alt="Organisateur"
              fill
              className="object-contain p-1"
              sizes="44px"
            />
          </div>
          <span className="absolute bottom-3 left-3 rounded-full bg-accent-500 px-3 py-1 text-xs font-semibold text-white">
            {stay.age}
          </span>
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-accent-500">
            <Sun className="h-3.5 w-3.5" />
            {stay.season}
          </span>
        </div>

        <CardContent className="space-y-4 p-4 pt-6">
          <div className="flex items-center justify-between gap-3 whitespace-nowrap text-xs font-medium text-brand-600">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span className="min-w-0 truncate">{stay.location}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {stay.duration}
            </span>
          </div>

          <div className="space-y-2 pt-1 text-center">
            <CardTitle className="text-xl font-bold text-slate-900">{stay.title}</CardTitle>
            <CardDescription className="text-sm text-slate-500">{stay.subtitle}</CardDescription>
            <p
              className="text-sm leading-6 text-slate-600"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {stay.description}
            </p>
          </div>
          <p className="text-center text-xl font-bold text-accent-500">{priceLabel}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function StayCatalogPage({ stays = [] }: { stays?: Stay[] }) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>({
    season: new Set(),
    age: new Set()
  });

  const toggleFilter = (groupId: keyof FilterState, option: string) => {
    setFilters((prev) => {
      const next = new Map<keyof FilterState, Set<string>>([
        ['season', new Set(prev.season)],
        ['age', new Set(prev.age)]
      ]);
      const set = next.get(groupId)!;
      if (set.has(option)) {
        set.delete(option);
      } else {
        set.add(option);
      }
      return {
        season: next.get('season')!,
        age: next.get('age')!
      };
    });
  };

  const normalizedStays: NormalizedStay[] = stays.map((stay) => {
    const seasonLabels =
      stay.filters.periods.length > 0
        ? stay.filters.periods.map((period) => FILTER_LABELS.periods[period])
        : stay.period.length > 0
          ? stay.period
          : ['À venir'];

    const ageLabels = stay.filters.audiences.length
      ? stay.filters.audiences
          .map((audience) => {
            if (audience === '6-9') return '6-9 ans';
            if (audience === '10-12') return '10-13 ans';
            return '14-17 ans';
          })
          .filter(Boolean)
      : stay.ageRange
        ? [stay.ageRange]
        : ['Tous âges'];

    return {
      slug: stay.slug,
      title: stay.title,
      subtitle: stay.organizer.name,
      location: stay.location || 'Lieu à préciser',
      age: stay.ageRange || 'Tous âges',
      season: seasonLabels[0] ?? 'À venir',
      duration: stay.duration || 'Durée à venir',
      description: stay.summary || stay.description,
      priceFrom: stay.priceFrom,
      image: stay.coverImage || getMockImageUrl(mockImages.sejours.fallbackCover, 1200, 80),
      organizerLogo: stay.organizer.logoUrl ?? null,
      categoryValues: stay.filters.categories,
      periodValues: stay.filters.periods,
      seasonLabels,
      ageLabels
    };
  });

  const routeCategories = searchParams
    .getAll('categories')
    .flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean));
  const routePeriods = searchParams
    .getAll('periods')
    .flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean));
  const routeQuery = searchParams.get('q')?.trim().toLowerCase() ?? '';

  const filteredStays = normalizedStays.filter((stay) => {
    const seasonActive = filters.season.size > 0;
    const ageActive = filters.age.size > 0;
    const routeCategoriesActive = routeCategories.length > 0;
    const routePeriodsActive = routePeriods.length > 0;
    const routeQueryActive = routeQuery.length > 0;

    const seasonOk =
      !seasonActive || stay.seasonLabels.some((label: string) => filters.season.has(label));
    const ageOk =
      !ageActive || stay.ageLabels.some((label: string) => filters.age.has(label));
    const routeCategoriesOk =
      !routeCategoriesActive ||
      routeCategories.some((category) => stay.categoryValues.includes(category));
    const routePeriodsOk =
      !routePeriodsActive || routePeriods.some((period) => stay.periodValues.includes(period));
    const routeQueryOk =
      !routeQueryActive ||
      `${stay.title} ${stay.subtitle} ${stay.location} ${stay.description}`.toLowerCase().includes(routeQuery);

    return seasonOk && ageOk && routeCategoriesOk && routePeriodsOk && routeQueryOk;
  });

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

        <div className="relative mx-auto max-w-7xl px-6 py-20 md:py-28">
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
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight text-white md:text-5xl">
            Colonies de vacances et séjours jeunes adultes
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/85 md:text-lg">
            Consultez les offres et réservez la colonie de vacances idéale pour votre enfant
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <Filter className="h-4 w-4 text-brand-600" />
            Filtres
          </button>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
            <option>Tri aléatoire</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="hidden lg:block">
            <FiltersPanel filters={filters} onToggle={toggleFilter} />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-5 hidden items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 lg:flex">
              <p>
                Affichage de 1-{filteredStays.length} sur {normalizedStays.length} résultats
              </p>
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <option>Tri aléatoire</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {filteredStays.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Aucun séjour disponible pour les filtres sélectionnés.
                </p>
              ) : (
                filteredStays.map((stay) => <StayCard key={stay.slug} stay={stay} />)
              )}
            </div>
          </div>
        </div>
      </section>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[120] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45"
            onClick={() => setMobileFiltersOpen(false)}
            aria-label="Fermer le panneau de filtres"
          />
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-semibold text-slate-900">Filtres</p>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600"
              >
                Fermer
              </button>
            </div>
            <FiltersPanel filters={filters} onToggle={toggleFilter} />
          </div>
        </div>
      )}

      <button
        type="button"
        className="fixed bottom-6 right-6 z-[110] flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white shadow-xl transition hover:bg-accent-600"
        aria-label="Panier"
      >
        <ShoppingCart className="h-6 w-6" />
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          0
        </span>
      </button>
    </div>
  );
}
