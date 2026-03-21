import type { Metadata } from 'next';
import { StayCatalogPage } from '@/components/sejours/StayCatalogPage';
import { getStays } from '@/lib/stays';

export const metadata: Metadata = {
  title: 'Tous nos séjours | Resacolo',
  description:
    'Consultez toutes les colonies de vacances et séjour jeunes adultes Resacolo avec filtres détaillés.'
};

export const revalidate = 60;

export default async function SejoursPage() {
  const stays = await getStays();
  return (
    <div style={{ fontFamily: 'Inter, var(--font-sans), sans-serif' }}>
      <StayCatalogPage stays={stays} />
    </div>
  );
}
