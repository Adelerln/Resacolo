'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Palette,
  MapPin,
  Users,
  Clock,
  Phone,
  MapPin as PinIcon,
  Bus,
  Bed,
  CheckCircle,
  User
} from 'lucide-react';
import type { Stay } from '@/types/stay';
import { FILTER_LABELS } from '@/lib/constants';

type TabId = 'programme' | 'activites' | 'encadrement';

function formatLabel(group: keyof typeof FILTER_LABELS, value: string) {
  return FILTER_LABELS[group][value as keyof (typeof FILTER_LABELS)[typeof group]] ?? value;
}

function formatPrice(price?: number | null) {
  if (!price) return 'Sur demande';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

// Build a simple programme from description (split by double newline or "Jour")
function getProgrammeBlocks(description: string): { title?: string; text: string }[] {
  const trimmed = description.trim();
  const byDay = trimmed.split(/(?=Jour \d+)/i).filter(Boolean);
  if (byDay.length > 1) {
    return byDay.map((block) => {
      const match = block.match(/^(Jour \d+[^\n]*)\n?([\s\S]*)$/i);
      if (match) return { title: match[1].trim(), text: match[2].trim() };
      return { text: block.trim() };
    });
  }
  return [{ text: trimmed }];
}

const DEFAULT_GALLERY = [
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1528543606781-2f6e6857f318?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=600&q=80'
];

export function StayDetailView({ stay }: { stay: Stay }) {
  const [activeTab, setActiveTab] = useState<TabId>('programme');
  const galleryImages = stay.coverImage
    ? [stay.coverImage, DEFAULT_GALLERY[1], DEFAULT_GALLERY[2]]
    : DEFAULT_GALLERY;
  const programmeBlocks = getProgrammeBlocks(stay.description);
  const firstCategory = stay.filters.categories[0];
  const themeLabel = firstCategory ? formatLabel('categories', firstCategory) : stay.title;

  return (
    <div className="min-h-screen bg-white">
      {/* Banner */}
      <section className="relative h-[280px] w-full overflow-hidden sm:h-[320px] md:h-[380px]">
        <Image
          src={stay.coverImage || galleryImages[0]}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-slate-900/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl md:text-6xl">
            {stay.title}
          </h1>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          {/* Main column */}
          <article>
            {/* Meta line */}
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
              <span className="flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-accent-500" aria-hidden />
                {themeLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-accent-500" aria-hidden />
                {stay.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-accent-500" aria-hidden />
                {stay.ageRange}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-accent-500" aria-hidden />
                {stay.duration}
              </span>
            </div>

            <p className="mb-8 max-w-3xl text-base leading-relaxed text-slate-600">{stay.summary}</p>

            {/* Gallery */}
            <div className="mb-10 grid grid-cols-3 gap-2 sm:gap-3">
              {galleryImages.slice(0, 3).map((src, i) => (
                <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 33vw, 280px"
                  />
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              {(
                [
                  { id: 'programme' as TabId, label: 'Programme' },
                  { id: 'activites' as TabId, label: 'Activités' },
                  { id: 'encadrement' as TabId, label: 'Encadrement' }
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === id
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {id === 'programme' ? stay.title : label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="prose prose-slate max-w-none">
              {activeTab === 'programme' && (
                <section className="space-y-6">
                  <h2 className="font-display text-xl font-semibold text-slate-900">
                    {stay.title} — Programme
                  </h2>
                  <div className="space-y-4 text-slate-600">
                    {programmeBlocks.map((block, i) => (
                      <div key={i}>
                        {block.title && (
                          <h3 className="mb-1 font-semibold text-slate-800">{block.title}</h3>
                        )}
                        <p className="whitespace-pre-line text-sm leading-relaxed">{block.text}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeTab === 'activites' && (
                <section className="space-y-4">
                  <h2 className="font-display text-xl font-semibold text-slate-900">Activités</h2>
                  <ul className="list-disc space-y-2 pl-6 text-slate-600">
                    {stay.highlights.length > 0 ? (
                      stay.highlights.map((item, i) => (
                        <li key={i} className="text-sm leading-relaxed">
                          {item}
                        </li>
                      ))
                    ) : (
                      <li className="text-sm">Découverte, loisirs et activités encadrées.</li>
                    )}
                  </ul>
                </section>
              )}

              {activeTab === 'encadrement' && (
                <section className="space-y-4">
                  <h2 className="font-display text-xl font-semibold text-slate-900">Encadrement</h2>
                  <p className="text-sm leading-relaxed text-slate-600">
                    L&apos;équipe d&apos;encadrement est composée de professionnels qualifiés et
                    diplômés. Les effectifs respectent les taux d&apos;encadrement réglementaires.
                    Pour toute question, contactez directement l&apos;organisateur du séjour.
                  </p>
                </section>
              )}
            </div>

            {/* Video placeholder */}
            <div className="mt-12 flex aspect-video items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <span className="text-sm font-medium">Ici, votre vidéo.</span>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Informations & Réservation
              </h2>
              <p className="mt-2 text-2xl font-bold text-accent-600">
                À partir de {formatPrice(stay.priceFrom)}
              </p>

              <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label htmlFor="dates" className="mb-1 block text-sm font-medium text-slate-700">
                    Dates du séjour
                  </label>
                  <select
                    id="dates"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <option>Sélectionner une date</option>
                    <option>Été 2025</option>
                    <option>Toussaint 2025</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="participants" className="mb-1 block text-sm font-medium text-slate-700">
                    Nombre de participants
                  </label>
                  <select
                    id="participants"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="options" className="mb-1 block text-sm font-medium text-slate-700">
                    Options supplémentaires
                  </label>
                  <select
                    id="options"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <option>Aucune</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="age" className="mb-1 block text-sm font-medium text-slate-700">
                    Âge des participants
                  </label>
                  <input
                    id="age"
                    type="text"
                    placeholder="Ex. 10 ans"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label htmlFor="promo" className="mb-1 block text-sm font-medium text-slate-700">
                    Code promo
                  </label>
                  <input
                    id="promo"
                    type="text"
                    placeholder="Optionnel"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400"
                  />
                </div>
                <a
                  href={stay.sourceUrl ?? stay.organizer.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:bg-accent-600"
                >
                  Réserver maintenant
                </a>
              </form>

              <div className="mt-6 flex items-center gap-3 text-sm text-slate-600">
                <Phone className="h-4 w-4 shrink-0 text-accent-500" />
                <span>Contactez-nous pour plus d&apos;informations</span>
              </div>
            </div>

            {/* Lieux de séjour */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-display flex items-center gap-2 text-base font-semibold text-slate-900">
                <PinIcon className="h-4 w-4 text-accent-500" />
                Lieux de séjour
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Bus className="h-4 w-4 text-slate-400" />
                  Tour et transports
                </li>
                <li className="flex items-center gap-2">
                  <Bed className="h-4 w-4 text-slate-400" />
                  Hébergement
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-slate-400" />
                  Activités
                </li>
              </ul>
            </div>

            {/* Organisateur */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-display flex items-center gap-2 text-base font-semibold text-slate-900">
                <User className="h-4 w-4 text-accent-500" />
                Organisateur du séjour
              </h3>
              <div className="mt-3 flex items-center gap-4">
                {stay.organizer.logoUrl ? (
                  <div className="relative h-14 w-14 overflow-hidden rounded-full bg-slate-100">
                    <Image
                      src={stay.organizer.logoUrl}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-600">
                    {stay.organizer.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-900">{stay.organizer.name}</p>
                  <a
                    href={stay.organizer.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand-600 hover:underline"
                  >
                    Voir le site
                  </a>
                </div>
              </div>
              <Link
                href="/organisateurs"
                className="mt-4 inline-block rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
              >
                Voir tous les séjours
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
