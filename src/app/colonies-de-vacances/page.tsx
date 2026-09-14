import Link from 'next/link';
import { getStays, getStayCanonicalPath } from '@/lib/stays';
import { SEO_LANDINGS } from '@/lib/seo-landings';
import { buildPageMetadata, serializeJsonLd } from '@/lib/seo-meta';
import { toAbsoluteUrl } from '@/lib/seo';

export const revalidate = 300;

export const metadata = buildPageMetadata({
  title: 'Colonies de vacances',
  description:
    'Tout pour trouver une colonie de vacances ou un séjour pour enfants : été, mer, montagne, ski, Europe. Comparez et réservez sur Resacolo.',
  path: '/colonies-de-vacances',
  keywords: [
    'colonies de vacances',
    'colonie de vacances',
    'séjour enfants',
    'colo été',
    'réserver une colo'
  ]
});

export default async function ColoniesDeVacancesHubPage() {
  const stays = await getStays().catch(() => []);
  const stayCount = stays.length;

  const itemListJsonLd = serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Colonies de vacances Resacolo',
    numberOfItems: SEO_LANDINGS.length,
    itemListElement: SEO_LANDINGS.map((landing, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: landing.h1,
      url: toAbsoluteUrl(`/colonies-de-vacances/${landing.slug}`)
    }))
  });

  return (
    <div className="bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <nav aria-label="Fil d’Ariane" className="mb-6 text-sm text-slate-500">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-slate-700">
                Accueil
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li className="font-medium text-slate-800">Colonies de vacances</li>
          </ol>
        </nav>

        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Colonies de vacances et séjours pour enfants
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Resacolo est la plateforme du collectif d’organisateurs de colonies de vacances. Comparez{' '}
          {stayCount > 0 ? `${stayCount} séjours` : 'des séjours'} pour enfants et adolescents, selon
          l’âge, la période et la destination, puis réservez en ligne.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/sejours" className="btn btn-primary btn-md">
            Voir tout le catalogue
          </Link>
          <Link href="/bien-choisir-sa-colo" className="btn btn-secondary btn-md">
            Bien choisir sa colo
          </Link>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-slate-900">Rechercher par type de colonie</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {SEO_LANDINGS.map((landing) => (
              <li key={landing.slug}>
                <Link
                  href={`/colonies-de-vacances/${landing.slug}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
                >
                  <h3 className="font-display text-lg font-semibold text-slate-900">{landing.h1}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{landing.description}</p>
                  <span className="mt-3 inline-block text-sm font-semibold text-brand-700">
                    Voir les séjours →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Pourquoi réserver une colo sur Resacolo ?</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
            <li>Un catalogue multi-organisateurs de colonies de vacances.</li>
            <li>Des filtres par âge, saison, destination et thématique.</li>
            <li>Une réservation centralisée, du panier au paiement.</li>
          </ul>
          {stays.slice(0, 6).length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Séjours récemment mis en avant
              </h3>
              <ul className="mt-3 space-y-2">
                {stays.slice(0, 6).map((stay) => (
                  <li key={stay.id}>
                    <Link
                      href={getStayCanonicalPath(stay)}
                      className="text-sm font-medium text-brand-700 hover:text-brand-800"
                    >
                      {stay.title}
                      {stay.region ? ` — ${stay.region}` : ''}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
