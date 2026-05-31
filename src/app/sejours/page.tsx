import type { Metadata } from 'next';
import { StayCatalogPage } from '@/components/sejours/StayCatalogPage';
import { getStays } from '@/lib/stays';
import { getCurrentUser } from '@/lib/auth/session';
import { applyPartnerDiscountPricingToStays, readUserPartnerPricingContext } from '@/lib/stay-partner-pricing';

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
  const partnerPricingContext =
    session?.isClient && session.userId ? await readUserPartnerPricingContext(session.userId) : null;
  const stays = partnerPricingContext ? applyPartnerDiscountPricingToStays(staysRaw, partnerPricingContext) : staysRaw;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  return (
    <div style={{ fontFamily: 'Inter, var(--font-sans), sans-serif' }}>
      <StayCatalogPage stays={stays} searchParams={resolvedSearchParams} />
    </div>
  );
}
