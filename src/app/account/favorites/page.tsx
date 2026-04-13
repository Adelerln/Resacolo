import type { Metadata } from 'next';
import { FavoritesPageClient } from '@/components/favorites/FavoritesPageClient';
import { getStays } from '@/lib/stays';

export const metadata: Metadata = {
  title: 'Mes favoris | Resacolo'
};

export default async function AccountFavoritesPage() {
  const stays = await getStays();
  return <FavoritesPageClient stays={stays} />;
}
