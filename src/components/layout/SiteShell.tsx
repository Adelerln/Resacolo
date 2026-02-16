'use client';

import { usePathname } from 'next/navigation';
import { MainNavigation } from '@/components/layout/MainNavigation';
import { Footer } from '@/components/layout/Footer';

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hidePublicShell =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/organisme') ||
    pathname.startsWith('/partenaire');
  if (hidePublicShell) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MainNavigation />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
