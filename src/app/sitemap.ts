import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { SEO_LANDINGS } from '@/lib/seo-landings';
import { getStays, getStayCanonicalPath } from '@/lib/stays';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

const PUBLIC_STATIC_PATHS: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/sejours', changeFrequency: 'daily', priority: 0.95 },
  { path: '/colonies-de-vacances', changeFrequency: 'weekly', priority: 0.95 },
  { path: '/organisateurs', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/bien-choisir-sa-colo', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/notre-concept', changeFrequency: 'monthly', priority: 0.65 },
  { path: '/devenir-partenaire', changeFrequency: 'monthly', priority: 0.55 },
  { path: '/partenaire', changeFrequency: 'monthly', priority: 0.45 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.45 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/ressources', changeFrequency: 'monthly', priority: 0.45 },
  { path: '/rejoindre-resacolo', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/cgu', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/cgv', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/confidentialite', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/mentions-legales', changeFrequency: 'yearly', priority: 0.2 }
];

function toAbsoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();

  for (const item of PUBLIC_STATIC_PATHS) {
    const url = toAbsoluteUrl(item.path);
    entries.set(url, {
      url,
      lastModified: now,
      changeFrequency: item.changeFrequency,
      priority: item.priority
    });
  }

  for (const landing of SEO_LANDINGS) {
    const url = toAbsoluteUrl(`/colonies-de-vacances/${landing.slug}`);
    entries.set(url, {
      url,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85
    });
  }

  try {
    const stays = await getStays();
    for (const stay of stays) {
      const url = toAbsoluteUrl(getStayCanonicalPath(stay));
      entries.set(url, {
        url,
        lastModified: stay.updatedAt ? new Date(stay.updatedAt) : now,
        changeFrequency: 'weekly',
        priority: 0.7
      });
    }
  } catch (error) {
    console.warn('[sitemap] stays unavailable', error);
  }

  try {
    const supabase = getServerSupabaseClient();
    const { data: organizers } = await supabase.from('organizers').select('slug, name');
    for (const organizer of organizers ?? []) {
      const slug = organizer.slug?.trim() || slugify(organizer.name ?? '');
      if (!slug) continue;
      const url = toAbsoluteUrl(`/organisateurs/${slug}`);
      entries.set(url, {
        url,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.65
      });
    }
  } catch (error) {
    console.warn('[sitemap] organizers unavailable', error);
  }

  return Array.from(entries.values()).sort((left, right) => left.url.localeCompare(right.url, 'fr'));
}
