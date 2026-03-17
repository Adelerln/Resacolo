import { Heart, Mail, MapPin, CalendarDays, UserRound, ShieldCheck, Settings } from 'lucide-react';
import Link from 'next/link';

const mockUser = {
  name: 'Marie Dupont',
  email: 'marie.dupont@example.com',
  city: 'Lyon, France'
};

const mockUpcoming = [
  {
    id: '1',
    title: 'Colonie multi-activités – Alpes',
    dates: '12 au 19 août 2026',
    child: 'Léo, 11 ans',
    organizer: 'Aventures Vacances Énergie',
    status: 'Dossier en cours'
  }
];

const mockFavorites = [
  {
    id: 'fav-1',
    title: 'Séjour surf & océan',
    age: '14–17 ans',
    location: 'Landes, France'
  },
  {
    id: 'fav-2',
    title: 'Stage théâtre & cirque',
    age: '8–12 ans',
    location: 'Provence, France'
  }
];

export const metadata = {
  title: 'Mon compte | Resacolo'
};

export default function MonComptePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="section-container py-10 sm:py-14">
        {/* Header compte */}
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white shadow-md sm:h-16 sm:w-16">
              <UserRound className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Mon compte
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                Bonjour {mockUser.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Mail className="h-4 w-4" />
                {mockUser.email}
                <span className="mx-1 text-slate-300">•</span>
                <MapPin className="h-4 w-4" />
                {mockUser.city}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary btn-sm">
              <Settings className="h-4 w-4" />
              Préférences
            </button>
            <button className="btn btn-primary btn-sm">
              Se déconnecter
            </button>
          </div>
        </header>

        {/* Grille contenu */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          {/* Colonne gauche : réservations + favoris */}
          <div className="space-y-8">
            {/* Prochaine réservation */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Prochaine réservation
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Retrouvez ici les séjours déjà réservés pour vos enfants.
                  </p>
                </div>
                <CalendarDays className="h-8 w-8 text-accent-500" />
              </div>

              {mockUpcoming.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  Vous n&apos;avez pas encore de réservation. Parcourez les séjours et ajoutez-les à votre panier.
                </p>
              ) : (
                <ul className="mt-6 space-y-4">
                  {mockUpcoming.map((stay) => (
                    <li
                      key={stay.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-700"
                    >
                      <p className="font-display text-base font-semibold text-slate-900">
                        {stay.title}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <CalendarDays className="h-4 w-4" />
                        {stay.dates}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{stay.child}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Organisateur : <span className="font-medium">{stay.organizer}</span>
                      </p>
                      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {stay.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 flex justify-end">
                <Link href="/sejours" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  Voir tous les séjours
                </Link>
              </div>
            </section>

            {/* Favoris */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Séjours favoris
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Les séjours que vous avez ajoutés en favoris depuis la page catalogue.
                  </p>
                </div>
                <Heart className="h-7 w-7 text-accent-500" />
              </div>

              {mockFavorites.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  Vous n&apos;avez pas encore de favoris. Cliquez sur le cœur depuis une fiche séjour pour l&apos;ajouter.
                </p>
              ) : (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                  {mockFavorites.map((fav) => (
                    <li
                      key={fav.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-700"
                    >
                      <p className="font-display text-base font-semibold text-slate-900">
                        {fav.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{fav.age}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5" />
                        {fav.location}
                      </p>
                      <Link
                        href="/sejours"
                        className="mt-3 inline-flex text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        Voir le séjour
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Colonne droite : infos compte */}
          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Informations du compte
              </h2>
              <dl className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Nom complet</dt>
                  <dd className="font-medium text-slate-900">{mockUser.name}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-medium text-slate-900">{mockUser.email}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Ville</dt>
                  <dd className="font-medium text-slate-900">{mockUser.city}</dd>
                </div>
              </dl>
              <button className="mt-5 text-sm font-semibold text-brand-600 hover:text-brand-700">
                Mettre à jour mes informations
              </button>
            </section>

            <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Aide & confidentialité
              </h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/bien-choisir-sa-colo" className="hover:text-brand-600">
                    Bien choisir sa colo
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:text-brand-600">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/confidentialite" className="hover:text-brand-600">
                    Politique de confidentialité
                  </Link>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}

