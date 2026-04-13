'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { FavoritesProvider } from '@/components/favorites/FavoritesProvider';
import { MainNavigation } from '@/components/layout/MainNavigation';
import { Footer } from '@/components/layout/Footer';

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hidePublicShell =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/back-office') ||
    pathname.startsWith('/organisme') ||
    pathname.startsWith('/partenaire');
  if (hidePublicShell) {
    return <>{children}</>;
  }

  return (
    <FavoritesProvider>
      <div className="flex min-h-screen flex-col">
        <MainNavigation />
        <main className="flex-1 min-h-0">
          <Suspense fallback={<div className="min-h-screen">{children}</div>}>{children}</Suspense>
        </main>
        <Footer />
      </div>
    </FavoritesProvider>
  );
}
