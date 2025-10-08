import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import './globals.css';
import { MainNavigation } from '@/components/layout/MainNavigation';
import { Footer } from '@/components/layout/Footer';

const rubik = Rubik({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Resacolo | Plateforme des colonies de vacances',
  description:
    'Découvrez toutes les colonies de vacances proposées par les membres de Résocolo et trouvez le séjour idéal pour chaque enfant.',
  metadataBase: new URL('https://resacolo.com')
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="bg-slate-50 text-slate-900">
      <body className={rubik.className}>
        <div className="flex min-h-screen flex-col">
          <MainNavigation />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
