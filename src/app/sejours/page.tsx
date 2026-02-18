import type { Metadata } from 'next';
import { StayCatalogPage } from '@/components/sejours/StayCatalogPage';

export const metadata: Metadata = {
  title: 'Tous nos séjours | Resacolo',
  description:
    'Consultez toutes les colonies de vacances et séjour jeunes adultes Resacolo avec filtres détaillés.'
};

export default function SejoursPage() {
  return (
    <div style={{ fontFamily: 'Inter, var(--font-sans), sans-serif' }}>
      <StayCatalogPage />
    </div>
  );
}
