import type { Metadata } from 'next';
import { StayCatalogPage } from '@/components/sejours/StayCatalogPage';
import { getStays, getStayCanonicalPath } from '@/lib/stays';
import { getCurrentUser } from '@/lib/auth/session';
import { applyCsePricingToStays, readUserCsePricingContext } from '@/lib/cse-pricing';
import { applyPartnerDiscountPricingToStays, readUserPartnerPricingContext } from '@/lib/stay-partner-pricing';
import { buildBreadcrumbJsonLd, buildCollectionPageJsonLd, buildPageMetadata, serializeJsonLd } from '@/lib/seo-meta';

export const metadata: Metadata = buildPageMetadata({
  title: 'Colonies de vacances et séjours pour enfants',
  description:
    'Catalogue de colonies de vacances et séjours pour enfants et ados : filtrez par âge, période, destination et organisateur. Réservez sur Resacolo.',
  path: '/sejours',
  keywords: [
    'colonies de vacances',
    'séjours enfants',
    'catalogue colo',
    'réserver colonie',
    'colo été',
    'séjour ado'
  ]
});

export const revalidate = 60;

export default async function SejoursPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [staysRaw, session] = await Promise.all([getStays(), getCurrentUser()]);
  const userId = session?.isClient && session.userId ? session.userId : null;
  const [partnerPricingContext, csePricingContext] = userId
    ? await Promise.all([readUserPartnerPricingContext(userId), readUserCsePricingContext(userId)])
    : [null, null];
  let stays = partnerPricingContext ? applyPartnerDiscountPricingToStays(staysRaw, partnerPricingContext) : staysRaw;
  if (csePricingContext) {
    stays = applyCsePricingToStays(stays, csePricingContext);
  }
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const featured = stays.slice(0, 30);
  const collectionJsonLd = serializeJsonLd(
    buildCollectionPageJsonLd({
      name: 'Catalogue colonies de vacances Resacolo',
      description:
        'Catalogue de colonies de vacances et séjours pour enfants et adolescents sur Resacolo.',
      path: '/sejours',
      items: featured.map((stay) => ({
        name: stay.title,
        path: getStayCanonicalPath(stay)
      }))
    })
  );
  const breadcrumbJsonLd = serializeJsonLd(
    buildBreadcrumbJsonLd([
      { name: 'Accueil', path: '/' },
      { name: 'Séjours', path: '/sejours' }
    ])
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: collectionJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <StayCatalogPage stays={stays} searchParams={resolvedSearchParams} />
    </>
  );
}
