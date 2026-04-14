import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getStays, getStayCanonicalPath } from '@/lib/stays';

const PUBLIC_STATIC_PATHS = [
  '/',
  '/sejours',
  '/organisateurs',
  '/notre-concept',
  '/bien-choisir-sa-colo',
  '/devenir-organisateur',
  '/devenir-partenaire',
  '/partenaire',
  '/contact',
  '/faq',
  '/ressources',
  '/rejoindre-resacolo',
  '/cgu',
  '/cgv',
  '/confidentialite',
  '/mentions-legales'
];

function toAbsoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();

  for (const path of PUBLIC_STATIC_PATHS) {
    const url = toAbsoluteUrl(path);
    entries.set(url, {
      url,
      lastModified: now
    });
  }

  const stays = await getStays();
  for (const stay of stays) {
    const url = toAbsoluteUrl(getStayCanonicalPath(stay));
    entries.set(url, {
      url,
      lastModified: stay.updatedAt ? new Date(stay.updatedAt) : now
    });
  }

  return Array.from(entries.values()).sort((left, right) => left.url.localeCompare(right.url, 'fr'));
}
