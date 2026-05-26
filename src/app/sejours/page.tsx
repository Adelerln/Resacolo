import type { Metadata } from 'next';
import { StayCatalogPage } from '@/components/sejours/StayCatalogPage';
import { getStays } from '@/lib/stays';
import { getCurrentUser } from '@/lib/auth/session';
import { applyPartnerDiscountPricingToStays, userHasCollectivityAffiliation } from '@/lib/stay-partner-pricing';

export const metadata: Metadata = {
  title: 'Tous nos séjours | Resacolo',
  description:
    'Consultez toutes les colonies de vacances et séjour jeunes adultes Resacolo avec filtres détaillés.'
};

export const revalidate = 60;

export default async function SejoursPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [staysRaw, session] = await Promise.all([getStays(), getCurrentUser()]);
  const hasPartnerPricing =
    session?.isClient && session.userId ? await userHasCollectivityAffiliation(session.userId) : false;
  const stays = hasPartnerPricing ? applyPartnerDiscountPricingToStays(staysRaw) : staysRaw;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  return (
    <div style={{ fontFamily: 'Inter, var(--font-sans), sans-serif' }}>
      <StayCatalogPage stays={stays} searchParams={resolvedSearchParams} />
    </div>
  );
}
