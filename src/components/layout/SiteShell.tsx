'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';
import { FavoritesProvider } from '@/components/favorites/FavoritesProvider';
import { MainNavigation } from '@/components/layout/MainNavigation';
import { PartnerHeroBanner } from '@/components/layout/PartnerHeroBanner';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/ui/PageTransition';
import clsx from 'clsx';
import type { PublicSitePartnerBranding } from '@/types/partner-branding';

const LazyPublicChatbotWidget = dynamic(
  () => import('@/components/chatbot/PublicChatbotWidget').then((mod) => mod.PublicChatbotWidget),
  { ssr: false }
);

export function SiteShell({
  children,
  initialBranding,
  initialHidePartnerMarketingLinks
}: {
  children: React.ReactNode;
  initialBranding: PublicSitePartnerBranding;
  initialHidePartnerMarketingLinks: boolean;
}) {
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
    pathname.startsWith('/partenaire') ||
    pathname === '/forbidden';
  const disablePageTransition =
    pathname.startsWith('/login') ||
    pathname.startsWith('/checkout') ||
    isMobileViewport;
  const showPartnerHero = pathname === '/';
  const needsFooterGouttesClearance =
    pathname === '/panier' || pathname.startsWith('/checkout');
  if (hidePublicShell) {
    /* Pas d’animation entre pages dans les espaces admin / organisateur / partenaire */
    return (
      <Suspense fallback={<div className="min-h-screen" />}>{children}</Suspense>
    );
  }

  return (
    <FavoritesProvider>
      <div className="flex min-h-screen flex-col">
        <MainNavigation
          initialBranding={initialBranding}
          initialHidePartnerMarketingLinks={initialHidePartnerMarketingLinks}
        />
        {showPartnerHero ? <PartnerHeroBanner branding={initialBranding} /> : null}
        <main
          className={clsx('min-h-0 flex-1', needsFooterGouttesClearance && 'main-footer-gouttes-clearance')}
        >
          <Suspense fallback={<div className="min-h-screen" />}>
            {disablePageTransition ? children : <PageTransition>{children}</PageTransition>}
          </Suspense>
        </main>
        <Footer />
        <LazyPublicChatbotWidget />
      </div>
    </FavoritesProvider>
  );
}
