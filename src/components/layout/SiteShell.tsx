'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';
import { FavoritesProvider } from '@/components/favorites/FavoritesProvider';
import { MainNavigation } from '@/components/layout/MainNavigation';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/ui/PageTransition';

const LazyPublicChatbotWidget = dynamic(
  () => import('@/components/chatbot/PublicChatbotWidget').then((mod) => mod.PublicChatbotWidget),
  { ssr: false }
);

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  const hidePublicShell =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/back-office') ||
    pathname.startsWith('/organisme') ||
    pathname.startsWith('/partenaire');
  const disablePageTransition =
    pathname.startsWith('/login/familles') ||
    pathname.startsWith('/checkout') ||
    isMobileViewport;
  const hideFooterHelpAndLegal = pathname.startsWith('/contact');
  if (hidePublicShell) {
    /* Pas d’animation entre pages dans les espaces admin / organisateur / partenaire */
    return (
      <Suspense fallback={<div className="min-h-screen" />}>{children}</Suspense>
    );
  }

  return (
    <FavoritesProvider>
      <div className="flex min-h-screen flex-col">
        <MainNavigation />
        <main className="flex-1 min-h-0">
          <Suspense fallback={<div className="min-h-screen" />}>
            {disablePageTransition ? children : <PageTransition>{children}</PageTransition>}
          </Suspense>
        </main>
        <Footer hideHelpAndLegal={hideFooterHelpAndLegal} />
        <LazyPublicChatbotWidget />
      </div>
    </FavoritesProvider>
  );
}
