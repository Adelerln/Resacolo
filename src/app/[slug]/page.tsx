import { notFound, redirect } from 'next/navigation';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LegacyOrganizerSlugPage({ params }: PageProps) {
  const { slug } = await params;

  const reservedSlugs = new Set([
    'admin',
    'api',
    'bien-choisir-sa-colo',
    'cgu',
    'cgv',
    'confidentialite',
    'devenir-organisateur',
    'devenir-partenaire',
    'faq',
    'login',
    'notre-concept',
    'organisateurs',
    'organisme',
    'partenaire',
    'rejoindre-resacolo',
    'ressources',
    'sejours'
  ]);

  if (reservedSlugs.has(slug)) {
    notFound();
  }

  const supabase = getServerSupabaseClient();
  const { data: organizers } = await supabase.from('organizers').select('slug,name');

  const organizer = (organizers ?? []).find(
    (item) => item.slug === slug || slugify(item.name) === slug
  );

  if (!organizer) {
    notFound();
  }

  redirect(`/organisateurs/${organizer.slug ?? slugify(organizer.name)}`);
}
