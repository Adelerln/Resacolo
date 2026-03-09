'use client';

import Link from 'next/link';
import { ShoppingBag, Package, Eye, ChevronRight } from 'lucide-react';

/* Mock stats pour le dashboard */
const mockStats = {
  sejoursVendus: 127,
  sejoursRestants: 43,
  totalPlaces: 170
};

const mockTopViewed = [
  { title: 'Colo Aventure Pyrénées', views: 342 },
  { title: 'Stage voile Bretagne', views: 298 },
  { title: 'Multi-activités Jura', views: 256 },
  { title: 'Découverte ferme Normandie', views: 189 },
  { title: 'Cirque & théâtre Provence', views: 164 }
];

export default function BackOfficeDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Vue d&apos;ensemble de votre activité et des fonctionnalités disponibles.
        </p>
      </div>

      {/* Stats (mock) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Séjours vendus</p>
              <p className="font-display text-2xl font-bold text-slate-900">
                {mockStats.sejoursVendus}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Restants à vendre</p>
              <p className="font-display text-2xl font-bold text-slate-900">
                {mockStats.sejoursRestants}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total places</p>
              <p className="font-display text-2xl font-bold text-slate-900">
                {mockStats.totalPlaces}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Séjours les plus regardés */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Séjours les plus consultés
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Les fiches les plus vues par les visiteurs (données mock).
            </p>
          </div>
          <Link
            href="/back-office/sejours"
            className="hidden items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-600 sm:inline-flex"
          >
            Voir tous les séjours
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <ul className="divide-y divide-slate-100">
          {mockTopViewed.map((item, i) => (
            <li
              key={item.title}
              className="flex items-center justify-between px-6 py-3 hover:bg-slate-50/50"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 font-display text-xs font-bold text-slate-600">
                  {i + 1}
                </span>
                <span className="text-slate-800">{item.title}</span>
              </span>
              <span className="text-sm font-medium text-slate-500">
                {item.views} vues
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-100 px-6 py-3 sm:hidden">
          <Link
            href="/back-office/sejours"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-500"
          >
            Voir tous les séjours
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
