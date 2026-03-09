'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
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
  if (hidePublicShell) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MainNavigation />
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-screen">{children}</div>}>
          <PageTransition>{children}</PageTransition>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
