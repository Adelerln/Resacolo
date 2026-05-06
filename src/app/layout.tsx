import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { WebVitalsReporter } from '@/components/perf/WebVitalsReporter';
import { SiteShell } from '@/components/layout/SiteShell';
import { getCurrentUser } from '@/lib/auth/session';
import { readFamilyCseAffiliation, readPublicSitePartnerBranding } from '@/lib/account-profile/server';

const raleway = localFont({
  src: [
    { path: '../../public/fonts/Raleway-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Raleway-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Raleway-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Raleway-Bold.ttf', weight: '700', style: 'normal' }
  ],
  variable: '--font-sans',
  display: 'swap'
});
const baloo = localFont({
  src: [
    { path: '../../public/fonts/BalooBhaijaan2-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../../public/fonts/BalooBhaijaan2-Bold.ttf', weight: '700', style: 'normal' },
    { path: '../../public/fonts/BalooBhaijaan2-ExtraBold.ttf', weight: '800', style: 'normal' }
  ],
  variable: '--font-display',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Resacolo | Plateforme des colonies de vacances',
  description:
    'Découvrez toutes les colonies de vacances proposées par les membres de Resacolo et trouvez le séjour idéal pour chaque enfant.',
  metadataBase: new URL('https://resacolo.com'),
  icons: {
    icon: '/image/footer/gouttes.png',
    shortcut: '/image/footer/gouttes.png',
    apple: '/image/footer/gouttes.png'
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser().catch(() => null);
  const initialBranding =
    session?.userId && session.role === 'CLIENT'
      ? await readPublicSitePartnerBranding(session.userId).catch(() => null)
      : null;
  const initialHidePartnerMarketingLinks =
    session?.userId && session.role === 'CLIENT'
      ? Boolean(await readFamilyCseAffiliation(session.userId).catch(() => null))
      : false;

  return (
    <html lang="fr" className="bg-slate-50 text-slate-900" data-scroll-behavior="smooth">
      <body className={`${raleway.variable} ${baloo.variable} font-sans bg-white`}>
        <CartProvider>
          <WebVitalsReporter />
          <SiteShell
            initialBranding={initialBranding}
            initialHidePartnerMarketingLinks={initialHidePartnerMarketingLinks}
          >
            {children}
          </SiteShell>
        </CartProvider>
      </body>
    </html>
  );
}
