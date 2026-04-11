import { readdir } from 'node:fs/promises';
import path from 'node:path';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, MapPin } from 'lucide-react';
import { formatAccommodationType } from '@/components/organisme/AccommodationFormFields';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

type PageProps = { params: { slug: string } };

const BANNER_DIR = path.join(process.cwd(), 'public/image/organisateurs/bannieres_orga');

function compactKey(value: string) {
  return slugify(value).replace(/-/g, '');
}

async function resolveOrganizerBannerPath(input: { name: string; slug: string }) {
  try {
    const files = (await readdir(BANNER_DIR))
      .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
      .sort((a, b) => a.localeCompare(b, 'fr'));

    if (files.length === 0) return null;

    const organizerKeys = [compactKey(input.slug), compactKey(input.name)].filter(Boolean);
    const matchedFile =
      files.find((file) => {
        const fileKey = compactKey(file.replace(/\.[^.]+$/, '').replace(/^banniere[-_\s]*/i, ''));
        return organizerKeys.some((key) => fileKey.includes(key) || key.includes(fileKey));
      }) ?? files[0];

    return `/image/organisateurs/bannieres_orga/${matchedFile}`;
  } catch {
    return null;
  }
}

function formatPublicAgeRange(ageMin?: number | null, ageMax?: number | null) {
  if (ageMin || ageMax) return `${ageMin ?? '?'} à ${ageMax ?? '?'} ans`;
  return 'Âges non renseignés';
}

function formatStayHref(organizerName: string, stayTitle: string, stayId: string) {
  return `/sejours/${slugify(`${organizerName}-${stayTitle}`) || stayId}`;
}

