import type { Metadata } from 'next';
import { Baloo_2, Raleway } from 'next/font/google';
import './globals.css';
import { SiteShell } from '@/components/layout/SiteShell';

const raleway = Raleway({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
});
const baloo = Baloo_2({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Resacolo | Plateforme des colonies de vacances',
  description:
    'Découvrez toutes les colonies de vacances proposées par les membres de Resacolo et trouvez le séjour idéal pour chaque enfant.',
  metadataBase: new URL('https://resacolo.com')
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="bg-slate-50 text-slate-900">
      <body className={`${raleway.variable} ${baloo.variable} font-sans bg-white`}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
