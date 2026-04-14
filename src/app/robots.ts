import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/back-office',
          '/checkout',
          '/login',
          '/mnemos',
          '/mon-compte',
          '/organisme',
          '/panier',
          '/partenaire/reservations',
          '/partenaire/catalogue'
        ]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
