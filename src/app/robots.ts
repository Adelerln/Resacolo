import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const PRIVATE_DISALLOW = [
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
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_DISALLOW
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: PRIVATE_DISALLOW
      },
      {
        userAgent: 'Googlebot-Image',
        allow: '/'
      },
      {
        // Visibilité dans les aperçus IA Google (contenus publics).
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: PRIVATE_DISALLOW
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: PRIVATE_DISALLOW
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL.replace(/^https?:\/\//, '')
  };
}
