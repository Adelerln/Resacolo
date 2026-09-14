import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStays, getStayCanonicalPath } from '@/lib/stays';
import {
  filterStaysForLanding,
  getSeoLandingBySlug,
  SEO_LANDINGS
} from '@/lib/seo-landings';
import { buildPageMetadata, serializeJsonLd } from '@/lib/seo-meta';
import { toAbsoluteUrl } from '@/lib/seo';

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return SEO_LANDINGS.map((landing) => ({ slug: landing.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const landing = getSeoLandingBySlug(slug);
  if (!landing) {
    return { title: 'Page introuvable | Resacolo', robots: { index: false, follow: false } };
  }
  return buildPageMetadata({
    title: landing.title,
    description: landing.description,
    path: `/colonies-de-vacances/${landing.slug}`,
    keywords: landing.keywords
  });
}

export default async function ColonieLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const landing = getSeoLandingBySlug(slug);
  if (!landing) notFound();

  const allStays = await getStays().catch(() => []);
  const matched = filterStaysForLanding(allStays, landing).slice(0, 24);

  const itemListJsonLd = serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: landing.h1,
    numberOfItems: matched.length,
    itemListElement: matched.map((stay, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: stay.title,
      url: toAbsoluteUrl(getStayCanonicalPath(stay))
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
            <li>
              <Link href="/colonies-de-vacances" className="hover:text-slate-700">
                Colonies de vacances
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li className="font-medium text-slate-800">{landing.h1}</li>
          </ol>
        </nav>

        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {landing.h1}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
          {landing.intro}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={landing.catalogQuery} className="btn btn-primary btn-md">
            Filtrer dans le catalogue
          </Link>
          <Link href="/colonies-de-vacances" className="btn btn-secondary btn-md">
            Toutes les thématiques
          </Link>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-slate-900">
            {matched.length > 0
              ? `${matched.length} séjour${matched.length > 1 ? 's' : ''} correspondant${matched.length > 1 ? 's' : ''}`
              : 'Séjours à explorer'}
          </h2>
          {matched.length > 0 ? (
            <ul className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {matched.map((stay) => (
                <li key={stay.id}>
                  <Link
                    href={getStayCanonicalPath(stay)}
                    className="flex flex-col gap-1 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-slate-900">{stay.title}</span>
                    <span className="text-sm text-slate-500">
                      {[stay.region, stay.ageRange, stay.seasonName].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
              Aucun séjour ne correspond pour le moment à cette thématique. Parcourez le{' '}
              <Link href="/sejours" className="font-semibold text-brand-700 hover:text-brand-800">
                catalogue complet
              </Link>
              .
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
