import type { Metadata } from 'next';
import { Baloo_2, Rubik } from 'next/font/google';
import './globals.css';
import { MainNavigation } from '@/components/layout/MainNavigation';
import { Footer } from '@/components/layout/Footer';

const rubik = Rubik({ subsets: ['latin'], variable: '--font-sans' });
const baloo = Baloo_2({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Resacolo | Plateforme des colonies de vacances',
  description:
    'Découvrez toutes les colonies de vacances proposées par les membres de Resacolo et trouvez le séjour idéal pour chaque enfant.',
  metadataBase: new URL('https://resacolo.com')
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="bg-slate-50 text-slate-900">
      <body className={`${rubik.variable} ${baloo.variable} font-sans bg-white`}>
        <div className="flex min-h-screen flex-col">
          <MainNavigation />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
