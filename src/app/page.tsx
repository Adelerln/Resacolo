import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const stats = [
  { label: 'Organisateurs partenaires', value: '12+' },
  { label: 'Séjours référencés', value: '300+' },
  { label: 'Enfants accompagnés', value: '15 000+' }
];

const highlights = [
  {
    title: 'Toutes les colos au même endroit',
    description:
      'Centralisez l’ensemble des offres des organisateurs partenaires pour proposer aux familles une expérience de recherche unifiée.'
  },
  {
    title: 'Mise à jour automatique',
    description:
      'Notre robot collecte les nouveautés publiées sur les sites des organisateurs et génère des fiches précises avec l’API OpenAI.'
  },
  {
    title: 'Filtres intelligents',
    description:
      'Les séjours sont tagués automatiquement (âge, thématiques, période, budget) pour simplifier l’orientation des familles.'
  }
];

export default function HomePage() {
  return (
    <div className="bg-gradient-to-b from-white to-slate-100">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-20 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl space-y-6">
          <span className="rounded-full bg-brand-50 px-4 py-1 text-sm font-semibold text-brand-700">
            Plateforme colonies de vacances
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Toutes les colonies de vacances partenaires en un seul endroit.
          </h1>
          <p className="text-lg text-slate-600">
            Cette plateforme agrège automatiquement les séjours proposés par les organisateurs membres et génère des
            fiches détaillées pour accompagner les familles et les collectivités.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/sejours"
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              Explorer les séjours <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-200 hover:text-brand-700"
            >
              Devenir partenaire
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:max-w-sm">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-2xl font-semibold text-brand-600">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-16 md:grid-cols-3">
        {highlights.map((item) => (
          <article key={item.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">{item.title}</h2>
            <p className="mt-3 text-sm text-slate-600">{item.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
