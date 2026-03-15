import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

type PageProps = { params: { slug: string } };

export default async function OrganisateurDetailPage({ params }: PageProps) {
  const supabase = getServerSupabaseClient();
  const { data: organizer } = await supabase
    .from('organizers')
    .select('id,name,slug,description,founded_year,age_min,age_max,logo_path,education_project_path')
    .eq('slug', params.slug)
    .maybeSingle();

  let resolvedOrganizer = organizer;
  if (!resolvedOrganizer) {
    const { data: allOrganizers } = await supabase
      .from('organizers')
      .select('id,name,slug,description,founded_year,age_min,age_max,logo_path,education_project_path');
    resolvedOrganizer =
      (allOrganizers ?? []).find((item) => slugify(item.name) === params.slug) ?? null;
  }

  if (!resolvedOrganizer) {
    notFound();
  }

  const logoUrl = resolvedOrganizer.logo_path
    ? (await supabase.storage
        .from('organizer-logo')
        .createSignedUrl(resolvedOrganizer.logo_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const projectUrl = resolvedOrganizer.education_project_path
    ? (await supabase.storage
        .from('organizer-docs')
        .createSignedUrl(resolvedOrganizer.education_project_path, 60 * 60)).data?.signedUrl ?? null
    : null;

  return (
    <div className="min-h-screen bg-white">
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <Link href="/organisateurs" className="text-sm font-medium text-brand-600">
          ← Retour aux organisateurs
        </Link>
        <div className="mt-6 flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 md:flex-row md:items-start">
          <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={resolvedOrganizer.name}
                className="max-h-24 w-auto object-contain"
              />
            ) : (
              <span className="text-3xl font-bold text-slate-300">
                {resolvedOrganizer.name.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <h1 className="font-display text-3xl font-bold text-slate-900">
              {resolvedOrganizer.name}
            </h1>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              <span>Création : {resolvedOrganizer.founded_year ?? '-'}</span>
              <span>
                Public :{' '}
                {resolvedOrganizer.age_min || resolvedOrganizer.age_max
                  ? `${resolvedOrganizer.age_min ?? '?'} - ${resolvedOrganizer.age_max ?? '?'} ans`
                  : '-'}
              </span>
            </div>
            {resolvedOrganizer.description && (
              <p className="max-w-2xl text-slate-600">{resolvedOrganizer.description}</p>
            )}
            {projectUrl && (
              <a
                className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                href={projectUrl}
              >
                Télécharger le projet éducatif (PDF)
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
