import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { SiteShell } from '@/components/layout/SiteShell';

const raleway = localFont({
  src: [
    { path: './fonts/raleway-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/raleway-latin.woff2', weight: '500', style: 'normal' },
    { path: './fonts/raleway-latin.woff2', weight: '600', style: 'normal' },
    { path: './fonts/raleway-latin.woff2', weight: '700', style: 'normal' }
  ],
  variable: '--font-sans',
  display: 'swap'
});
const baloo = localFont({
  src: [
    { path: './fonts/baloo2-latin.woff2', weight: '700', style: 'normal' },
    { path: './fonts/baloo2-latin.woff2', weight: '800', style: 'normal' }
  ],
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
        <CartProvider>
          <SiteShell>{children}</SiteShell>
        </CartProvider>
      </body>
    </html>
  );
}
