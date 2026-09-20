import type { MetadataRoute } from 'next';
import { toAbsoluteUrl } from '@/lib/seo';
import { DEFAULT_SITE_DESCRIPTION } from '@/lib/seo-meta';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Resacolo — Colonies de vacances',
    short_name: 'Resacolo',
    description: DEFAULT_SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#52b0ea',
    lang: 'fr-FR',
    categories: ['travel', 'lifestyle', 'education'],
    icons: [
      {
        src: toAbsoluteUrl('/image/footer/gouttes.png'),
        sizes: 'any',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  };
}
