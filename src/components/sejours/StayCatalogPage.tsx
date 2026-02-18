'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Compass, Clock3, Filter, MapPin, Search, ShoppingCart, Sun } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';

type MockStay = {
  slug: string;
  title: string;
  subtitle: string;
  location: string;
  age: string;
  season: string;
  duration: string;
  description: string;
  priceFrom: number;
  image: string;
  organizerLogo: string;
};

const mockStays: MockStay[] = [
  {
    slug: 'moto-rider',
    title: 'Moto Rider',
    subtitle: 'Stage de Moto',
    location: 'Beaumont, Saint-Cyr (86)',
    age: '6-17 ans',
    season: 'PRINTEMPS',
    duration: '8 jours',
    description:
      'Un séjour intensif pour progresser en motocross avec des ateliers techniques, des balades encadrées et des défis tout-terrain.',
    priceFrom: 689,
    image:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
    organizerLogo: '/image/logo-resacolo.png'
  },
  {
    slug: 'strasbourg-europa-park',
    title: 'Strasbourg - Europa Park',
    subtitle: 'Mini-séjour',
    location: 'Strasbourg & Europa Park',
    age: '6-17 ans',
    season: 'ÉTÉ',
    duration: '5 jours',
    description:
      'Découverte de Strasbourg puis immersion à Europa Park pour un programme rythmé entre culture urbaine et sensations fortes.',
    priceFrom: 559,
    image:
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80',
    organizerLogo: '/image/logo-resacolo.png'
  },
  {
    slug: 'dubai',
    title: 'Dubaï',
    subtitle: 'Aux portes du désert',
    location: 'Dubaï (Émirats Arabes Unis)',
    age: '14-17 ans',
    season: 'HIVER',
    duration: '10 jours',
    description:
      'Une aventure internationale entre métropole futuriste et escapades dans le désert, avec activités de groupe et visites guidées.',
    priceFrom: 1390,
    image:
      'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80',
    organizerLogo: '/image/logo-resacolo.png'
  }
];

const filterGroups = [
  { id: 'saison', label: 'SAISON', options: ['Printemps', 'Été', 'Toussaint', 'Hiver'] },
  { id: 'type', label: 'TYPE DE SÉJOUR', options: ['Sport', 'Aventure', 'Culture', 'Mini-séjour'] },
  { id: 'age', label: 'AGE DU PARTICIPANT', options: ['6-9 ans', '10-13 ans', '14-17 ans'] },
  { id: 'tarif', label: 'TARIF', options: ['< 500 €', '500 - 900 €', '900 - 1400 €', '> 1400 €'] },
  { id: 'destinations', label: 'DESTINATIONS', options: ['France', 'Europe', 'International'] },
  { id: 'duree', label: 'DURÉE', options: ['3-5 jours', '6-8 jours', '9 jours et +'] }
];

function FiltersPanel() {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">
        Filtrez <span className="text-[#F97316]">les séjours</span>
      </h2>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3B82F6]" />
        <input
          type="text"
          placeholder="Chercher un séjour..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-[#3B82F6]"
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
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#3B82F6]" />
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

function StayCard({ stay }: { stay: MockStay }) {
  return (
    <Card className="overflow-hidden rounded-3xl">
      <div className="relative h-56 w-full">
        <Image src={stay.image} alt={stay.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
        <div className="absolute right-3 top-3 h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-white shadow">
          <Image src={stay.organizerLogo} alt="Organisateur" fill className="object-contain p-1" sizes="44px" />
        </div>
        <span className="absolute bottom-3 left-3 rounded-full bg-[#F97316] px-3 py-1 text-xs font-semibold text-white">
          {stay.age}
        </span>
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#F97316]">
          <Sun className="h-3.5 w-3.5" />
          {stay.season}
        </span>
      </div>

      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#3B82F6]">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {stay.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {stay.duration}
          </span>
        </div>

        <div className="space-y-2 text-center">
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

        <p className="text-center text-xl font-bold text-[#F97316]">À partir de {stay.priceFrom} €</p>
      </CardContent>
    </Card>
  );
}

export function StayCatalogPage() {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=80"
            alt="Aventure nature"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-slate-900/60" />
        </div>

        <div className="pointer-events-none absolute left-6 top-8 md:left-16">
          <div className="relative">
            <Compass className="h-9 w-9 text-white" />
            <div className="absolute -left-4 top-7 h-24 w-24 rounded-full border-2 border-dashed border-white/70" />
            <div className="absolute left-8 top-16 h-20 w-32 rounded-full border-2 border-dashed border-white/50" />
          </div>
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-20 md:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">TOUS NOS SÉJOURS</p>
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
            <Filter className="h-4 w-4 text-[#3B82F6]" />
            Filtres
          </button>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
            <option>Tri aléatoire</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="hidden lg:block">
            <FiltersPanel />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-5 hidden items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 lg:flex">
              <p>Affichage de 1-36 sur 358 résultats</p>
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <option>Tri aléatoire</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {mockStays.map((stay) => (
                <StayCard key={stay.slug} stay={stay} />
              ))}
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
            <FiltersPanel />
          </div>
        </div>
      )}

      <button
        type="button"
        className="fixed bottom-6 right-6 z-[110] flex h-14 w-14 items-center justify-center rounded-full bg-[#F97316] text-white shadow-xl transition hover:bg-[#ea580c]"
        aria-label="Panier"
      >
        <ShoppingCart className="h-6 w-6" />
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#3B82F6] text-xs font-semibold text-white">
          0
        </span>
      </button>
    </div>
  );
}
