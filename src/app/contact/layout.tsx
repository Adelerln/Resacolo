import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo-meta';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact colonies de vacances',
  description:
    'Contactez Resacolo ou un organisateur de colonie de vacances : questions sur un séjour, inscription, tarifs ou assistance.',
  path: '/contact',
  keywords: ['contact colo', 'contacter organisateur colonie', 'aide Resacolo', 'question séjour enfants']
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
