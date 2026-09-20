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
          '/account',
          '/back-office',
          '/checkout',
          '/compte',
          '/confirmation-mail',
          '/login',
          '/mnemos',
          '/mon-compte',
          '/organisme',
          '/panier',
          '/partenaire/reservations',
          '/partenaire/catalogue',
          '/partenaire/montants-organisateurs',
          '/partenaire/securite',
          '/partenaire/fiche',
          '/auth',
          '/assistant'
        ]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL.replace(/^https?:\/\//, '')
  };
}