function splitPresentation(description?: string | null, publicAgeRange?: string) {
  const trimmed = description?.trim();
  if (!trimmed) {
    return [
      `Cet organisateur de séjours collectifs propose des colonies de vacances et séjours pour les ${publicAgeRange ?? 'jeunes publics'}.`
    ];
  }

  return trimmed
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default async function OrganisateurDetailPage({ params }: PageProps) {
  const supabase = getServerSupabaseClient();
  const { data: organizer } = await supabase
    .from('organizers')
    .select('id,name,slug,description,hero_intro_text,founded_year,age_min,age_max,logo_path,education_project_path')
    .eq('slug', params.slug)
    .maybeSingle();

  let resolvedOrganizer = organizer;
  if (!resolvedOrganizer) {
    const { data: allOrganizers } = await supabase
      .from('organizers')
      .select('id,name,slug,description,hero_intro_text,founded_year,age_min,age_max,logo_path,education_project_path');
    resolvedOrganizer =
      (allOrganizers ?? []).find((item) => slugify(item.name) === params.slug) ?? null;
  }

  if (!resolvedOrganizer) {
    notFound();
  }

  const publicAgeRange = formatPublicAgeRange(resolvedOrganizer.age_min, resolvedOrganizer.age_max);
  const [bannerPath, logoUrl, projectUrl] = await Promise.all([
    resolveOrganizerBannerPath({
      name: resolvedOrganizer.name,
      slug: resolvedOrganizer.slug ?? params.slug
    }),
    resolvedOrganizer.logo_path
      ? supabase.storage
          .from('organizer-logo')
          .createSignedUrl(resolvedOrganizer.logo_path, 60 * 60)
          .then((result) => result.data?.signedUrl ?? null)
      : Promise.resolve(null),
    resolvedOrganizer.education_project_path
      ? supabase.storage
          .from('organizer-docs')
          .createSignedUrl(resolvedOrganizer.education_project_path, 60 * 60)
          .then((result) => result.data?.signedUrl ?? null)
      : Promise.resolve(null)
  ]);

  const { data: publishedStaysRaw } = await supabase
    .from('stays')
    .select('id,title,summary,description,location_text,age_min,age_max,updated_at,status')
    .eq('organizer_id', resolvedOrganizer.id)
    .eq('status', 'PUBLISHED')
    .order('updated_at', { ascending: false })
    .limit(6);

  const publishedStays = publishedStaysRaw ?? [];
  const publishedStayIds = publishedStays.map((stay) => stay.id);

  const [{ data: stayMediaRaw }, { data: accommodationsRaw }, { data: stayAccommodationLinksRaw }, { data: accommodationMediaRaw }] =
    await Promise.all([
      publishedStayIds.length > 0
        ? supabase
            .from('stay_media')
            .select('stay_id,url,position')
            .in('stay_id', publishedStayIds)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [] as Array<{ stay_id: string; url: string; position: number }> }),
      supabase
        .from('accommodations')
        .select(
          'id,name,accommodation_type,description,bed_info,bathroom_info,catering_info,accessibility_info,status,updated_at'
        )
        .eq('organizer_id', resolvedOrganizer.id)
        .order('updated_at', { ascending: false }),
      supabase.from('stay_accommodations').select('accommodation_id,stay_id'),
      supabase
        .from('accommodation_media')
        .select('accommodation_id,url,position')
        .order('position', { ascending: true })
    ]);

  const coverImageByStayId = new Map<string, string>();
  for (const media of stayMediaRaw ?? []) {
    if (!coverImageByStayId.has(media.stay_id)) {
      coverImageByStayId.set(media.stay_id, media.url);
    }
  }

  const publishedStayTitleById = new Map(publishedStays.map((stay) => [stay.id, stay.title]));
  const linkedPublishedTitlesByAccommodationId = new Map<string, string[]>();
  for (const link of stayAccommodationLinksRaw ?? []) {
    const stayTitle = publishedStayTitleById.get(link.stay_id);
    if (!stayTitle) continue;
    const titles = linkedPublishedTitlesByAccommodationId.get(link.accommodation_id) ?? [];
    titles.push(stayTitle);
    linkedPublishedTitlesByAccommodationId.set(link.accommodation_id, titles);
  }

  const coverImageByAccommodationId = new Map<string, string>();
  for (const media of accommodationMediaRaw ?? []) {
    if (!coverImageByAccommodationId.has(media.accommodation_id)) {
      coverImageByAccommodationId.set(media.accommodation_id, media.url);
    }
  }

  const accommodations = (accommodationsRaw ?? []).map((accommodation) => ({
    ...accommodation,
    coverImage: coverImageByAccommodationId.get(accommodation.id) ?? null,
    linkedStayTitles: linkedPublishedTitlesByAccommodationId.get(accommodation.id) ?? []
  }));

  const presentationParagraphs = splitPresentation(resolvedOrganizer.description, publicAgeRange);

  return (
    <div className="min-h-screen bg-[#fcfcfb]">
      <section
        className="relative overflow-hidden bg-[#edf7f5]"
        style={
          bannerPath
            ? {
                backgroundImage: `url(${bannerPath})`,
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover'
              }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-[#dff1ef]/20" />
        <div
          className="absolute inset-x-0 bottom-0 h-32 bg-[#fcfcfb]"
          style={{ clipPath: 'polygon(0 34%, 18% 52%, 43% 47%, 67% 62%, 86% 58%, 100% 40%, 100% 100%, 0 100%)' }}
        />
        <div className="section-container relative py-6 sm:py-8 lg:py-12">
          <Link
            href="/organisateurs"
            className="absolute left-1 top-3 inline-flex text-sm font-semibold text-slate-600 hover:text-slate-900 sm:left-2 sm:top-4 lg:left-3 lg:top-5"
          >
            ← Retour aux organisateurs
          </Link>

          <div className="relative mt-6 grid gap-8 lg:min-h-[32rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] lg:items-center">
            <div className="relative z-[1] max-w-[44rem] -ml-3 -mt-4 px-0 py-0 sm:-ml-5 sm:-mt-5 lg:-ml-10 lg:-mt-10">
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#6DC7FE]">
                  Organisateur de séjours collectifs
                </p>
                <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] text-[#505050] sm:text-5xl lg:text-[4rem]">
                  {resolvedOrganizer.name}
                </h1>

                {resolvedOrganizer.hero_intro_text?.trim() && (
                  <div className="mt-7 max-w-[34rem] text-lg font-medium leading-[1.65] text-[#505050]">
                    <p>{resolvedOrganizer.hero_intro_text.trim()}</p>
                  </div>
                )}

                {projectUrl && (
                  <a
                    className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
                    href={projectUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Télécharger le projet éducatif
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
            </div>

            <div className="relative z-[1] flex items-center justify-center lg:justify-end">
              <div className="flex min-h-[240px] w-full max-w-[24rem] items-center justify-center p-4 sm:p-6 lg:min-h-[320px]">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={resolvedOrganizer.name}
                    className="max-h-44 w-auto object-contain sm:max-h-52 lg:max-h-64"
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-full bg-white/90 text-5xl font-bold text-slate-300 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]">
                    {resolvedOrganizer.name.slice(0, 2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-t border-slate-200 bg-[#f3f3f3] py-10 sm:py-14">
        <div className="absolute inset-x-0 top-0 h-[44%] bg-white" />
        <div className="section-container relative">
          <div className="mx-auto grid max-w-[70rem] justify-center gap-8 md:grid-cols-2">
            <article className="flex min-h-[255px] w-full max-w-[460px] flex-col items-center justify-center rounded-[26px] bg-white px-8 py-10 text-center shadow-[0_24px_60px_-34px_rgba(15,23,42,0.22)] sm:px-10 sm:py-12">
              <Image
                src="/image/organisateurs/pictos_orga/creation.png"
                alt=""
                width={82}
                height={82}
                className="h-20 w-20 object-contain sm:h-24 sm:w-24"
              />
              <h2 className="mt-5 font-display text-[2.1rem] font-bold leading-none text-[#FA8500]">
                Création
              </h2>
              <p className="mt-8 font-display text-[2.35rem] font-bold leading-none text-[#505050]">
                {resolvedOrganizer.founded_year ?? '—'}
              </p>
            </article>

            <article className="flex min-h-[255px] w-full max-w-[460px] flex-col items-center justify-center rounded-[26px] bg-white px-8 py-10 text-center shadow-[0_24px_60px_-34px_rgba(15,23,42,0.22)] sm:px-10 sm:py-12">
              <Image
                src="/image/organisateurs/pictos_orga/age.png"
                alt=""
                width={82}
                height={82}
                className="h-20 w-20 object-contain sm:h-24 sm:w-24"
              />
              <h2 className="mt-5 font-display text-[2.1rem] font-bold leading-none text-[#FA8500]">
                Public
              </h2>
              <p className="mt-8 font-display text-[2.35rem] font-bold leading-none text-[#505050]">{publicAgeRange}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section-container pb-10 sm:pb-12">
        <div className="max-w-4xl">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">Présentation</p>
          <h2 className="mt-2 font-display text-3xl font-bold leading-[1.06] text-[#505050]">
            L’organisateur en quelques mots
          </h2>
          <div className="mt-5 space-y-5 text-lg font-medium leading-[1.7] text-slate-600">
            {presentationParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="section-container pb-12 sm:pb-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">Hébergements</p>
            <h2 className="mt-2 font-display text-3xl font-bold leading-[1.06] text-[#505050]">
              Centres de vacances
            </h2>
          </div>
        </div>

        {accommodations.length > 0 ? (
          <div className="-mx-4 mt-6 overflow-x-auto px-4 pb-3">
            <div className="flex min-w-max gap-5">
              {accommodations.map((accommodation) => (
                <article
                  key={accommodation.id}
                  className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]"
                >
                  <div className="relative h-48 bg-slate-100">
                    {accommodation.coverImage ? (
                      <img
                        src={accommodation.coverImage}
                        alt={accommodation.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">
                        <MapPin className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                      {formatAccommodationType(accommodation.accommodation_type)}
                    </p>
                    <h3 className="mt-2 text-xl font-bold leading-snug text-[#505050]">{accommodation.name}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {accommodation.description?.trim() || 'Informations d’hébergement à venir.'}
                    </p>
                    {accommodation.linkedStayTitles.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                          Séjours liés
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {accommodation.linkedStayTitles.slice(0, 3).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
            Aucun hébergement n’est encore présenté pour cet organisateur.
          </div>
        )}
      </section>

      <section className="section-container pb-20">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-400">Séjours</p>
          <h2 className="mt-2 font-display text-3xl font-bold leading-[1.06] text-[#505050]">
            Quelques séjours publiés
          </h2>
        </div>

        {publishedStays.length > 0 ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {publishedStays.map((stay) => (
              <article
                key={stay.id}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]"
              >
                <div className="relative h-52 bg-slate-100">
                  {coverImageByStayId.get(stay.id) ? (
                    <img
                      src={coverImageByStayId.get(stay.id)}
                      alt={stay.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">
                      <MapPin className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    {formatPublicAgeRange(stay.age_min, stay.age_max)}
                  </p>
                  <h3 className="mt-2 text-xl font-bold leading-snug text-[#505050]">{stay.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{stay.location_text || 'Destination à découvrir'}</p>
                  <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-600">
                    {stay.summary?.trim() || stay.description?.trim() || 'Présentation du séjour à venir.'}
                  </p>
                  <Link
                    href={formatStayHref(resolvedOrganizer.name, stay.title, stay.id)}
                    className="mt-5 inline-flex items-center rounded-full bg-[#6DC7FE] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#52B0EA]"
                  >
                    Voir le séjour
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
            Aucun séjour publié n’est encore disponible pour cet organisateur.
          </div>
        )}
      </section>
    </div>
  );
}
