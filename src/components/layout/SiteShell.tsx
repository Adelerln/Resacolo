'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { FavoritesProvider } from '@/components/favorites/FavoritesProvider';
import { PublicChatbotWidget } from '@/components/chatbot/PublicChatbotWidget';
import { MainNavigation } from '@/components/layout/MainNavigation';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/ui/PageTransition';

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hidePublicShell =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/back-office') ||
    pathname.startsWith('/organisme') ||
    pathname.startsWith('/partenaire');
  const hideFooterHelpAndLegal = pathname.startsWith('/contact');
  if (hidePublicShell) {
    /* Pas d’animation entre pages dans les espaces admin / organisateur / partenaire */
    return (
      <Suspense fallback={<div className="min-h-screen">{children}</div>}>{children}</Suspense>
    );
  }

  return (
    <FavoritesProvider>
      <div className="flex min-h-screen flex-col">
        <MainNavigation />
        <main className="flex-1 min-h-0">
          <Suspense fallback={<div className="min-h-screen">{children}</div>}>
            <PageTransition>{children}</PageTransition>
          </Suspense>
        </main>
        <Footer hideHelpAndLegal={hideFooterHelpAndLegal} />
        <PublicChatbotWidget />
      </div>
    </FavoritesProvider>
  );
}
